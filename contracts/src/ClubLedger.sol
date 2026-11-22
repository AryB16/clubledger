// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ClubLedger — a public, append-only money record for a student club
/// @notice Authorised treasurers ("posters") record income and expenses. Nothing is ever edited or
///         deleted: mistakes are fixed with linked correction entries. Amounts are AED in fils (AED × 100).
/// @dev No payable functions, no receive/fallback (ETH sent here is rejected), no external calls, no imports.
contract ClubLedger {
    enum Kind {
        Income,
        Expense
    }

    struct Entry {
        uint256 id; // 1-based; 0 means "none"
        Kind kind;
        uint256 amount; // AED in fils (AED × 100). 0 only allowed in a correction (= cancelled)
        string category; // 1–32 bytes
        string counterparty; // 0–64 bytes
        string description; // 0–280 bytes
        string refCode; // receipt number, [A-Z0-9-], 1–16 bytes; a correction inherits it
        address poster;
        uint64 timestamp;
        uint256 correctsId; // 0 = original; else the id of the version this one corrects
        string reason; // "" for originals; 1–140 bytes for corrections
    }

    string public clubName;
    address public admin;
    mapping(address => bool) public isPoster;
    mapping(address => string) public posterLabel; // kept after revoke so UI can say "former treasurer"
    Entry[] internal entries; // entry id = index + 1
    mapping(bytes32 => uint256) public idByRef; // keccak256(bytes(refCode)) => ORIGINAL entry id
    mapping(uint256 => uint256) public correctedBy; // entry id => id of the entry that corrects it (0 = latest)
    uint256 public balance; // fils
    uint256 public totalIncome; // fils
    uint256 public totalExpense; // fils

    event PosterAuthorized(address indexed who, string label);
    event PosterRevoked(address indexed who);
    event EntryPosted(uint256 indexed id, address indexed poster, Kind kind, uint256 amount, string refCode);
    event EntryCorrected(uint256 indexed previousId, uint256 indexed newId, address indexed poster, string reason);

    /// @notice Creates the ledger. The deployer becomes the admin (Club Advisor).
    /// @dev Rule: exactly one admin, fixed at deployment (there is no admin transfer).
    /// @param _clubName Display name of the club.
    constructor(string memory _clubName) {
        admin = msg.sender;
        clubName = _clubName;
    }

    // ───────────────────────────── Admin ─────────────────────────────

    /// @notice Authorise a wallet to record money (make it a treasurer).
    /// @dev Rules: only the admin; not address(0); the admin can never be a poster (separation of duties);
    ///      not already a poster; label 1–32 bytes.
    /// @param who Wallet to authorise.
    /// @param label Role label shown in the UI, e.g. "Treasurer".
    function authorizePoster(address who, string calldata label) external {
        require(msg.sender == admin, "Only the admin can manage posters");
        require(who != address(0), "Invalid address");
        require(who != admin, "Admin cannot be a poster");
        require(!isPoster[who], "Already a poster");
        require(bytes(label).length >= 1 && bytes(label).length <= 32, "Invalid label");
        isPoster[who] = true;
        posterLabel[who] = label;
        emit PosterAuthorized(who, label);
    }

    /// @notice Remove a treasurer's right to record or correct money. Their label is kept for history.
    /// @dev Rules: only the admin; the wallet must currently be a poster.
    /// @param who Wallet to revoke.
    function revokePoster(address who) external {
        require(msg.sender == admin, "Only the admin can manage posters");
        require(isPoster[who], "Not a poster");
        isPoster[who] = false;
        emit PosterRevoked(who);
    }

    // ───────────────────────────── Posting ─────────────────────────────

    /// @notice Record a new income or expense entry.
    /// @dev Rules, checked in this order: (1) only authorised posters; (2) amount > 0;
    ///      (3) receipt number is 1–16 bytes of A–Z, 0–9, '-'; (4) a receipt number can only be recorded once;
    ///      (5) category 1–32 bytes, counterparty ≤ 64, description ≤ 280;
    ///      (6) an expense can never exceed the recorded balance (the books never go negative).
    /// @return id The new entry's 1-based id.
    function postEntry(
        Kind kind,
        uint256 amount,
        string calldata category,
        string calldata counterparty,
        string calldata description,
        string calldata refCode
    ) external returns (uint256 id) {
        require(isPoster[msg.sender], "Not an authorised poster");
        require(amount > 0, "Amount must be greater than zero");
        require(_validRef(refCode), "Invalid reference code");
        bytes32 refHash = keccak256(bytes(refCode));
        require(idByRef[refHash] == 0, "Reference code already used");
        require(bytes(category).length >= 1 && bytes(category).length <= 32, "Invalid category");
        require(bytes(counterparty).length <= 64 && bytes(description).length <= 280, "Text too long");
        if (kind == Kind.Expense) {
            require(amount <= balance, "Expense exceeds club balance");
        }

        if (kind == Kind.Income) {
            balance += amount;
            totalIncome += amount;
        } else {
            balance -= amount;
            totalExpense += amount;
        }

        id = entries.length + 1;
        entries.push(
            Entry({
                id: id,
                kind: kind,
                amount: amount,
                category: category,
                counterparty: counterparty,
                description: description,
                refCode: refCode,
                poster: msg.sender,
                timestamp: uint64(block.timestamp),
                correctsId: 0,
                reason: ""
            })
        );
        idByRef[refHash] = id;
        emit EntryPosted(id, msg.sender, kind, amount, refCode);
    }

    /// @notice Correct an entry by appending a new linked version. The corrected version is never modified.
    /// @dev Rules: (1) only CURRENT posters (a revoked poster cannot correct); (2) the entry must exist;
    ///      (3) only the latest version can be corrected — no forks, no edits;
    ///      (4) reason 1–140 bytes, same text caps as postEntry; (5) newAmount may be 0 (= cancel) or restore
    ///      a cancelled entry; (6) the correction can never push the balance below zero (checked before subtracting).
    ///      The receipt number and kind are inherited; idByRef keeps pointing at the original.
    /// @return newId The id of the new (latest) version.
    function correctEntry(
        uint256 entryId,
        uint256 newAmount,
        string calldata category,
        string calldata counterparty,
        string calldata description,
        string calldata reason
    ) external returns (uint256 newId) {
        require(isPoster[msg.sender], "Not an authorised poster");
        require(entryId >= 1 && entryId <= entries.length, "Entry does not exist");
        require(correctedBy[entryId] == 0, "Entry already corrected - correct the latest version");
        require(bytes(reason).length >= 1, "Reason required");
        require(bytes(reason).length <= 140, "Text too long");
        require(bytes(category).length >= 1 && bytes(category).length <= 32, "Invalid category");
        require(bytes(counterparty).length <= 64 && bytes(description).length <= 280, "Text too long");

        Entry storage prev = entries[entryId - 1];
        uint256 old = prev.amount;
        Kind k = prev.kind;

        if (k == Kind.Income) {
            require(balance + newAmount >= old, "Correction would make balance negative");
            balance = balance + newAmount - old;
            totalIncome = totalIncome + newAmount - old;
        } else {
            require(newAmount <= balance + old, "Correction would make balance negative");
            balance = balance + old - newAmount;
            totalExpense = totalExpense + newAmount - old;
        }

        newId = entries.length + 1;
        entries.push(
            Entry({
                id: newId,
                kind: k,
                amount: newAmount,
                category: category,
                counterparty: counterparty,
                description: description,
                refCode: prev.refCode,
                poster: msg.sender,
                timestamp: uint64(block.timestamp),
                correctsId: entryId,
                reason: reason
            })
        );
        correctedBy[entryId] = newId;
        emit EntryCorrected(entryId, newId, msg.sender, reason);
    }

    // ───────────────────────────── Reads ─────────────────────────────

    /// @notice Number of entries (originals + corrections) ever recorded.
    /// @dev Rule: ids run 1..entryCount() with no gaps; entries are never removed.
    function entryCount() external view returns (uint256) {
        return entries.length;
    }

    /// @notice Read one entry by id.
    /// @dev Rule: reverts "Entry does not exist" when id is 0 or beyond entryCount().
    function getEntry(uint256 id) external view returns (Entry memory) {
        require(id >= 1 && id <= entries.length, "Entry does not exist");
        return entries[id - 1];
    }

    /// @notice Read a page of entries starting at startId.
    /// @dev Rules: count is capped at 50; startId == 0 or startId > entryCount() returns an empty array;
    ///      the end is clamped to entryCount().
    function getEntries(uint256 startId, uint256 count) external view returns (Entry[] memory page) {
        uint256 len = entries.length;
        if (startId == 0 || startId > len) return new Entry[](0);
        if (count > 50) count = 50;
        uint256 end = startId - 1 + count; // exclusive index
        if (end > len) end = len;
        page = new Entry[](end - (startId - 1));
        for (uint256 i = startId - 1; i < end; i++) {
            page[i - (startId - 1)] = entries[i];
        }
    }

    /// @notice Every version id for a receipt number, original first, latest last.
    /// @dev Rule: starts at idByRef (the original) and follows correctedBy until 0. Unknown receipt → empty.
    function versionsOf(string calldata refCode) external view returns (uint256[] memory ids) {
        uint256 first = idByRef[keccak256(bytes(refCode))];
        if (first == 0) return new uint256[](0);
        uint256 n = 1;
        for (uint256 cur = correctedBy[first]; cur != 0; cur = correctedBy[cur]) n++;
        ids = new uint256[](n);
        uint256 c = first;
        for (uint256 i = 0; i < n; i++) {
            ids[i] = c;
            c = correctedBy[c];
        }
    }

    /// @notice One-call overview for the home page.
    /// @dev Rule: balance always equals totalIncome - totalExpense.
    /// @return name Club name.
    /// @return adminAddr The admin (Club Advisor).
    /// @return bal Current balance in fils.
    /// @return income Total income in fils.
    /// @return expense Total expense in fils.
    /// @return count Number of entries.
    function summary()
        external
        view
        returns (
            string memory name,
            address adminAddr,
            uint256 bal,
            uint256 income,
            uint256 expense,
            uint256 count
        )
    {
        return (clubName, admin, balance, totalIncome, totalExpense, entries.length);
    }

    // ───────────────────────────── Internal ─────────────────────────────

    /// @notice Receipt-number format check.
    /// @dev Rule: 1–16 bytes, each byte in A–Z, 0–9 or '-'. Lowercase, spaces and anything else are refused.
    function _validRef(string calldata refCode) internal pure returns (bool) {
        bytes calldata b = bytes(refCode);
        if (b.length == 0 || b.length > 16) return false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x41 && c <= 0x5A) || (c >= 0x30 && c <= 0x39) || c == 0x2D;
            if (!ok) return false;
        }
        return true;
    }
}
