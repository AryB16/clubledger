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
