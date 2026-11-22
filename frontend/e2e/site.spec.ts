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
  await expect(page.getByRole('heading', { name: /every dirham, on the record/ })).toBeVisible()
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

test('search box navigates to the verdict page (trim + uppercase)', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Receipt number').fill('  inc-0001 ')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page).toHaveURL(/\/check\/INC-0001$/)
  await expect(page.getByTestId('verdict')).toContainText('✓ Genuine record')
})

for (const code of ['EXP-0002', 'exp-0002']) {
  test(`/check/${code} shows Corrected with both versions and the reason`, async ({ page }) => {
    await page.goto(`/check/${code}`)
    const v = page.getByTestId('verdict')
    await expect(v).toContainText('Corrected — see what changed')
    await expect(v).toContainText('1 correction')
    await expect(page.getByText(/420\.00/).first()).toBeVisible()
    await expect(page.getByText(/380\.00/).first()).toBeVisible()
    await expect(page.getByText('Vendor refunded AED 40 for undelivered items')).toBeVisible()
    await expect(page.getByText('Original — kept forever')).toBeVisible()
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
  await expect(page.getByTestId('verdict')).toContainText('✓ Genuine record')
  await expect(page.getByTestId('verdict')).toContainText('Recorded by Treasurer')
  await noHorizontalScroll(page)
  await shot(page, 'check-INC-0001-genuine')
})

test('/check/XYZ-1 shows No such record', async ({ page }) => {
  await page.goto('/check/XYZ-1')
  await expect(page.getByTestId('verdict')).toContainText('✗ No such record')
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
  await expect(page.getByText('Connect a wallet to add entries (not needed to check).')).toBeVisible()
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
