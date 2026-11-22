// LOCAL ONLY (anvil, chain id 84532): drives the /manage write flow with a stand-in browser wallet that forwards
// to anvil with impersonated accounts. Never run against production — it posts EXP-0007.
// LOCAL_RPC=http://127.0.0.1:8545 ADDR_ADMIN=… ADDR_TREASURER=… ADDR_RANDOM=… BASE_URL=http://localhost:4173 npx playwright test manage.local
import { expect, test, type Page } from '@playwright/test'

const RPC = process.env.LOCAL_RPC
test.skip(!RPC, 'LOCAL_RPC not set — local-only suite')

async function rpc(method: string, params: unknown[] = []) {
  const r = await fetch(RPC!, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  return (await r.json()).result
}

async function asWallet(page: Page, address: string) {
  await rpc('anvil_impersonateAccount', [address])
  await page.addInitScript(
    ({ address, rpcUrl }) => {
      let id = 0
      const listeners: Record<string, ((...a: unknown[]) => void)[]> = {}
      ;(window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        on: (e: string, f: (...a: unknown[]) => void) => ((listeners[e] ??= []).push(f)),
        removeListener: () => {},
        async request({ method, params }: { method: string; params?: unknown[] }) {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [address]
          if (method === 'eth_chainId') return '0x14a34'
          if (method === 'net_version') return '84532'
          if (method.startsWith('wallet_')) return null
          const res = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }) })
          const j = await res.json()
          if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data })
          return j.result
        },
      }
    },
    { address, rpcUrl: RPC! },
  )
}

async function connect(page: Page, path = '/manage') {
  await page.goto(path)
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByTestId('role-banner')).toBeVisible()
}

test('random member: refusal card, proof link, and Send it anyway lands a failed tx', async ({ page }) => {
  await asWallet(page, process.env.ADDR_RANDOM!)
  await connect(page, '/manage?demo=1')
  await expect(page.getByTestId('role-banner')).toContainText("You aren't a treasurer, so you can't add entries.")
  await page.getByLabel('Amount (AED)').fill('500')
  await page.getByRole('button', { name: 'Record it' }).click()
  const card = page.getByTestId('refusal-card')
  await expect(card).toContainText("Blocked by the club's rulebook")
  await expect(card).toContainText("This wallet isn't an authorised treasurer, so the club's rulebook refused it.")
  await expect(card).toContainText('Nobody can switch it off.')
  await expect(card.getByRole('link', { name: 'See a past refusal like this on BaseScan' })).toHaveAttribute('href', /sepolia\.basescan\.org\/tx\/0x/)
  await card.getByRole('button', { name: 'Send it anyway' }).click()
  const link = card.getByRole('link', { name: 'View your refused attempt on BaseScan' })
  await expect(link).toBeVisible()
  const hash = (await link.getAttribute('href'))!.split('/tx/')[1]
  const receipt = await rpc('eth_getTransactionReceipt', [hash])
  expect(receipt.status).toBe('0x0')
})

test('no Send-it-anyway button without ?demo=1', async ({ page }) => {
  await asWallet(page, process.env.ADDR_RANDOM!)
  await connect(page)
  await page.getByLabel('Amount (AED)').fill('500')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(page.getByTestId('refusal-card')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send it anyway' })).toHaveCount(0)
})

test('admin: Club Advisor banner and authorise panel', async ({ page }) => {
  await asWallet(page, process.env.ADDR_ADMIN!)
  await connect(page)
  await expect(page.getByTestId('role-banner')).toContainText("You're the Club Advisor. You approve treasurers but can't add money.")
  await expect(page.getByRole('heading', { name: 'Authorise or revoke a treasurer' })).toBeVisible()
  await page.getByLabel('Wallet address').fill(process.env.ADDR_TREASURER!)
  await expect(page.getByTestId('addr-status')).toContainText('Currently an authorised treasurer: Treasurer')
  await expect(page.getByRole('button', { name: 'Revoke' })).toBeVisible()
  await expect(page.getByText('Record money')).toHaveCount(0)
})

test('treasurer: duplicate receipt refused, then EXP-0007 recorded and verifiable', async ({ page }) => {
  await asWallet(page, process.env.ADDR_TREASURER!)
  await connect(page)
  await expect(page.getByTestId('role-banner')).toContainText("You're the Treasurer. You can add and correct entries.")
  await expect(page.locator('#ref')).toHaveValue('EXP-0007')
  // duplicate → rule 3
  await page.getByLabel('Amount (AED)').fill('10')
  await page.locator('#ref').fill('EXP-0001')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(page.getByTestId('refusal-card')).toContainText('A receipt can only be recorded once.')
  // valid post
  await page.locator('#ref').fill('EXP-0007')
  await page.getByLabel('Amount (AED)').fill('250')
  await page.getByLabel('Paid to').fill('Circuit Souk (fictional)')
  await page.getByRole('button', { name: 'Record it' }).click()
  await expect(page.getByText('Recorded. View public proof')).toBeVisible()
  await page.goto('/check/EXP-0007')
  await expect(page.getByTestId('verdict')).toContainText('Genuine record')
  await expect(page.getByText(/250\.00/).first()).toBeVisible()
})

test('treasurer: correct form loads the latest version', async ({ page }) => {
  await asWallet(page, process.env.ADDR_TREASURER!)
  await connect(page)
  await page.getByPlaceholder('e.g. EXP-0002').fill('exp-0002')
  await page.getByRole('button', { name: 'Load' }).click()
  await expect(page.getByLabel('New amount (AED)')).toHaveValue('380.00')
  await page.getByLabel('New amount (AED)').fill('370')
  await page.getByRole('button', { name: 'Add correction' }).click()
  await expect(page.getByTestId('refusal-card')).toContainText('Check the highlighted field.') // reason required
  await page.getByLabel('Reason for the correction (required)').fill('Second refund of AED 10')
  await page.getByRole('button', { name: 'Add correction' }).click()
  await expect(page.getByText('Recorded. View public proof')).toBeVisible()
  await page.goto('/check/EXP-0002')
  await expect(page.getByTestId('version')).toHaveCount(3)
})
