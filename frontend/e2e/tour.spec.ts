// The guided tour. Reads only: the stand-in wallet records every request and refuses anything that would send.
import { expect, test, type Page } from '@playwright/test'

const STEPS = [
  ['/', 'balance'],
  ['/', 'search'],
  ['/check/EXP-0002', 'verdict'],
  ['/', 'rules'],
  ['/', 'latest'],
  ['/', 'contract'],
  ['/ledger', 'filters'],
  ['/manage', 'manage'],
] as const

type W = { calls: string[]; emitChain: (id: string) => void }

async function wallet(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { calls: string[]; emitChain: (id: string) => void; ethereum: unknown }
    const on: Record<string, ((v: unknown) => void)[]> = {}
    let chain = '0x14a34'
    w.calls = []
    w.emitChain = (id) => {
      chain = id
      on.chainChanged?.forEach((f) => f(id))
    }
    w.ethereum = {
      on: (e: string, f: (v: unknown) => void) => (on[e] ??= []).push(f),
      removeListener: () => {},
      async request({ method }: { method: string }) {
        w.calls.push(method)
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['0x0866D39D9c6f741aC480Add2809B88820Ae5872E']
        if (method === 'eth_chainId') return chain
        if (/^wallet_.*Permissions$/.test(method)) return []
        throw Object.assign(new Error('User rejected the request.'), { code: 4001 })
      },
    }
  })
}

const calls = (page: Page) => page.evaluate(() => [...(window as unknown as W).calls])
const card = (page: Page) => page.getByTestId('tour-card')
const replay = (page: Page) => page.getByRole('button', { name: 'Tour', exact: true }).click()
const next = (page: Page) => card(page).getByRole('button', { name: 'Next' }).click()

for (const [width, height] of [[1440, 900], [375, 812], [375, 667], [320, 568], [768, 1024], [1280, 720]]) {
  test(`tour at ${width}x${height}: every step finds its target and never covers it`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.getByTestId('entry-card').first()).toBeVisible()
    await page.getByRole('button', { name: 'Take a tour' }).click()
    await card(page).getByRole('button', { name: 'Pause' }).click() // hold each step while it is measured
    for (const [i, [route, target]] of STEPS.entries()) {
      await expect(card(page)).toHaveAttribute('data-step', String(i + 1))
      await expect.poll(() => new URL(page.url()).pathname).toBe(route)
      await expect(page.locator(`[data-tour-page] [data-tour="${target}"]`)).toBeVisible()
      await expect(page.getByTestId('tour-ring')).toBeVisible()
      await page.waitForTimeout(550) // the card's slide-up, and late data settling
      await expect
        .poll(() =>
          page.evaluate((name) => {
            const ring = document.querySelector('[data-testid="tour-ring"]')!.getBoundingClientRect()
            const c = document.querySelector('[data-testid="tour-card"]')!.getBoundingClientRect()
            const whole = document.querySelector(`[data-tour-page] [data-tour="${name}"]`)!
            const near = [whole, ...whole.querySelectorAll(`[data-tour-part="${name}"]`)].some((el) => {
              const r = el.getBoundingClientRect()
              return Math.abs(r.left - 9 - ring.left) < 4 && Math.abs(r.top - 9 - ring.top) < 4 && Math.abs(r.bottom + 9 - ring.bottom) < 4
            })
            if (!near) return 'ring is off its target'
            if (ring.top < 0 || ring.bottom > innerHeight) return 'ring is out of view'
            if (ring.right > c.left && ring.left < c.right && ring.bottom > c.top && ring.top < c.bottom) return 'card covers the target'
            if (document.documentElement.scrollWidth > document.documentElement.clientWidth) return 'page scrolls sideways'
            return 'ok'
          }, target),
        )
        .toBe('ok')
      await next(page)
    }
    await expect(page.getByTestId('tour-end')).toContainText("You're all set")
    expect(errors).toEqual([])
  })
}

test('tour: the offer remembers Skip, and the header button replays', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.reload()
  await expect(page.getByTestId('balance')).toBeVisible()
  await expect(page.getByTestId('tour-offer')).toHaveCount(0)
  await replay(page)
  await expect(card(page)).toHaveAttribute('data-step', '1')
})

test('tour: taking it is remembered too', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Take a tour' }).click()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByTestId('balance')).toBeVisible()
  await expect(page.getByTestId('tour-offer')).toHaveCount(0)
})

test('tour: Pause freezes the bar, the clock and the pending action', async ({ page }) => {
  await page.goto('/')
  await replay(page)
  const bar = () => card(page).locator('[data-state="current"] > span').evaluate((el) => parseFloat(el.style.transform.match(/[\d.]+/)?.[0] ?? '0'))
  await expect.poll(bar).toBeGreaterThan(0) // the clock is running
  await card(page).getByRole('button', { name: 'Pause' }).click()
  const frozen = await bar()
  await page.waitForTimeout(1500)
  expect(await bar()).toBe(frozen)
  // Already paused on arrival, so this can't race step 2's action, which is due after 700 ms.
  await next(page)
  await page.waitForTimeout(9000) // longer than the step
  expect(await bar()).toBe(0)
  await expect(card(page)).toHaveAttribute('data-step', '2')
  const field = page.locator('[data-tour-page] #receipt')
  await expect(field).toHaveValue('')
  await card(page).getByRole('button', { name: 'Play' }).click()
  await expect(field).toHaveValue('EXP-0002')
  await expect(card(page)).toHaveAttribute('data-step', '3', { timeout: 12000 })
})

test('tour: typed example never reaches the visitor, whose field, scroll and history come back', async ({ page }) => {
  await page.goto('/ledger')
  await page.getByRole('navigation').getByRole('link', { name: 'Treasurers' }).click()
  await page.locator('header').getByRole('link', { name: 'ClubLedger' }).click()
  await expect(page.getByTestId('entry-card').first()).toBeVisible()
  await page.getByLabel('Receipt number').fill('my-own')
  await replay(page)
  await next(page)
  await expect(page.locator('[data-tour-page] #receipt')).toHaveValue('EXP-0002')
  await next(page)
  await expect(page).toHaveURL(/\/check\/EXP-0002$/)
  await page.keyboard.press('Escape')
  await expect(card(page)).toHaveCount(0)
  await expect(page).toHaveURL(/:\d+\/$|\.app\/$/)
  await expect(page.getByLabel('Receipt number')).toHaveValue('my-own')
  await expect(page).toHaveTitle('ClubLedger | Robotics Club income and expenses')
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(120)
  await page.goBack()
  await expect(page).toHaveURL(/\/manage$/)
})

test('tour: finishing restores the filter, scroll and title, and Watch again restarts', async ({ page }) => {
  await page.goto('/ledger')
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByTestId('entry-card')).toHaveCount(12)
  await page.getByRole('tab', { name: 'Income' }).click()
  await replay(page)
  for (let i = 1; i <= STEPS.length; i++) {
    await expect(card(page)).toHaveAttribute('data-step', String(i))
    await next(page)
  }
  await expect(page.getByTestId('tour-end')).toBeVisible()
  await expect(page).toHaveURL(/\/ledger$/)
  await page.getByRole('button', { name: 'Watch again' }).click()
  await expect(card(page)).toHaveAttribute('data-step', '1')
  await card(page).getByRole('button', { name: 'Exit tour' }).click()
  await expect(page).toHaveURL(/\/ledger$/)
  await expect(page.getByRole('tab', { name: 'Income' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('entry-card')).toHaveCount(4)
})

test('tour: a receipt page gets its scroll and title back', async ({ page }) => {
  await page.goto('/check/INC-0001')
  await expect(page.getByTestId('version')).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.evaluate(() => scrollTo(0, 260))
  // The header has scrolled away, so press the button without scrolling back to it.
  await page.getByRole('button', { name: 'Tour', exact: true }).dispatchEvent('click')
  await expect(card(page)).toBeVisible()
  await next(page)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/check\/INC-0001$/)
  await expect(page).toHaveTitle('INC-0001 | ClubLedger')
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(260)
})

test('tour: a half-filled form and refusal survive, and the wallet is never asked for anything', async ({ page }) => {
  await wallet(page)
  await page.goto('/manage?demo=1')
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await page.getByLabel('Amount (AED)').fill('123.45')
  await page.getByLabel('Paid to').fill('Half typed')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(page.getByTestId('refusal-card')).toBeVisible()
  const before = (await calls(page)).filter((m) => m !== 'eth_chainId' && m !== 'eth_accounts')
  await replay(page)
  for (let i = 1; i < STEPS.length; i++) {
    await expect(card(page)).toHaveAttribute('data-step', String(i))
    await next(page)
  }
  await expect(page.locator('[data-tour-page] [data-tour="manage"]')).toBeVisible()
  await expect(page.locator('#root > div').first()).toHaveAttribute('inert', '') // nothing behind can be pressed
  await next(page)
  await page.getByRole('button', { name: 'Start using it' }).click()
  await expect(page).toHaveURL(/\/manage\?demo=1$/)
  await expect(page.getByLabel('Amount (AED)')).toHaveValue('123.45')
  await expect(page.getByLabel('Paid to')).toHaveValue('Half typed')
  await expect(page.getByTestId('refusal-card')).toBeVisible()
  expect((await calls(page)).filter((m) => m !== 'eth_chainId' && m !== 'eth_accounts')).toEqual(before)
})

test('tour: a wallet on another network is not asked to switch', async ({ page }) => {
  await wallet(page)
  await page.goto('/manage')
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByTestId('role-banner')).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'All entries' }).click()
  // The URL changes a moment before the page does. /manage does ask to switch, so let it unmount first.
  await expect(page.getByTestId('entry-card').first()).toBeVisible()
  await page.evaluate(() => (window as unknown as W).emitChain('0x1'))
  await replay(page)
  for (let i = 1; i < STEPS.length; i++) {
    await expect(card(page)).toHaveAttribute('data-step', String(i))
    await next(page)
  }
  await expect(page.locator('[data-tour-page]').getByText("Switch your wallet to the club's network")).toBeVisible()
  await page.waitForTimeout(800)
  await page.keyboard.press('Escape')
  await expect(card(page)).toHaveCount(0)
  await page.waitForTimeout(400)
  expect(await calls(page)).not.toContain('wallet_switchEthereumChain')
})

test('tour: a pointer presses Check before the receipt opens, and Expense before the list changes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('entry-card').first()).toBeVisible()
  await replay(page)
  await next(page)
  const pointer = page.getByTestId('tour-pointer')
  const on = (target: string) => async () => {
    const p = await pointer.boundingBox()
    const b = await page.locator(`[data-tour-page] [data-tour-click="${target}"]`).boundingBox()
    return !!p && !!b && p.x >= b.x - 8 && p.x <= b.x + b.width && p.y >= b.y - 8 && p.y <= b.y + b.height
  }
  await expect(pointer).toBeVisible({ timeout: 8000 })
  expect(new URL(page.url()).pathname).toBe('/')
  await expect.poll(on('check'), { timeout: 8000 }).toBe(true)
  await expect(page).toHaveURL(/\/check\/EXP-0002$/)
  for (let i = 3; i < 7; i++) {
    await expect(card(page)).toHaveAttribute('data-step', String(i))
    await next(page)
  }
  const expense = page.locator('[data-tour-page] [data-tour-click="expense"]')
  await expect(expense).toHaveAttribute('aria-selected', 'false')
  await expect.poll(on('expense'), { timeout: 8000 }).toBe(true)
  await expect(expense).toHaveAttribute('aria-selected', 'true')
})

test('tour: a missing target is skipped after three seconds', async ({ page }) => {
  await page.route(/base-sepolia-rpc\.publicnode\.com|sepolia\.base\.org/, () => new Promise(() => {})) // never answers
  await page.goto('/')
  await replay(page)
  await next(page)
  await next(page)
  await expect(card(page)).toHaveAttribute('data-step', '3')
  const t0 = Date.now()
  await expect(card(page)).toHaveAttribute('data-step', '4', { timeout: 7000 })
  expect(Date.now() - t0).toBeGreaterThan(2200)
})

test('tour: the browser Back button ends it', async ({ page }) => {
  await page.goto('/ledger')
  await page.locator('header').getByRole('link', { name: 'ClubLedger' }).click()
  await replay(page)
  await page.goBack()
  await expect(card(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/ledger$/)
})

test('tour: reduced motion removes the slide and crossfade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await replay(page)
  await expect(card(page)).toHaveCSS('animation-name', 'none')
  await expect(card(page).locator('.tour-captions > p').first()).toHaveCSS('transition-duration', '0s')
})

for (const width of [320, 360, 370, 375, 390, 414, 420, 640, 768, 1440]) {
  test(`header fits with the Tour button at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const gap = await page.evaluate(() => {
      const brand = document.querySelector('header a')!
      const right = Math.max(...[brand, ...brand.querySelectorAll('*')].map((e) => e.getBoundingClientRect().right))
      return document.querySelector('header nav')!.getBoundingClientRect().left - right
    })
    expect(gap).toBeGreaterThanOrEqual(4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}
