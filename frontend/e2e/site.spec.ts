import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const SHOTS = resolve(import.meta.dirname, '../../docs/screenshots')
mkdirSync(SHOTS, { recursive: true })

async function noHorizontalScroll(page: Page) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(w, 'document.documentElement.scrollWidth').toBeLessThanOrEqual(375)
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`), fullPage: true })
}

test('home: balance, rules panel with 8 public-proof links, recent entries', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /See the Robotics Club's income and expenses/ })).toBeVisible()
  await expect(page.getByTestId('balance')).toHaveText(/AED\s?4,580\.00/)
  const rules = page.getByTestId('rules')
  await expect(rules.getByRole('listitem')).toHaveCount(4)
  const links = rules.locator('a[href^="https://sepolia.basescan.org/tx/0x"]')
  await expect(links).toHaveCount(8)
  for (const href of await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
    expect(href).toMatch(/^https:\/\/sepolia\.basescan\.org\/tx\/0x[0-9a-f]{64}$/)
    expect(href).not.toMatch(/0x0{64}$/)
  }
  await expect(page.getByTestId('entry-card')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Check' })).toBeVisible()
  await noHorizontalScroll(page)
  await shot(page, 'home')
})

test('home: the ledger adds up and ends at the balance the receipt shows', async ({ page }) => {
  await page.goto('/')
  const rows = page.getByTestId('entry-card')
  await expect(rows).toHaveCount(5)
  const num = (s: string) => Number(s.replace(/[^\d]/g, '')) * (s.includes('−') ? -1 : 1) // fils, as whole numbers
  const header = page.locator('.book-total').first().locator('.num')
  let running = num(await header.innerText())
  for (const row of await rows.all()) {
    running += num(await row.locator('.c-in').innerText()) - num(await row.locator('.c-out').innerText())
    expect(num(await row.getByTestId('running-balance').innerText())).toBe(running)
  }
  expect(num(await page.getByTestId('balance').innerText())).toBe(running)
  await expect(page.getByTestId('closing-balance')).toHaveText(await page.getByTestId('balance').innerText())
})

test('home: a ledger row opens by keyboard and by a click anywhere on it', async ({ page }) => {
  await page.goto('/')
  const row = page.getByTestId('entry-card').filter({ hasText: 'INC-0004' })
  await row.getByRole('link').focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/check\/INC-0004$/)
  await page.goBack()
  await row.getByTestId('running-balance').click()
  await expect(page).toHaveURL(/\/check\/INC-0004$/)
})

test('home: the receipt field rests quietly and shows one ring on keyboard focus', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('entry-card').first()).toBeVisible()
  const field = page.getByLabel('Receipt number')
  await expect(field).not.toBeFocused()
  await expect(field.locator('..')).toHaveCSS('outline-style', 'none')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab') // brand, two nav links, field
  await expect(field).toBeFocused()
  await expect(field.locator('..')).toHaveCSS('outline-style', 'solid')
  await expect(field.locator('..')).toHaveCSS('outline-width', '3px')
  await expect(field).toHaveCSS('outline-style', 'none')
})

test('home: the contract address copies whole', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const w = window as unknown as { copied?: string }
    navigator.clipboard.writeText = async (s: string) => void (w.copied = s)
  })
  await page.getByRole('button', { name: 'Copy address' }).click()
  await expect(page.getByText('Address copied.')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { copied?: string }).copied)).toBe('0x210312F9C553a02A9864CC9685854A72d49D4F7e')
})

test('demo data is marked once per section, not after every name', async ({ page }) => {
  for (const path of ['/', '/ledger', '/check/EXP-0002']) {
    await page.goto(path)
    await expect(page.getByTestId('demo-mark')).toHaveCount(1)
    await expect(page.getByTestId(path.startsWith('/check') ? 'version' : 'entry-card').first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText('(fictional)')
  }
})

test('search box navigates to the verdict page (trim + uppercase)', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Receipt number').fill('  inc-0001 ')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page).toHaveURL(/\/check\/INC-0001$/)
  await expect(page.getByTestId('verdict')).toContainText('Genuine record')
})

for (const code of ['EXP-0002', 'exp-0002']) {
  test(`/check/${code} shows Corrected with both versions and the reason`, async ({ page }) => {
    await page.goto(`/check/${code}`)
    const v = page.getByTestId('verdict')
    await expect(v).toContainText('Corrected')
    await expect(v).toContainText('1 correction')
    await expect(page.getByText(/420\.00/).first()).toBeVisible()
    await expect(page.getByText(/380\.00/).first()).toBeVisible()
    await expect(page.getByText('Vendor refunded AED 40 for undelivered items')).toBeVisible()
    await expect(page.getByText('Original entry')).toBeVisible()
    await expect(page.getByTestId('version')).toHaveCount(2)
    await noHorizontalScroll(page)
    if (code === 'EXP-0002') await shot(page, 'check-EXP-0002-corrected')
  })
}

test('/check/EXP-0004 shows Cancelled', async ({ page }) => {
  await page.goto('/check/EXP-0004')
  await expect(page.getByTestId('verdict')).toContainText('Cancelled')
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'CANCELLED')
  await noHorizontalScroll(page)
  await shot(page, 'check-EXP-0004-cancelled')
})

test('/check/INC-0001 shows Genuine', async ({ page }) => {
  await page.goto('/check/INC-0001')
  await expect(page.getByTestId('verdict')).toContainText('Genuine record')
  await expect(page.getByTestId('verdict')).toContainText('Recorded by Treasurer')
  await noHorizontalScroll(page)
  await shot(page, 'check-INC-0001-genuine')
})

test('/check/XYZ-1 shows No such record', async ({ page }) => {
  await page.goto('/check/XYZ-1')
  await expect(page.getByTestId('verdict')).toContainText('No such record')
  await expect(page.getByText("No entry with this receipt number was ever recorded by this club's contract.")).toBeVisible()
  await noHorizontalScroll(page)
  await shot(page, 'check-XYZ-1-not-found')
})

test('/ledger lists all 12 entries with filters', async ({ page }) => {
  await page.goto('/ledger')
  await expect(page.getByTestId('entry-card')).toHaveCount(12)
  await page.getByRole('tab', { name: 'Income' }).click()
  await expect(page.getByTestId('entry-card')).toHaveCount(4)
  await page.getByRole('tab', { name: 'Expense' }).click()
  await expect(page.getByTestId('entry-card')).toHaveCount(8)
  await page.getByRole('tab', { name: 'All' }).click()
  await noHorizontalScroll(page)
  await shot(page, 'ledger')
  await page.getByTestId('entry-card').filter({ hasText: 'INC-0003' }).click()
  await expect(page).toHaveURL(/\/check\/INC-0003$/)
})

test('/manage without a wallet asks to connect', async ({ page }) => {
  await page.goto('/manage')
  await expect(page.getByText('Connect a wallet to add entries.')).toBeVisible()
  await expect(page.getByText("You don't need one to check receipts.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
  await noHorizontalScroll(page)
  await shot(page, 'manage-no-wallet')
})

test('public pages contain no crypto jargon', async ({ page }) => {
  for (const path of ['/', '/check/EXP-0002', '/ledger', '/check/XYZ-1']) {
    await page.goto(path)
    await expect(page.locator('main')).not.toBeEmpty()
    await page.waitForLoadState('networkidle')
    const text = (await page.locator('body').innerText()).toLowerCase()
    for (const word of ['refcode', 'poster', 'voided', 'revert', 'simulate', 'tx hash', 'chain id', 'base sepolia', 'wallet', 'fils']) {
      expect(text, `${path} contains "${word}"`).not.toContain(word)
    }
  }
})
