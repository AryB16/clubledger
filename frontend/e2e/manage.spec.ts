// Safe on production: a READ-ONLY stand-in wallet. It knows only public addresses, holds no keys,
// and rejects every method outside a read allowlist, so nothing can be signed or sent.
import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'

const WHO = {
  admin: '0x76b76eD71c729333550E0a38b0d43d4A85Facf15',
  treasurer: '0xDe0d0a1A8C908Cb9a05B607bF36A293Cf5B0594a',
  random: '0x0866D39D9c6f741aC480Add2809B88820Ae5872E',
}
const shot = (page: Page, name: string) =>
  page.screenshot({ path: resolve(import.meta.dirname, `../../docs/screenshots/${name}.png`), fullPage: true })

async function connectAs(page: Page, address: string, path = '/manage') {
  await page.addInitScript((address) => {
    const w = window as unknown as { ethereum: unknown; blocked: string[] }
    w.blocked = []
    w.ethereum = {
      isMetaMask: true,
      on: () => {},
      removeListener: () => {},
      async request({ method }: { method: string }) {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [address]
        if (method === 'eth_chainId') return '0x14a34'
        if (method === 'net_version') return '84532'
        if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions' || method === 'wallet_revokePermissions') return []
        w.blocked.push(method)
        throw Object.assign(new Error('User rejected the request.'), { code: 4001 })
      },
    }
  }, address)
  await page.goto(path)
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByTestId('role-banner')).toBeVisible()
}

async function nothingSent(page: Page) {
  const blocked = await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)
  expect(blocked.filter((m) => /send|sign/i.test(m))).toEqual([])
}

test('random member on ?demo=1: blocked card links to the rule 1 proof', async ({ page }) => {
  await connectAs(page, WHO.random, '/manage?demo=1')
  await expect(page.getByTestId('role-banner')).toContainText("You aren't a treasurer, so you can't add entries.")
  await page.getByLabel('Amount (AED)').fill('500')
  await page.getByRole('button', { name: 'Record it' }).click()
  const card = page.getByTestId('refusal-card')
  await expect(card).toContainText("Blocked by the club's rulebook")
  await expect(card).toContainText("This wallet isn't an authorised treasurer, so the club's rulebook refused it.")
  await expect(card.getByRole('link', { name: 'See a past refusal like this on BaseScan' })).toHaveAttribute('href', /0xd257bd63/)
  await expect(card.getByRole('button', { name: 'Send it anyway' })).toBeVisible()
  await expect(card).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await shot(page, 'manage-refusal-card')
  await nothingSent(page)
})

test('without ?demo=1 there is no Send it anyway', async ({ page }) => {
  await connectAs(page, WHO.random)
  await page.getByLabel('Amount (AED)').fill('500')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(page.getByTestId('refusal-card')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send it anyway' })).toHaveCount(0)
  await nothingSent(page)
})

test('the Demo mode switch adds Send it anyway and keeps it in the address', async ({ page }) => {
  await connectAs(page, WHO.random)
  const toggle = page.getByRole('switch', { name: 'Demo mode' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page).toHaveURL(/\/manage\?demo=1$/)
  await page.getByLabel('Amount (AED)').fill('500')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(page.getByRole('button', { name: 'Send it anyway' })).toBeVisible()
  await toggle.click()
  await expect(page).toHaveURL(/\/manage$/)
  await expect(page.getByRole('button', { name: 'Send it anyway' })).toHaveCount(0)
  await nothingSent(page)
})

test('treasurer: overspend and duplicate are blocked with their own proofs', async ({ page }) => {
  await connectAs(page, WHO.treasurer)
  await expect(page.getByTestId('role-banner')).toContainText("You're the Treasurer. You can add and correct entries.")
  await expect(page.locator('#ref')).toHaveValue('EXP-0007')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await shot(page, 'manage-treasurer')
  const card = page.getByTestId('refusal-card')
  await page.getByLabel('Amount (AED)').fill('50,000')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(card).toContainText('The books can never go negative.')
  await expect(card.getByRole('link', { name: 'See a past refusal like this on BaseScan' })).toHaveAttribute('href', /0x09a7394a/)
  await page.locator('#ref').fill('INC-0001')
  await page.getByLabel('Amount (AED)').fill('10')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(card).toContainText('A receipt can only be recorded once.')
  await expect(card.getByRole('link', { name: 'See a past refusal like this on BaseScan' })).toHaveAttribute('href', /0xfc4b3fec/)
  await nothingSent(page)
})

test('admin: advisor banner, authorise panel, no money form', async ({ page }) => {
  await connectAs(page, WHO.admin)
  await expect(page.getByTestId('role-banner')).toContainText("You're the Club Advisor. You approve treasurers but can't add money.")
  await page.getByLabel('Wallet address').fill(WHO.treasurer)
  await expect(page.getByTestId('addr-status')).toContainText('Currently an authorised treasurer: Treasurer')
  await expect(page.getByTestId('record-form')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await shot(page, 'manage-admin')
  await nothingSent(page)
})
