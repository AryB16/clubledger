# ClubLedger — submission note

**Hash It Out 2026 · Track 4: Financial Transparency · solo entry**
Live: https://clubledger-kappa.vercel.app · Contract: see [DEPLOYMENT.md](DEPLOYMENT.md)

## Who uses it
- **Treasurer / Asst. Treasurer** — record money in and out from a browser wallet; fix mistakes with corrections.
- **Club Advisor (admin)** — approves and removes treasurers. Deliberately *cannot* record money (separation of duties).
- **Members** — check any receipt by its number, or scan the QR on a printed receipt. No wallet, no sign-up.
- **Sponsors / Student Council** — see exactly where their money went, and that nobody quietly changed it.

## What lives on-chain vs off-chain
| On the public record (Base Sepolia contract) | Off-chain |
|---|---|
| Every entry: type, amount, category, counterparty, description | The paper receipts and invoices themselves |
| Receipt numbers (each can be used once) | The club's bank account and reconciliation |
| Which wallet recorded it, and when | How the website looks (it only *reads* the record) |
| Every correction, linked to what it corrects, with a reason | Who the people behind the wallets are |
| Who is an authorised treasurer, past and present | |
| Running balance, money in, money out | |

## The 4 rules the contract enforces
1. **Only authorised treasurers can record money.** Anyone else is refused — even the admin.
2. **The books can never go negative.** An expense (or correction) larger than the recorded balance is refused.
3. **A receipt can only be recorded once.** Duplicate receipt numbers are refused.
4. **No edits — only corrections.** A correction is a new linked entry; the original stays forever; an already-corrected version can't be corrected again.

Each rule has a real ✓ passed and ✗ refused transaction on BaseScan, linked from the home page. The website runs every action past the contract first and, when it refuses, explains why in plain English and links to that public proof.

## Limits (honest)
- **A treasurer can still type a lie** — but they can never hide it or rewrite it afterwards. Every change is a visible, reasoned correction.
- **Reconciliation with the bank stays off-chain.** The contract records what the treasurer declares; it doesn't see the bank.
- **Single admin key.** If the Club Advisor's key is lost or stolen, treasurer management is lost with it (no admin transfer, by design for this scope).
- **Synthetic data only.** Fictional club, vendors and sponsors; testnet only; AED amounts are records, not real money moving.
