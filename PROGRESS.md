# ClubLedger — PROGRESS

## Submission pack

- **Repo:** https://github.com/AryB16/clubledger
- **Live URL:** https://clubledger-kappa.vercel.app
- **Contract (Base Sepolia):** `0x210312F9C553a02A9864CC9685854A72d49D4F7e`
  - BaseScan, verified source: https://sepolia.basescan.org/address/0x210312F9C553a02A9864CC9685854A72d49D4F7e#code
  - Verified source, Sourcify exact match: https://sourcify.dev/server/v2/contract/84532/0x210312F9C553a02A9864CC9685854A72d49D4F7e
- **Successful transactions**
  - Treasurer authorisation: https://sepolia.basescan.org/tx/0x95043c0bd4a1f27d559d2cac015da03dc18e0feea24e8ac336fe6e721c9d8556
  - INC-0001 post: https://sepolia.basescan.org/tx/0xec9f42c3aee54860222a41fbdc8ee11d7fe9b0eaf7d12e4306751dc0fff9773d
- **Refused transactions (status 0)**
  - Rule 1, not an authorised treasurer: https://sepolia.basescan.org/tx/0xd257bd631b24a9cc76984cabc3e6a0a90cc63a8818d7441089be5df9fb6ce540
  - Rule 2, books never negative: https://sepolia.basescan.org/tx/0x09a7394a12ace66719cd6039ab7888a9f550612ea62e7b6259c3f2395fa166dd
  - Rule 3, receipt recorded once: https://sepolia.basescan.org/tx/0xfc4b3fec2641bcde6acdbbebf34bc67dc20de5c8f1e21034e63397ba556bd8ba
  - Rule 4, no edits, only corrections: https://sepolia.basescan.org/tx/0x292a91339f29dc1b3cdabc6b1ade0bfbfed476085e559f2016f555e4b305a96d
- **Note:** https://github.com/AryB16/clubledger/blob/main/NOTE.md
- **Who did what:** https://github.com/AryB16/clubledger/blob/main/WHO_DID_WHAT.md

## Human checklist (H4)

- [x] Verify on BaseScan (done 22 Nov; evidence at the end of Phase 7).
- [x] Who did what: Aryesh chose a one-line note on AI-assisted development (23 Nov); the review boxes are gone.
- [ ] Import Admin, Treasurer and Asst. Treasurer private keys from `contracts/.env` into MetaMask (named "Advisor (admin)", "Treasurer", "Asst. Treasurer"), Base Sepolia network.
- [ ] Create a second Chrome profile; import Random member there only (this is the judge's "attacker" browser).
- [x] (reported by Aryesh, 22 Nov) On your phone (mobile data): open the three receipt QR codes; confirm Corrected / Cancelled / Genuine.
- [x] Live test as Random member on `/manage?demo=1`: blocked card appears; "Send it anyway" creates a failed tx on BaseScan.
- [ ] Stranger test: hand your phone to someone, say only "Check receipt EXP-0002".
- [ ] Ask 3 mentors (log in WHO_DID_WHAT.md): correction model; UX confusion; pitch dry-run.
- [ ] Record the ≤ 3-min video (SPEC §4 item 5).
- [ ] Print `docs/receipts.html`.
- [ ] Submit all 6 items by **Mon night**; hard stop Tue 13:00.
- [ ] Do NOT post EXP-0007 before judging — it's the live demo entry.

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
- **Change to step 4, done by Aryesh:** sent 0.004 ETH from Admin to each of the other three wallets.
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

## Phase 3 — Deploy, seed, proofs — ✅ PASSED (BaseScan verification first failed; resolved in Phase 7)

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
- WHO_DID_WHAT.md (updated 23 Nov, Aryesh's choice): one line says AI-assisted development was used, as the event permits, then lists what Aryesh did. SPEC §4.6 now says the same. CLAUDE.md is kept locally but no longer tracked.
- README said "Sourcify: exact match (BaseScan verification pending)" until verification succeeded on 22 Nov; it now links both.
- NOTE.md adds a limit: the admin could authorise a second wallet of their own.

**Gate 6 evidence**
- Final redeploy, then full Playwright suite on production → 23 passed, 0 failed, 5 skipped (local-only).
- RPC-down message on all 3 public pages; fallback RPC works; layout shift below 0.1 on all 3.
- `docs/receipts.html` opens with 3 receipts and 3 loaded QR images. The PNGs were decoded with macOS CoreImage → exact production URLs.

---

## Phase 7 — Final verification and hand-off — ✅ DONE (BaseScan verified 22 Nov)

**All gates re-run**
- G0: RPC → 84532; tools and repo OK.
- G1: 4 wallets non-zero; `.env` ignored.
- G2: fresh GitHub clone → 29 Foundry tests passed; anvil deploy + seed → 458000.
- G3: 458000 and 12 entries; EXP-0002 has 2 versions; EXP-0007 unused; 4 refusals status 0x0 with exact reasons.
- G4–G6: Playwright on production → 23 passed, 5 skipped (local-only); Vitest 90; check-refusals all passed; the local write-flow suite re-run on a fresh chain → 5 passed.
- Secrets: 0 key values in full git history, build or live bundle.

**BaseScan verification retried → failed again** (local DNS returns NXDOMAIN for `api.etherscan.io`). From another network (e.g. a phone hotspot):

```bash
cd ~/Documents/clubledger/clubledger/contracts && (set -a; . ./.env; set +a; ~/.foundry/bin/forge verify-contract 0x210312F9C553a02A9864CC9685854A72d49D4F7e src/ClubLedger.sol:ClubLedger --chain 84532 --verifier etherscan --watch --constructor-args 0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001f4249545320447562616920526f626f7469637320436c7562202864656d6f2900)
```

**22 Nov, Aryesh ran the command → same DNS error.** Only the API host fails on this network; `sepolia.basescan.org` resolves. Browser fallback (no API or key needed):

1. Open https://sepolia.basescan.org/verifyContract?a=0x210312F9C553a02A9864CC9685854A72d49D4F7e
2. Compiler type: Solidity (Standard-Json-Input) · version: `v0.8.24+commit.e11b9ed9` · licence: MIT
3. Upload `contracts/verify/ClubLedger.standard-input.json`.
4. Constructor arguments: paste `contracts/verify/constructor-args.txt` (skip if already filled), then submit.

Evidence: compiling that JSON with solc 0.8.24 gives the deployed runtime bytecode and the deploy transaction's creation bytecode exactly (checked on two RPCs); the remainder of the transaction input equals `constructor-args.txt`. 
**RESOLVED 22 Nov: verified on BaseScan by Aryesh.** Confirmed with a read-only Etherscan API `getsourcecode` query: `ClubLedger`, compiler v0.8.24+commit.e11b9ed9, EVM cancun, MIT, not a similar-match; source identical to `contracts/src/ClubLedger.sol`; constructor arguments identical to `contracts/verify/constructor-args.txt`.

---

## Post-hand-off: second production URL (22 Nov)

- MetaMask showed "Malicious site" on clubledger-kappa.vercel.app (reported by Aryesh; cause unknown).
- Compromise ruled out before any change: 39/39 deployed source files identical to git; live JS identical to a clean rebuild apart from chunk filenames; no unexpected hosts; no match in MetaMask's public phishing lists.
- Added https://clubledger-bpdc.vercel.app to the same Vercel project and redeployed HEAD from a clean export. Both URLs serve files identical to a clean local build; Playwright 23 passed, 5 skipped (local-only) on each.
- Not yet tested in MetaMask. README, NOTE, QR receipts and submission pack deliberately still use the old URL until Aryesh has tested the new one.
- Found: Vercel's GitHub integration has failed on every push seen (project root is `.`, the app is in `frontend/`, so `vite: command not found`). Only CLI deploys work, and a failed push build blocks adding domains. Not changed, pending Aryesh's decision. (The Phase 4 note "root `frontend/`" refers to the CLI deploy directory.)

**MetaMask test of the second URL (22 Nov): also flagged** at connect ("Malicious—flagged as unsafe"). A domain change does not fix it; no further domains will be tried.
- Checked: zero wallet requests on load on all four main pages (fresh session); Connect sends only `wallet_requestPermissions`, `eth_accounts`, `eth_chainId` when already on Base Sepolia.
- Review route: https://report.blockaid.io/verifiedProject (Developer), text in `docs/blockaid-report.txt`, submitted by Aryesh (pending). MetaMask says reviews may take several business days, so don't rely on it before the deadline.
- Fallback A: local preview on http://localhost:4173, same contract (23 browser tests passed; MetaMask's verdict on localhost not yet tested).
- Fallback B: `node frontend/scripts/check-refusals.mjs` proves the rules against the deployed contract without MetaMask or transactions.
- QR receipts and README stay on the kappa URL: switching gains nothing, and those pages need no wallet.

**Real MetaMask test on localhost:4173 (22 Nov 09:36 UTC): PASSED.** Aryesh reported no warnings or errors connecting or sending. On-chain: Random member → `postEntry` EXP-9100 → status reverted, "Not an authorised poster": https://sepolia.basescan.org/tx/0xdaf048b895b386468d0a4da9c5274914deb9cf8ab896086820eda077bfd368da
- Ledger unchanged on two RPCs (458000, 12 entries); EXP-0007 unused.
- No Treasurer transaction has been sent through MetaMask, so that profile still needs a connect + refusal rehearsal.
- Localhost is now the live-demo route; the Blockaid review is for the public /manage page.

**Treasurer rehearsal (22 Nov): PASSED.** Aryesh got the duplicate-receipt blocked card; Treasurer nonce still 12, 12 entries, nothing sent.

**Video vs live demo (proposed, awaiting Aryesh):** SPEC §4.5 needs a successful post on camera, but EXP-0007 is reserved for judging. Proposal: post INC-0005 (Money in, AED 100) in the video. It simulates OK and leaves the Money out prefill at EXP-0007. It permanently makes the balance 4,680.00 and 13 entries, so the two Playwright expectations (4,580 / 12) would need updating to the new real state, and the screenshots would be older than the ledger.

- **Blockaid review request:** Aryesh reported sending it on 22 Nov. Outcome pending. Submitted domain: clubledger-kappa.vercel.app (the one in the QR codes, README and submission). The report text also names the bpdc domain, which is not used in the submission.

---

## Redesign: Forest & cream, then Graphite & steel (22 Nov, branch `ui/forest-cream`, approved and live)

- Aryesh chose the direction and a copy rewrite that keeps the key terms. SPEC §2.5 UI copy, §3.2–3.5 and the rule 4 title updated to match. Contract, reads and write logic unchanged.
- Gates: TypeScript clean; Vitest 90; Playwright on live data 23 passed (5 local-only skipped); local write suite 5/5 twice on a fresh standalone chain replaying the public deployment; CLS ≤ 0.024.
- Audit on 11 screens at 320/375/768/1024/1440 px: 0 overflow, clipped text, small tap target, contrast failure or page error.
- Tests changed only where approved wording changed; every assertion kept.
- The write suite hung on an anvil *fork* (the node stopped producing blocks); it passes on a standalone chain.
- One long dash remains on screen: EXP-0004's correction reason, which is permanent on-chain data.
- Not tested: real MetaMask on this build, real phones, Safari.

**Round 2, from Aryesh's feedback (22 Nov):** one font everywhere (Bricolage Grotesque, checked for fixed-width digits), Graphite & steel palette, and copy that explains itself on every screen. SPEC §3.3 and §3.5 updated.
- Gates re-run on the final build: TypeScript clean; Vitest 90; Playwright 23 passed (5 local-only skipped); local write suite 5/5; audit 0 problems (11 screens, 5 widths); CLS ≤ 0.015.
- Still not tested: real MetaMask on this build, real phones, Safari.

**LIVE 22 Nov, approved by Aryesh.** Merged to main and deployed as `dpl_9xi9FTHiTmg4Drfw3RGnto6fqwDp`.
- Both domains byte-identical to the local build; Playwright 23 passed on each; WebKit (Safari engine, cached older build) 0 failures of 24 checks on iPhone and desktop profiles; production audit 0 problems; 3 QR targets return 200; Foundry 29; check-refusals all passed.
- Rollback: `cd frontend && vercel rollback dpl_9tCFepn5h43tfZmp7RmjneZJKvcZ` (code: local tag `pre-redesign`).
- Real MetaMask on this build: PASSED on localhost:4173 (22 Nov 12:03 UTC, reported by Aryesh, confirmed on-chain). Random member's EXP-9100 reverted "Not an authorised poster": https://sepolia.basescan.org/tx/0x831a9c7c6dc4db0b67874f5756633d17045bdd2ef767e30b77fe9ae4a6553a42 . Ledger still 458000 and 12 entries; EXP-0007 unused.
- Not tested: real phones, real Safari. MetaMask's flag is unaffected as far as we know.

---

## Live look kept, ledger and guided tour (branch `ui/keep-theme`) — ✅ LIVE

- Redesign v3 (`ui/ledger-receipt`) was rejected for its look and is not used. The live Graphite & steel theme stays.
- Kept from it: running-balance ledger, copyable contract address, quiet search field, "Demo data" marker, long-value layout fixes.
- Guided tour (SPEC §3.7): 8 steps, about 62 s, played through at 1440x900 and 375x812 in Chromium and WebKit with every target hit, none covered and a clean console.
- Tests: Vitest 98, Foundry 29, Playwright 55 on public data, tour suite 27 in WebKit, local write suite 5/5, audit 0 problems (11 screens, 5 widths).
- **LIVE 22 Nov, approved by Aryesh.** Merged to main and deployed as `dpl_3JcAqeh4TrL3X4MdXFP5LLex7JpL`. Both domains byte-identical to the tested build (6/6 files).
- On production: Playwright 55 passed on each domain with no retries; tour played in real time at both sizes in Chromium and WebKit; audit 0 problems; WebKit 24 checks; three QR targets 200.
- First run on bpdc had 3 tests pass only on retry. One was a timing race in the Pause test (fixed, 24/24 under load). The other two did not recur in repeated runs under load.
- Rollback: `cd frontend && vercel rollback dpl_9xi9FTHiTmg4Drfw3RGnto6fqwDp`.
- Not pushed to GitHub. Untested: real phone, real Safari, real MetaMask on this build.

---

## Smoother tour, one-line address, built-to-scale section (branch `ui/tour-polish`) — ✅ LIVE

Aryesh's feedback, 23 Nov: the tour felt forced, the ring should follow each feature's shape, step 3 changed with no visible cause, the address should fit one line with a copy icon, the site should be more judge-friendly, and the idea should look bigger.

- **Bigger idea:** Aryesh chose to reframe without redeploying. The contract, its 12 entries, the proofs, the QR receipts and the BaseScan verification are unchanged. New home section "Built to scale" presents the Robotics Club as the pilot of a campus-wide setup (SPEC §3.3 item 6).
- **Tour:** the ring glides between features and uses their own corners; eased scrolling; pages crossfade and arrive already scrolled; a pointer presses Check (step 2) and Expense (step 7). Step 2 now ends with the press (about 4.3 s instead of 8 s).
- **Address:** one line, scaled to fit, with a copy icon (shortened in the middle below 640 px; the icon copies the whole address).
- **Judge-friendly:** "Or try a real one" chips for the three verdicts (verdicts read live), a "Live" badge on the balance, entrance motion on the hero, a stamp on the verdict, and a link-preview image (`og.png`).
- Tests on a local production build: TypeScript clean; Vitest 98; Playwright 56 passed with no retries, 5 local-only skipped, including a new pointer test. Tour frames checked in Chromium at 1280x800 and in WebKit at 375x812, with no console errors.
- README screenshots refreshed from this build by the test run.
- Not tested: real phone, real Safari, real MetaMask on this build.
- **LIVE 23 Nov, approved by Aryesh.** Merged to main (`e43eb1c`) and deployed from a clean export as `dpl_HB5fzbiWBhf1dHiVTLwwexpgKw1e`. Both domains are byte-identical to a local build with the production RPC setting (index, JS, CSS); og.png, favicon and pattern also match; six routes return 200 on each.
- On production: Playwright 56 passed on each domain with no retries (5 local-only skipped).
- Rollback: `cd frontend && vercel rollback dpl_3JcAqeh4TrL3X4MdXFP5LLex7JpL`.
- Not pushed to GitHub yet.
