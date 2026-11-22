// Integration check (NOT bundled into the site): simulates calls against the DEPLOYED contract — sends nothing.
// Usage: node scripts/check-refusals.mjs            (reads ../contracts/.env)
//        RPC=http://127.0.0.1:8545 CLUBLEDGER_ADDRESS=0x… node scripts/check-refusals.mjs
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { extractRevertReason, refusalCopy } from '../src/lib/refusals.ts'

const here = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(here, '../../contracts/.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const RPC = process.env.RPC || env.BASE_SEPOLIA_RPC
const ADDRESS = process.env.CLUBLEDGER_ADDRESS || env.CLUBLEDGER_ADDRESS
const { abi } = JSON.parse(readFileSync(resolve(here, '../src/abi/ClubLedger.json'), 'utf8'))
const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) })
// Only the public addresses are derived from the keys; nothing is signed or sent.
const who = (k) => privateKeyToAccount(env[k]).address
const admin = who('PK_ADMIN'), treasurer = who('PK_TREASURER'), random = who('PK_RANDOM')

const SPEC_COPY = {
  'Not an authorised poster': "This wallet isn't an authorised treasurer, so the club's rulebook refused it.",
  'Expense exceeds club balance': "The club's books don't have enough money recorded for this expense. The books can never go negative.",
  'Reference code already used': 'This receipt number has already been recorded. A receipt can only be recorded once.',
  'Entry already corrected - correct the latest version': 'This version has already been corrected. Correct the newest version instead.',
}

const [exp2Original] = await client.readContract({ address: ADDRESS, abi, functionName: 'versionsOf', args: ['EXP-0002'] })
const exp7 = await client.readContract({ address: ADDRESS, abi, functionName: 'versionsOf', args: ['EXP-0007'] })

const post = (account, kind, fils, ref) => ({ account, functionName: 'postEntry', args: [kind, fils, 'Equipment', 'Check script', 'simulation only', ref] })
const cases = [
  ['Random member postEntry', post(random, 1, 50000n, 'EXP-9001'), 'Not an authorised poster'],
  ['Admin postEntry', post(admin, 0, 50000n, 'INC-9001'), 'Not an authorised poster'],
  ['Treasurer expense of 5,000,000 fils', post(treasurer, 1, 5000000n, 'EXP-9002'), 'Expense exceeds club balance'],
  ['Treasurer re-posts INC-0001', post(treasurer, 0, 500000n, 'INC-0001'), 'Reference code already used'],
  [`Treasurer corrects original EXP-0002 (id ${exp2Original})`, { account: treasurer, functionName: 'correctEntry', args: [exp2Original, 1000n, 'Events', '', '', 'again'] }, 'Entry already corrected - correct the latest version'],
  ['Treasurer valid EXP-0007, AED 250.00', post(treasurer, 1, 25000n, 'EXP-0007'), null],
]

let failed = 0
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++ }
console.log(`Contract ${ADDRESS} via ${RPC}\n`)
ok(exp7.length === 0, 'EXP-0007 is still unused (saved for the live demo)')
for (const [name, call, expected] of cases) {
  try {
    await client.simulateContract({ address: ADDRESS, abi, ...call })
    ok(expected === null, `${name} → simulation succeeds${expected ? ` (expected "${expected}")` : ''}`)
  } catch (err) {
    const reason = extractRevertReason(err)
    ok(reason === expected, `${name} → "${reason}"${reason === expected ? '' : ` (expected ${expected === null ? 'success' : `"${expected}"`})`}`)
    if (expected) ok(refusalCopy(reason) === SPEC_COPY[expected], `   refusals.ts maps it to the SPEC copy`)
  }
}
console.log(failed ? `\n${failed} assertion(s) FAILED` : '\nAll assertions passed')
process.exit(failed ? 1 : 0)
