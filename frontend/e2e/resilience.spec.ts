import { expect, test, type Page } from '@playwright/test'

const RPC = /base-sepolia-rpc\.publicnode\.com|sepolia\.base\.org/
const DOWN = "Can't reach the public record right now — try again"

for (const path of ['/', '/ledger', '/check/EXP-0002']) {
  test(`${path}: plain message when both RPCs are down`, async ({ page }) => {
    await page.route(RPC, (r) => r.abort())
    await page.goto(path)
    await expect(page.getByText(DOWN).first()).toBeVisible({ timeout: 40_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
}

test('falls back to the second RPC when the first is down', async ({ page }) => {
  await page.route(/base-sepolia-rpc\.publicnode\.com/, (r) => r.abort())
  await page.goto('/check/INC-0001')
  await expect(page.getByTestId('verdict')).toContainText('✓ Genuine record')
})

test('a percent sign in the receipt number does not crash the page', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Receipt number').fill('100%')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByTestId('verdict')).toContainText('✗ No such record')
})

test('treasurer is not called a non-treasurer when the role lookup fails', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { ethereum: unknown }).ethereum = {
      on: () => {},
      removeListener: () => {},
      async request({ method }: { method: string }) {
        if (/^eth_(requestA|a)ccounts$/.test(method)) return ['0xDe0d0a1A8C908Cb9a05B607bF36A293Cf5B0594a']
        if (method === 'eth_chainId') return '0x14a34'
        if (method.startsWith('wallet_')) return []
        throw new Error('read-only')
      },
    }
  })
  await page.goto('/manage')
  await page.route(RPC, (r) => r.abort())
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByText(DOWN)).toBeVisible({ timeout: 40_000 })
  await expect(page.getByText("You're not a treasurer", { exact: false })).toHaveCount(0)
})

async function layoutShift(page: Page, path: string, ready: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { cls: number }
    w.cls = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) w.cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto(path)
  await expect(page.getByTestId(ready).first()).toBeVisible()
  await page.waitForTimeout(1500)
  return page.evaluate(() => (window as unknown as { cls: number }).cls)
}

for (const [path, ready] of [['/', 'entry-card'], ['/ledger', 'entry-card'], ['/check/EXP-0002', 'verdict']]) {
  test(`${path}: layout shift under 0.1`, async ({ page }) => {
    const cls = await layoutShift(page, path, ready)
    console.log(`CLS ${path} = ${cls.toFixed(4)}`)
    expect(cls).toBeLessThan(0.1)
  })
}
