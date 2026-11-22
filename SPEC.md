# ClubLedger — Final Build Spec (Hash It Out 2026, Track 4)

> Single source of truth. If anything here conflicts with an earlier plan or doc, this file wins.
> Built for: AGCOE-BAIR "Hash It Out", BITS Pilani Dubai. Network: **Base Sepolia (chain ID 84532)**.
> Submission deadline: **Tue 24 Nov 2026, 17:00 GST** (target: submitted Mon 23 Nov night).

## 0. What we are building (one paragraph)

ClubLedger is a public money record for a student club. Authorised treasurers record income and expenses
on a smart contract; anyone can check any receipt by its number on a phone, with no wallet, and see a
one-word verdict plus every version of it. Mistakes are fixed with corrections that never erase the
original. The contract — not the website — refuses unauthorised wallets, overspending, duplicate
receipts, and edits.

### Track 4 problem statement → feature map

| Statement requirement | Feature |
|---|---|
| Records incoming funds and expenses for a student club | `postEntry(Income/Expense, …)` stored in contract storage |
| Users can view histories, amounts, expenditure details | Home + `/check/:code` + `/ledger`, read live from the contract, no wallet |
| Entries restricted to authorised wallets | Admin keeps a list of authorised posters; everyone else is refused on-chain |
| Verifiable record of all transactions | No edits/deletes; corrections are linked new entries; every page links to BaseScan |
| Common: frontend + contract on Base Sepolia | Vite/React frontend on Vercel; verified contract on BaseScan |
| Common: ≥1 restriction + demonstrated rejection | 4 headline rules, each with an on-chain ✓ pass and ✗ refused transaction |
| Common: testnet funds, synthetic data only | Fictional club, vendors, sponsors; AED amounts are records only |

### The 4 headline rules (the only rules we pitch)

1. **Only authorised treasurers can record money.** Anyone else is refused.
2. **The books can never go negative.** An expense larger than the recorded balance is refused.
3. **A receipt can only be recorded once.** Duplicate receipt numbers are refused.
4. **No edits — only corrections.** A correction is a new entry; the original stays forever; an already-corrected version cannot be corrected again.

All other checks are silent input validation.

---

## 1. Repo layout

```
clubledger/
├── CLAUDE.md
├── SPEC.md                 (this file)
├── README.md               (written in Phase 6)
├── NOTE.md                 (one-page submission note, Phase 6)
├── contracts/              (Foundry project)
│   ├── src/ClubLedger.sol
│   ├── test/ClubLedger.t.sol
│   ├── test/ClubLedger.invariant.t.sol
│   ├── script/Deploy.s.sol
│   ├── script/Seed.s.sol
│   └── .env.example
└── frontend/               (Vite + React + TS)
    ├── src/config.ts       (contract address, chain, RPCs, explorer — ONLY place these live)
    ├── src/abi/ClubLedger.json
    ├── src/proofs.ts       (tx hashes for the rules panel)
    └── vercel.json
```

---

## 2. Smart contract — `contracts/src/ClubLedger.sol`

`// SPDX-License-Identifier: MIT` · `pragma solidity 0.8.24;` · **no imports needed** · no `payable`, no `receive`/`fallback` (ETH sent to it is rejected) · no external calls.

### 2.1 Types and storage (final — do not add fields)

```solidity
enum Kind { Income, Expense }   // ABI: uint8 0 = Income, 1 = Expense

struct Entry {
    uint256 id;            // 1-based; 0 means "none"
    Kind kind;
    uint256 amount;        // AED in fils (AED × 100). 0 only allowed in a correction (= cancelled)
    string category;       // 1–32 bytes
    string counterparty;   // 0–64 bytes
    string description;    // 0–280 bytes
    string refCode;        // receipt number, [A-Z0-9-], 1–16 bytes; a correction inherits it
    address poster;
    uint64 timestamp;
    uint256 correctsId;    // 0 = original; else the id of the version this one corrects
    string reason;         // "" for originals; 1–140 bytes for corrections
}

string public clubName;
address public admin;
mapping(address => bool) public isPoster;
mapping(address => string) public posterLabel;   // kept after revoke so UI can say "former treasurer"
Entry[] internal entries;                         // entry id = index + 1
mapping(bytes32 => uint256) public idByRef;       // keccak256(bytes(refCode)) => ORIGINAL entry id
mapping(uint256 => uint256) public correctedBy;   // entry id => id of the entry that corrects it (0 = latest)
uint256 public balance;                           // fils
uint256 public totalIncome;                       // fils
uint256 public totalExpense;                      // fils
```

Entry structs are **never modified after being pushed**. `correctedBy` is a separate index.

### 2.2 Write functions

**`constructor(string memory _clubName)`** — `admin = msg.sender; clubName = _clubName;`

**`authorizePoster(address who, string calldata label)`**
- `require(msg.sender == admin, "Only the admin can manage posters")`
- `require(who != address(0), "Invalid address")`
- `require(who != admin, "Admin cannot be a poster")`
- `require(!isPoster[who], "Already a poster")`
- `require(bytes(label).length >= 1 && bytes(label).length <= 32, "Invalid label")`
- set `isPoster[who] = true; posterLabel[who] = label;` emit `PosterAuthorized(who, label)`

**`revokePoster(address who)`**
- `require(msg.sender == admin, "Only the admin can manage posters")`
- `require(isPoster[who], "Not a poster")`
- `isPoster[who] = false;` (label kept) emit `PosterRevoked(who)`

**`postEntry(Kind kind, uint256 amount, string calldata category, string calldata counterparty, string calldata description, string calldata refCode) returns (uint256 id)`** — checks in this order:
1. `require(isPoster[msg.sender], "Not an authorised poster")`
2. `require(amount > 0, "Amount must be greater than zero")`
3. `require(_validRef(refCode), "Invalid reference code")` — 1–16 bytes, each byte in `A–Z`, `0–9`, `-`
4. `require(idByRef[keccak256(bytes(refCode))] == 0, "Reference code already used")`
5. category 1–32 bytes else `"Invalid category"`; counterparty ≤ 64 and description ≤ 280 else `"Text too long"`
6. if Expense: `require(amount <= balance, "Expense exceeds club balance")`
7. effects: Income → `balance += amount; totalIncome += amount;` Expense → `balance -= amount; totalExpense += amount;`
8. push entry (`correctsId = 0`, `reason = ""`, `timestamp = uint64(block.timestamp)`), set `idByRef`, emit `EntryPosted(id, msg.sender, kind, amount, refCode)`

**`correctEntry(uint256 entryId, uint256 newAmount, string calldata category, string calldata counterparty, string calldata description, string calldata reason) returns (uint256 newId)`**
1. `require(isPoster[msg.sender], "Not an authorised poster")` — any CURRENT poster may correct any entry; a revoked poster cannot.
2. `require(entryId >= 1 && entryId <= entries.length, "Entry does not exist")`
3. `require(correctedBy[entryId] == 0, "Entry already corrected - correct the latest version")`
4. `reason` 1–140 bytes: empty → `"Reason required"`, too long → `"Text too long"`; same caps for the other strings as postEntry.
5. Let `old = entries[entryId-1].amount`, `k = entries[entryId-1].kind`. `newAmount` may be 0 (= cancel) and may restore a cancelled entry.
6. Balance math — **check before subtracting** (no underflow panics):
   - Income: `require(balance + newAmount >= old, "Correction would make balance negative")`; `balance = balance + newAmount - old`; `totalIncome = totalIncome + newAmount - old`
   - Expense: `require(newAmount <= balance + old, "Correction would make balance negative")`; `balance = balance + old - newAmount`; `totalExpense = totalExpense + newAmount - old`
7. push new entry with same `kind` and `refCode`, `correctsId = entryId`, `reason`; set `correctedBy[entryId] = newId`; emit `EntryCorrected(entryId, newId, msg.sender, reason)`. Do **not** touch `idByRef`.

### 2.3 Read functions

- `entryCount() view returns (uint256)`
- `getEntry(uint256 id) view returns (Entry memory)` — reverts `"Entry does not exist"` if out of range
- `getEntries(uint256 startId, uint256 count) view returns (Entry[] memory)` — `count` capped at 50; if `startId == 0` or `startId > length` return empty array; clamp the end to `length`
- `versionsOf(string calldata refCode) view returns (uint256[] memory ids)` — start at `idByRef[hash]`; if 0 return empty; follow `correctedBy` until 0; original first, latest last
- `summary() view returns (string memory clubName, address admin, uint256 balance, uint256 totalIncome, uint256 totalExpense, uint256 entryCount)`

### 2.4 Events

```solidity
event PosterAuthorized(address indexed who, string label);
event PosterRevoked(address indexed who);
event EntryPosted(uint256 indexed id, address indexed poster, Kind kind, uint256 amount, string refCode);
event EntryCorrected(uint256 indexed previousId, uint256 indexed newId, address indexed poster, string reason);
```

### 2.5 Complete revert-string catalogue (exact text — the frontend maps these)

| Revert string | Plain-English UI copy |
|---|---|
| `Not an authorised poster` | This wallet isn't an authorised treasurer, so the club's rulebook refused it. |
| `Only the admin can manage posters` | Only the Club Advisor can add or remove treasurers. |
| `Expense exceeds club balance` | The club's books don't have enough money recorded for this expense. The books can never go negative. |
| `Reference code already used` | This receipt number has already been recorded. A receipt can only be recorded once. |
| `Entry already corrected - correct the latest version` | This version has already been corrected. Correct the newest version instead. |
| `Correction would make balance negative` | This correction would push the club's books below zero. |
| `Amount must be greater than zero` | Enter an amount above zero. |
| `Invalid reference code` | Receipt numbers use capital letters, digits and dashes only (e.g. EXP-0007), up to 16 characters. |
| `Invalid category` / `Text too long` / `Reason required` | Check the highlighted field. |
| `Admin cannot be a poster` | The Club Advisor approves treasurers but can't record money — separation of duties. |
| `Already a poster` / `Not a poster` / `Invalid address` / `Invalid label` | (admin panel form errors) |
| `Entry does not exist` | No entry with that number. |

### 2.6 Tests (all must pass before any deploy)

`test/ClubLedger.t.sol`:
- [ ] every revert string in 2.5 is triggered at least once with `vm.expectRevert(bytes("…"))`
- [ ] poster posts income → balance/totalIncome update; event emitted
- [ ] admin calling `postEntry` → `Not an authorised poster`
- [ ] expense == balance succeeds; expense == balance + 1 refused
- [ ] duplicate refCode refused; lowercase `exp-0001`, empty, 17-char, and space-containing refCodes refused
- [ ] correction creates new entry; original's stored fields are byte-identical before/after (compare every field)
- [ ] chained corrections A → B → C: balance correct after each; correcting A or B refused; `versionsOf` returns `[A, B, C]`
- [ ] cancel (newAmount 0) then reinstate (correct the cancel back to a positive amount)
- [ ] Income correction after spending: succeeds at the exact boundary, refused 1 fil over
- [ ] revoked poster cannot post or correct
- [ ] admin edge cases: authorise `address(0)`, admin itself, an existing poster; revoke a non-poster; non-admin authorise/revoke
- [ ] `getEntries` out-of-range returns empty; `count` > 50 is capped
- [ ] sending ETH to the contract reverts

`test/ClubLedger.invariant.t.sol`:
- [ ] handler performs random posts/corrections by random actors; invariants: `balance == totalIncome - totalExpense` and every call that would make it negative reverted

### 2.7 Scripts

- `Deploy.s.sol` — deploys with `clubName = "BITS Dubai Robotics Club (demo)"`, uses `PK_ADMIN`. Run with `--broadcast --verify` (Etherscan API key; if `--verify` fails, run `forge verify-contract` separately — do not burn more than 15 min on it).
- `Seed.s.sol` — reads `CLUBLEDGER_ADDRESS`, `PK_ADMIN`, `PK_TREASURER`, `PK_ASST`. Admin authorises `Treasurer` and `Asst. Treasurer`; posts the seed table in order (incomes first); applies the two corrections; finishes with `require(balance == 458000)` (AED 4,580.00).
- `.env.example`: `BASE_SEPOLIA_RPC=`, `ETHERSCAN_API_KEY=`, `PK_ADMIN=`, `PK_TREASURER=`, `PK_ASST=`, `PK_RANDOM=`, `CLUBLEDGER_ADDRESS=`. `.env` is git-ignored.

### 2.8 Seed data (all fictional)

| # | Poster | Ref | Kind | AED | Category | Counterparty | Description |
|---|---|---|---|---|---|---|---|
| 1 | Treasurer | INC-0001 | Income | 5,000.00 | Sponsorship | Nova Robotics LLC (fictional) | Season sponsorship |
| 2 | Asst. Treasurer | INC-0002 | Income | 1,200.00 | Membership | 40 members | 40 × AED 30 membership fees |
| 3 | Treasurer | INC-0003 | Income | 2,500.00 | Grant | Student Council | Activity grant |
| 4 | Treasurer | EXP-0001 | Expense | 1,850.00 | Equipment | Circuit Souk (fictional) | Servo motors and microcontroller kits |
| 5 | Treasurer | EXP-0002 | Expense | 420.00 | Events | Campus Café (fictional) | Workshop refreshments |
| 6 | Asst. Treasurer | EXP-0003 | Expense | 900.00 | Competition | Inter-Uni Robotics Meet (fictional) | Team registration |
| 7 | Treasurer | EXP-0004 | Expense | 300.00 | Printing | PrintHub (fictional) | Event posters |
| 8 | Treasurer | INC-0004 | Income | 750.00 | Events | Ticket sales | Robot-sumo night tickets |
| 9 | Asst. Treasurer | EXP-0005 | Expense | 640.00 | Transport | Desert Coaches (fictional) | Bus hire for competition |
| 10 | Treasurer | EXP-0006 | Expense | 1,100.00 | Equipment | Circuit Souk (fictional) | 3D printer filament and spares |
| C1 | Treasurer | EXP-0002 → 380.00 | correction | | | | reason: "Vendor refunded AED 40 for undelivered items" |
| C2 | Treasurer | EXP-0004 → 0.00 | correction (cancel) | | | | reason: "Duplicate — invoice already paid by Student Council" |

End state: income 9,450.00 · expenses 4,870.00 · **balance 4,580.00**.

### 2.9 On-chain proof transactions (after seeding)

Force-send failing calls with `cast send … --gas-limit 300000` (setting a gas limit skips estimation so the tx is broadcast and reverts on-chain; if your cast version still refuses, send from MetaMask with a manual gas limit). Record every hash in `frontend/src/proofs.ts`.

| Rule | ✓ Passed (from seed) | ✗ Refused (force-send) |
|---|---|---|
| 1 Only authorised treasurers | INC-0001 post tx | `PK_RANDOM` posts `EXP-9001` AED 500 → `Not an authorised poster` |
| 2 Books never negative | EXP-0001 post tx | Treasurer posts `EXP-9002` AED 50,000 → `Expense exceeds club balance` |
| 3 Receipt recorded once | INC-0001 post tx | Treasurer re-posts `INC-0001` → `Reference code already used` |
| 4 No edits, only corrections | C1 correction tx | Treasurer corrects the ORIGINAL EXP-0002 id again → `Entry already corrected - correct the latest version` |

---

## 3. Frontend — `frontend/`

### 3.1 Stack

Vite + React + TypeScript + Tailwind + React Router + wagmi + viem (+ TanStack Query, required by wagmi). Connector: **`injected()` only** (MetaMask). No RainbowKit, no WalletConnect.

`src/config.ts` (the only place for these):
```ts
import { baseSepolia } from 'viem/chains';
export const CHAIN = baseSepolia;                    // id 84532
export const CONTRACT_ADDRESS = '0x…' as const;
export const RPC_URLS = ['<primary from .env VITE_RPC_URL>', 'https://sepolia.base.org'];
export const EXPLORER = 'https://sepolia.basescan.org';
```
Reads use a viem public client with `fallback(RPC_URLS.map(u => http(u)))`, `refetchInterval: 8000`, and are invalidated after any confirmed write. **Reads never require a wallet. Never read event logs.** ABI copied from `contracts/out/ClubLedger.sol/ClubLedger.json` into `src/abi/` via `npm run sync-abi`.

Money: amounts are `bigint` fils. Parse input strings like `"1,250.50"` into fils with a regex (no floating point). Display with `Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' })` on `Number(fils) / 100`. Never show the word "fils".

### 3.2 Words (stranger-proof)

| Never on screen | Say instead |
|---|---|
| refCode | Receipt number |
| poster | Treasurer / authorised treasurer |
| voided | Cancelled |
| revert, simulate, tx hash, chain ID, Base Sepolia (in main flow) | "View public proof ↗" (links to BaseScan) |
| raw address as the main label | Role label first ("Treasurer"), short address `0x12ab…89ef` in small grey below |
| wallet (outside `/manage`) | — |

Receipt-number inputs: trim + uppercase before lookup.

### 3.3 Routes

**`/` Home — top to bottom:**
1. Headline: **"Robotics Club Money — every dirham, on the record."** Subhead: "Anyone can check it. Only the treasurer can add to it. Nobody can quietly change it."
2. Big search: label "Receipt number", placeholder "e.g. EXP-0002", button **Check** (≥56 px tall, autofocus) → navigates to `/check/:code`.
3. One row: **Balance** (large, tabular numerals) · Money in · Money out — from `summary()`.
4. Panel **"Rules this contract enforces"** — the 4 headline rules, each with `✓ Passed ↗` and `✗ Refused ↗` links from `proofs.ts`.
5. 5 most recent entries as cards → link "See all entries" (`/ledger`).
6. Short "How this works" footer: what's on the public record vs not; contract address with "View contract ↗"; repo link.

**`/check/:code` — the verdict page** (also reachable directly from printed QR codes):
- Logic: `versionsOf(code)` → `[]` NOT FOUND · length 1 GENUINE · length > 1 and latest amount 0 → CANCELLED · else CORRECTED.
- Full-width coloured verdict block:

| Verdict | Colour | Headline |
|---|---|---|
| GENUINE | green | ✓ Genuine record |
| CORRECTED | amber | Corrected — see what changed |
| CANCELLED | grey | Cancelled |
| NOT FOUND | red | ✗ No such record |

- Under the headline (one line): "Recorded by {label} · {date, time} · cannot be edited · {n} correction(s)" + "View public proof ↗" (contract page on BaseScan).
- Details card for the latest version: kind, amount, category, counterparty, description.
- Version timeline (vertical, newest first): amount, reason (for corrections), who, when. The original is labelled "Original — kept forever".
- NOT FOUND body: "No entry with this receipt number was ever recorded by this club's contract."

**`/ledger`** — all entries as cards (paged via `getEntries`, 50 at a time), filter All / Income / Expense, each card: receipt number, date, Income/Expense badge, AED, category, counterparty, status badge (Latest / Corrected / Correction / Cancelled), treasurer label; tapping a card goes to `/check/:code`.

**`/manage`** — one role-aware page:
- Not connected: "Connect a wallet to add entries (not needed to check)." + Connect button. Auto-switch to Base Sepolia.
- Role banner (permanent at top):
  - Admin: "You're the Club Advisor — you approve treasurers but can't add money." → shows **Authorise / Revoke** panel (address + label; list of current & former treasurers).
  - Poster: "You're the {label} — you can add entries." → shows **Record money** form (Income/Expense toggle, amount, category select, counterparty, description, receipt number pre-filled with the next free `INC-`/`EXP-` number) and **Correct an entry** form (receipt number → loads latest version → new amount, fields, required reason).
  - No role: "You're not a treasurer — anything you submit will be blocked." → **still shows the Record money form** (this is the judge-participation refusal demo).

### 3.4 Write flow and the refusal card (the 25-mark screen)

1. On submit: `simulateContract({ account, … })`.
2. If it reverts: walk the viem error (`BaseError.walk` → `ContractFunctionRevertedError`) to get the reason string; map via table 2.5; show the **refusal card**:
   - Title: **"Blocked by the club's rulebook"**
   - Body: mapped copy + "The rulebook is a smart contract on a public blockchain, not this website. Nobody can switch it off."
   - Button: **"Show the refusal on the public record"** → BaseScan link of the matching ✗ proof from `proofs.ts`.
   - Only when URL has `?demo=1`: secondary button **"Send it anyway"** → `writeContract` with `gas: 300000n`, wait for receipt, then show "Refused on-chain — view it ↗" with the new tx link.
3. If simulation passes: `writeContract` → toast "Recording…" → `waitForTransactionReceipt` → toast "Recorded ✓ View public proof ↗" → invalidate reads.
4. Unknown errors (user rejected, RPC down): plain message, never a raw stack.

### 3.5 Visual direction

Bank statement, not crypto app. White background, slate text, one emerald accent; verdict colours green/amber/grey/red. Inter font, large tabular numerals for AED, `rounded-2xl` cards, no gradients, no neon, no crypto imagery. Mobile-first single column; test at 375 px wide; no horizontal scroll; tap targets ≥ 44 px.

### 3.6 Deploy

Vercel project root = `frontend/`; `vercel.json`: `{"rewrites":[{"source":"/(.*)","destination":"/"}]}` so `/check/EXP-0002` survives refresh. Env: `VITE_RPC_URL`. Redeploy at every checkpoint.

---

## 4. Submission deliverables (Phase 6–7)

1. Public GitHub repo link (README: what it is, live URL, contract address, 4 rules, how to run tests, screenshot).
2. Contract address (verified BaseScan link).
3. Two+ transactions with explorer links (INC-0001 post, Treasurer authorisation) + the 4 refusal txs.
4. `NOTE.md` one page: users (treasurer, Club Advisor, members, sponsors) · on-chain (entries, amounts, receipt numbers, treasurer wallets, timestamps, corrections, roles, balance) vs off-chain (receipt files, website look) · the 4 rules · limits (a treasurer can still type a lie — but never hide or rewrite it; reconciliation with the bank stays off-chain; single admin key; synthetic data only).
5. Screen recording ≤ 3 min: phone QR scan → Corrected; home rules panel; refusal as Random member + on-chain proof; successful Treasurer post appearing live; 20 s on/off-chain.
6. Who did what: solo — spec/design, contract, tests, frontend, deploy, pitch; AI disclosure ("Claude Code drafted code from my spec; I reviewed every contract line and every test"); mentor log with dates and what changed.

## 5. Explicitly cut (do not build)

`transferAdmin` · `receiptHash` / receipt-file hashing · expense-by-category bars · tx-hash lookup via event logs · separate `/about` route · RainbowKit/WalletConnect · any backend or database.
