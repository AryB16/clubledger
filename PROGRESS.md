# ClubLedger — PROGRESS

## Submission pack
_(filled in Phase 7)_

---

## Phase 0 — Environment and repo — ✅ PASSED

**Tool versions**
- Node v22.23.1 · npm 10.9.8
- git 2.50.1 (Apple Git-155)
- Foundry: forge / cast / anvil 1.10.0 (083e229941, installed via foundryup)
- gh 2.104.0 (logged in as AryB16)
- Vercel CLI 65.16.0 (logged in as aryb16)

**RPCs (`cast chain-id`, all returned 84532)**
- https://sepolia.base.org ← `BASE_SEPOLIA_RPC` (contracts)
- https://base-sepolia-rpc.publicnode.com ← `VITE_RPC_URL` (frontend primary)
- https://base-sepolia.drpc.org
- https://base-sepolia.gateway.tenderly.co
- https://84532.rpc.thirdweb.com

**Decisions**
- Repo: `clubledger` (public).
- Frontend primary RPC = publicnode, fallback = sepolia.base.org, so the site doesn't rely on the same endpoint the scripts use.

**Gate 0 evidence**
- `gh repo create` → see repo link below
- all tools print versions (above); 5/5 RPCs → 84532

Repo: https://github.com/AryB16/clubledger

---

## Phase 1 — Wallets and funding — ✅ PASSED

Throwaway testnet wallets (keys only in git-ignored `contracts/.env`):

| Role | Address |
|---|---|
| Admin (Club Advisor) | 0x76b76eD71c729333550E0a38b0d43d4A85Facf15 |
| Treasurer | 0xDe0d0a1A8C908Cb9a05B607bF36A293Cf5B0594a |
| Asst. Treasurer | 0xec1FDFE6D7858E054EbF6Ff91ae85d8D2c3B4Fff |
| Random member | 0x0866D39D9c6f741aC480Add2809B88820Ae5872E |

- `git check-ignore contracts/.env` → `contracts/.env` ✓
- Pre-push guard: `scripts/check-secrets.sh` (checks .env is ignored and greps tracked files + `frontend/dist` for every PK_/API-key value).
- **H3 done:** Admin holds 0.02 Base Sepolia ETH (nonce 0), confirmed on two RPCs.
- **Change to step 4, done by Aryesh:** sent 0.004 ETH from Admin to each of the other three wallets. Claude Code does not send ETH, testnet included.
- **H2 done:** `ETHERSCAN_API_KEY` is set in `contracts/.env` (value never printed).

**Gate 1 evidence**
- `cast balance` on sepolia.base.org and publicnode: Admin 0.0079996 (nonce 3), Treasurer 0.004, Asst. Treasurer 0.004, Random member 0.004.
- `git check-ignore contracts/.env` → `contracts/.env`; `scripts/check-secrets.sh` → OK.
- **Project move done:** now at `~/Documents/clubledger/clubledger`. `contracts/.env`, `.git` and `.gitmodules` were skipped by the app and restored (`.env` copy byte-identical, git-ignored, all 4 keys match their addresses). Run `npm ci` in `frontend/` before the next build.

---

## Phase 2 — Contract and tests — ✅ PASSED

**Decisions**
- `via_ir = true` in `foundry.toml`: `correctEntry` hit "stack too deep" with the legacy pipeline (4 calldata strings + struct push). IR pipeline compiles it without changing the logic.
- `summary()` return values are named `name, adminAddr, bal, income, expense, count` instead of the SPEC names to avoid shadowing the state variables (compiler warnings). Same types and order, same selector.
- Seed corrections keep each original's category / counterparty / description (SPEC table leaves them blank).
- forge-std is a test/script dependency only; `ClubLedger.sol` has no imports.

**Gate 2 evidence**
- `forge test -vv` → **29 tests passed, 0 failed** (28 unit + 1 invariant suite with 3 invariants; 256 runs × 64 depth = 16,384 handler calls).
- Local anvil rehearsal: Deploy → Seed (`require(balance == 458000)` passed) → `summary()` = `("BITS Dubai Robotics Club (demo)", admin, 458000, 945000, 487000, 12)`; `versionsOf("EXP-0002")` = `[5, 11]`.

**Self-review vs SPEC §2.2 / §2.5**
- ✓ constructor sets `admin = msg.sender`, `clubName`
- ✓ authorizePoster check order: admin → address(0) → admin-self → already poster → label 1–32
- ✓ revokePoster: admin → is poster; label kept
- ✓ postEntry check order: poster → amount>0 → `_validRef` (1–16, A–Z 0–9 -) → ref unused → category 1–32 → counterparty ≤64 & description ≤280 → expense ≤ balance
- ✓ postEntry effects: Income `balance += , totalIncome +=`; Expense `balance -= , totalExpense +=`; push with correctsId 0, reason "", uint64 timestamp; set idByRef; emit EntryPosted
- ✓ correctEntry order: poster → exists → not already corrected → reason (empty "Reason required", >140 "Text too long") → category / text caps
- ✓ correction math exactly §2.2 step 6, checked before subtracting (Income `balance + new >= old`; Expense `new <= balance + old`)
- ✓ correction inherits kind + refCode, sets correctsId, correctedBy; idByRef untouched; emits EntryCorrected
- ✓ reads: entryCount, getEntry (reverts out of range), getEntries (cap 50, 0/>len empty, clamp), versionsOf (original→latest), summary
- ✓ all 17 revert strings byte-identical to §2.5; each one triggered by `vm.expectRevert(bytes("…"))` at least once
- ✓ no `payable` / `receive` / `fallback`; no external calls; no imports
- ✓ storage exactly §2.1 (no extra fields); Entry structs never modified after push

---

## Phase 3 — Deploy, seed, proofs — ✅ PASSED (BaseScan verification logged for retry)

- Contract: [`0x210312F9C553a02A9864CC9685854A72d49D4F7e`](https://sepolia.basescan.org/address/0x210312F9C553a02A9864CC9685854A72d49D4F7e)
- Deploy tx `0x2582fd6b3a46e58f283b42cb7939d9038c39f09bf6c4ff1c529bf1c236b8f863`, block 61941981. Every seed and proof tx: DEPLOYMENT.md.

**Gate 3 evidence**
- `cast call summary()` on two RPCs → 458000 / 945000 / 487000, 12 entries.
- `versionsOf("EXP-0002")` → [5, 11]; EXP-0004 → [7, 12]; EXP-0007 → [] (kept for the live demo).
- 4 refusal receipts → status 0x0. Each replayed with `eth_call` at the previous block → exact expected revert string (28–34k gas used of 300k, so none is an out-of-gas failure).
- **BaseScan verification FAILED, logged for retry:** `forge script --verify` and one `forge verify-contract` both failed resolving `api.etherscan.io`. The local router DNS (192.168.1.1) returns NXDOMAIN; 1.1.1.1 and 8.8.8.8 resolve it. The key and source were never tested by Etherscan.
- Sourcify (submitted automatically by `forge --verify`) → creation and runtime **exact match**. Whether BaseScan displays that source was not checked: its bot check blocks automated viewing.

---

## Phase 4 — Read-only frontend — ✅ PASSED

- Production URL: **https://clubledger-kappa.vercel.app** (Vercel project `clubledger`, root `frontend/`, `VITE_RPC_URL` = publicnode set for production).
- `curl` → 200 for `/`, `/ledger`, `/check/EXP-0002`, `/manage` (SPA rewrite works).
- Rehearsed against local anvil (chain id 84532, Multicall3 copied in): 9/10 Playwright site checks passed (only failure: proof hashes still placeholders) and 5/5 local `/manage` write-flow checks passed (refusal card, Send it anyway → status 0, admin panel, treasurer post, correction).
- `scripts/check-refusals.mjs` → all 12 assertions passed locally.

**Decisions**
- Frontend primary RPC publicnode (CORS `*`), fallback sepolia.base.org (CORS OK). Reads batched through Multicall3.
- "Treasurers on the record" list in the admin panel is derived from entry posters (no event logs, no extra storage); any address can be typed in to see whether it is a current / former / non-treasurer.
- Role banner is a plain top banner, not sticky (sticky overlapped content on a 375 px phone).
- `refusals.ts` imports `../proofs.ts` with the extension so the Node check script can import it directly (Node type stripping).
- Local-only Playwright suite `e2e/manage.local.spec.ts` uses a stand-in browser wallet over anvil; it is skipped unless `LOCAL_RPC` is set, so it never posts to production.

**Gate 4 evidence (production)**
- `curl` → 200 for `/`, `/ledger`, `/check/EXP-0002`, `/manage`.
- `BASE_URL=https://clubledger-kappa.vercel.app npx playwright test` at 375×812 → **23 passed, 0 failed, 5 skipped** (the skips are the local-only suite that posts transactions). Covers all five verdict cases, AED 4,580.00, 8 proof links, and `scrollWidth <= 375` on the pages listed in the gate.
- Screenshots in `docs/screenshots/` are now all from production.

---

## Phase 5 — Manage page and refusal card — ✅ PASSED

**Fixed before the production deploy**
- `/check/:code` URL-decoded twice and crashed on input such as `100%`.
- A failed role lookup was shown as "You're not a treasurer"; it now shows the RPC-down message.
- Lists no longer blank out while a newly recorded entry loads.

**Gate 5 evidence**
- Vitest → 90 passed. `tsc -b --force` → 0 errors.
- `node scripts/check-refusals.mjs` against the deployed contract → all 12 assertions passed; nothing sent.
- Playwright on production `/manage`: no-wallet copy, the three role banners, and refusal cards for rules 1–3 linking to their own proofs, using a read-only stand-in wallet that cannot sign or send.
- No private key or API key in `frontend/dist` or in the JS bundle downloaded from production.
- **Not tested:** real MetaMask. "Send it anyway" and successful writes were exercised on local anvil only (human checklist).

---

## Phase 6 — Polish, docs, printables — ✅ PASSED

**Decisions**
- SPEC §4.6 gives the AI-disclosure sentence "I reviewed every contract line and every test". That is Aryesh's own attestation, so WHO_DID_WHAT.md carries it as two unticked boxes for Aryesh to confirm, and says plainly what Claude Code ran.
- README says "Sourcify: exact match (BaseScan verification pending)" instead of "verified on BaseScan".
- NOTE.md adds a limit: the admin could authorise a second wallet of their own.

**Gate 6 evidence**
- Final redeploy, then full Playwright suite on production → 23 passed, 0 failed, 5 skipped (local-only).
- RPC-down message on all 3 public pages; fallback RPC works; layout shift below 0.1 on all 3.
- `docs/receipts.html` opens with 3 receipts and 3 loaded QR images. The PNGs were decoded with macOS CoreImage → exact production URLs.
