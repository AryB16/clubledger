// Reads the Base Sepolia broadcast output + proofs.json and writes frontend/src/proofs.ts and DEPLOYMENT.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const chain = process.env.CHAIN_ID || '84532'
const EXPLORER = 'https://sepolia.basescan.org'
const deploy = JSON.parse(readFileSync(resolve(here, `../broadcast/Deploy.s.sol/${chain}/run-latest.json`), 'utf8'))
const seed = JSON.parse(readFileSync(resolve(here, `../broadcast/Seed.s.sol/${chain}/run-latest.json`), 'utf8'))
const refused = JSON.parse(readFileSync(resolve(here, '../proofs.json'), 'utf8'))

const dtx = deploy.transactions.find((t) => t.transactionType === 'CREATE')
const address = dtx.contractAddress
const dreceipt = deploy.receipts.find((r) => r.transactionHash === dtx.hash)
const block = parseInt(dreceipt.blockNumber, 16)

const rows = seed.transactions.map((t) => {
  const a = t.arguments
  let label
  if (t.function.startsWith('authorizePoster')) label = `Authorise "${a[1]}" (${a[0]})`
  else if (t.function.startsWith('postEntry')) label = `Post ${a[5]} (${a[0] === '0' ? 'Income' : 'Expense'}, AED ${(Number(a[1]) / 100).toFixed(2)})`
  else label = `Correct entry #${a[0]} → AED ${(Number(a[1]) / 100).toFixed(2)} ("${a[5]}")`
  const rc = seed.receipts.find((r) => r.transactionHash === t.hash)
  return { fn: t.function, args: a, hash: t.hash, label, ok: rc ? rc.status === '0x1' : null }
})
const find = (pred) => rows.find(pred)?.hash
const inc1 = find((r) => r.fn.startsWith('postEntry') && r.args[5] === 'INC-0001')
const exp1 = find((r) => r.fn.startsWith('postEntry') && r.args[5] === 'EXP-0001')
const c1 = rows.filter((r) => r.fn.startsWith('correctEntry'))[0]?.hash
const auth = find((r) => r.fn.startsWith('authorizePoster') && r.args[1] === 'Treasurer')
for (const [k, v] of Object.entries({ inc1, exp1, c1, auth, ...refused })) if (!/^0x[0-9a-f]{64}$/.test(v ?? '')) throw new Error(`missing ${k}`)

// proofs.ts — keep its shape, swap in the real hashes.
const p = resolve(root, 'frontend/src/proofs.ts')
let src = readFileSync(p, 'utf8')
const hashes = {
  1: [inc1, refused.rule1_refused],
  2: [exp1, refused.rule2_refused],
  3: [inc1, refused.rule3_refused],
  4: [c1, refused.rule4_refused],
}
const blocks = src.split(/(?=\n  \{\n    rule: )/)
src = blocks
  .map((b) => {
    const m = /rule: (\d)/.exec(b)
    if (!m) return b
    const [pass, ref] = hashes[m[1]]
    return b.replace(/passedTx: [^,]+,/, `passedTx: '${pass}',`).replace(/refusedTx: [^,]+,/, `refusedTx: '${ref}',`)
  })
  .join('')
src = src.replace(/\nconst PENDING = .*\n/, '\n')
writeFileSync(p, src)

const L = (h) => `[\`${h.slice(0, 10)}…\`](${EXPLORER}/tx/${h})`
const md = `# Deployment — Base Sepolia (chain 84532)

| | |
|---|---|
| Contract | [\`${address}\`](${EXPLORER}/address/${address}) |
| Deploy tx | ${L(dtx.hash)} |
| Deploy block | ${block} |
| Admin (Club Advisor) | \`${dtx.transaction.from}\` |
| Live site | https://clubledger-kappa.vercel.app |

## Headline proofs (SPEC §2.9)

| Rule | ✓ Passed | ✗ Refused (reverted on-chain) |
|---|---|---|
| 1 Only authorised treasurers can record money | ${L(inc1)} INC-0001 posted by Treasurer | ${L(refused.rule1_refused)} Random member posts EXP-9001 → \`Not an authorised poster\` |
| 2 The books can never go negative | ${L(exp1)} EXP-0001 posted | ${L(refused.rule2_refused)} Treasurer posts EXP-9002 for AED 50,000 → \`Expense exceeds club balance\` |
| 3 A receipt can only be recorded once | ${L(inc1)} INC-0001 posted | ${L(refused.rule3_refused)} Treasurer re-posts INC-0001 → \`Reference code already used\` |
| 4 No edits — only corrections | ${L(c1)} EXP-0002 corrected 420 → 380 | ${L(refused.rule4_refused)} Treasurer corrects the original EXP-0002 again → \`Entry already corrected - correct the latest version\` |

Treasurer authorisation: ${L(auth)}

## Every seed transaction

| # | Action | Tx | Status |
|---|---|---|---|
${rows.map((r, i) => `| ${i + 1} | ${r.label} | ${L(r.hash)} | ${r.ok === null ? '?' : r.ok ? '✓' : '✗'} |`).join('\n')}
`
writeFileSync(resolve(root, 'DEPLOYMENT.md'), md)
console.log(JSON.stringify({ address, block, deployTx: dtx.hash, inc1, exp1, c1, auth, ...refused }, null, 2))
