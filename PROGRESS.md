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

## Phase 1 — Wallets and funding — ⏳ waiting on H3 (faucet) / H2 (Etherscan key)

Throwaway testnet wallets (keys only in git-ignored `contracts/.env`):

| Role | Address |
|---|---|
| Admin (Club Advisor) | 0x76b76eD71c729333550E0a38b0d43d4A85Facf15 |
| Treasurer | 0xDe0d0a1A8C908Cb9a05B607bF36A293Cf5B0594a |
| Asst. Treasurer | 0xec1FDFE6D7858E054EbF6Ff91ae85d8D2c3B4Fff |
| Random member | 0x0866D39D9c6f741aC480Add2809B88820Ae5872E |

- `git check-ignore contracts/.env` → `contracts/.env` ✓
- Pre-push guard: `scripts/check-secrets.sh` (checks .env is ignored and greps tracked files + `frontend/dist` for every PK_/API-key value).
- **H3:** fund Admin with ≥ 0.02 Base Sepolia ETH. **H2:** fill `ETHERSCAN_API_KEY` in `contracts/.env`.

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

## Phase 4 — Read-only frontend — 🟡 built and deployed; gate waits on the live contract (Phase 3)

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
