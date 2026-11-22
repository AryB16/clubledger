# CLAUDE.md — ClubLedger

Hackathon build (Hash It Out 2026, Track 4: Financial Transparency). Solo builder: Aryesh. Deadline Tue 24 Nov 2026 17:00 GST.
**`SPEC.md` is the single source of truth.** Read it fully before any work. If a request conflicts with SPEC.md, stop and ask.

## Layout
- `contracts/` — Foundry project (Solidity `0.8.24`, pinned). `src/ClubLedger.sol`, tests in `test/`, scripts in `script/`.
- `frontend/` — Vite + React + TS + Tailwind + wagmi + viem. Config only in `src/config.ts`; proof tx hashes only in `src/proofs.ts`.

## Commands
- Contracts: `cd contracts && forge build` · `forge test -vv` · `forge test --match-contract Invariant -vv`
- Deploy: `forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify` (verification needs `ETHERSCAN_API_KEY`; check `forge script --help` for the exact flags of the installed version)
- Seed: `forge script script/Seed.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast`
- Forced failing tx: `cast send <addr> "<sig>" <args> --gas-limit 300000 --rpc-url $BASE_SEPOLIA_RPC --private-key $PK_…`
- Frontend: `cd frontend && npm run dev` · `npm run build` · `npm run sync-abi`

## Rules — always
- Follow the phases and gates of the master prompt; keep PROGRESS.md current; only stop for the listed HUMAN STEPS.
- Commit after every passing step with a clear message.
- Contract revert strings must match SPEC.md §2.5 exactly — the frontend and tests depend on them.
- Amounts are `uint256`/`bigint` fils (AED × 100). No floating point anywhere in money handling.
- Mobile-first; check every page at 375 px wide.
- Use the exact UI copy in SPEC.md §3.2–3.4.

## Rules — never
- Never change `ClubLedger.sol` after deployment without re-running all tests AND telling the human a redeploy + re-seed is needed.
- Never add fields, functions or features listed in SPEC.md §5 (cut list).
- Never add a dependency not named in SPEC.md or the master prompt (Vitest, Playwright and qrcode are approved dev dependencies).
- Never read event logs (`getLogs`, `watchContractEvent`) for page data — use the contract's view functions.
- Never put mock/hard-coded entry data in the frontend; everything displayed comes from the contract (except `proofs.ts` hashes).
- Never commit `.env`, private keys or API keys. Keys live only in `contracts/.env` and Vercel env vars.
- Never require a wallet for `/`, `/check/:code` or `/ledger`.
- Never use crypto jargon on public pages (see SPEC.md §3.2).
