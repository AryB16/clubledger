// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClubLedger} from "../src/ClubLedger.sol";

contract ClubLedgerTest is Test {
    ClubLedger l;
    address admin = makeAddr("admin");
    address tres = makeAddr("treasurer");
    address asst = makeAddr("asst");
    address rando = makeAddr("random");

    ClubLedger.Kind constant IN = ClubLedger.Kind.Income;
    ClubLedger.Kind constant EX = ClubLedger.Kind.Expense;

    event PosterAuthorized(address indexed who, string label);
    event PosterRevoked(address indexed who);
    event EntryPosted(uint256 indexed id, address indexed poster, ClubLedger.Kind kind, uint256 amount, string refCode);
    event EntryCorrected(uint256 indexed previousId, uint256 indexed newId, address indexed poster, string reason);

    function setUp() public {
        vm.prank(admin);
        l = new ClubLedger("Test Club");
        vm.startPrank(admin);
        l.authorizePoster(tres, "Treasurer");
        l.authorizePoster(asst, "Asst. Treasurer");
        vm.stopPrank();
    }

    // ── helpers ──
    function _post(address who, ClubLedger.Kind k, uint256 amt, string memory ref) internal returns (uint256) {
        vm.prank(who);
        return l.postEntry(k, amt, "Cat", "Someone", "Desc", ref);
    }

    function _correct(address who, uint256 id, uint256 amt, string memory reason) internal returns (uint256) {
        vm.prank(who);
        return l.correctEntry(id, amt, "Cat", "Someone", "Desc", reason);
    }

    function _str(uint256 n) internal pure returns (string memory s) {
        bytes memory b = new bytes(n);
        for (uint256 i; i < n; i++) b[i] = "A";
        s = string(b);
    }

    function _checkBooks() internal view {
        assertEq(l.balance(), l.totalIncome() - l.totalExpense());
    }

    // ── constructor / summary ──
    function test_constructor() public view {
        assertEq(l.admin(), admin);
        assertEq(l.clubName(), "Test Club");
        (string memory n, address a, uint256 b, uint256 i, uint256 e, uint256 c) = l.summary();
        assertEq(n, "Test Club");
        assertEq(a, admin);
        assertEq(b, 0);
        assertEq(i, 0);
        assertEq(e, 0);
        assertEq(c, 0);
    }

    // ── Rule 1: only authorised treasurers ──
    function test_postIncome_updatesBooksAndEmits() public {
        vm.expectEmit(true, true, false, true, address(l));
        emit EntryPosted(1, tres, IN, 500000, "INC-0001");
        uint256 id = _post(tres, IN, 500000, "INC-0001");
        assertEq(id, 1);
        assertEq(l.balance(), 500000);
        assertEq(l.totalIncome(), 500000);
        assertEq(l.totalExpense(), 0);
        assertEq(l.entryCount(), 1);
        assertEq(l.idByRef(keccak256("INC-0001")), 1);
        ClubLedger.Entry memory e = l.getEntry(1);
        assertEq(e.id, 1);
        assertEq(uint8(e.kind), 0);
        assertEq(e.poster, tres);
        assertEq(e.timestamp, uint64(block.timestamp));
        assertEq(e.correctsId, 0);
        assertEq(e.reason, "");
    }

    function test_randomCannotPost() public {
        vm.prank(rando);
        vm.expectRevert(bytes("Not an authorised poster"));
        l.postEntry(IN, 100, "Cat", "", "", "INC-0001");
    }

    function test_adminCannotPost() public {
        vm.prank(admin);
        vm.expectRevert(bytes("Not an authorised poster"));
        l.postEntry(IN, 100, "Cat", "", "", "INC-0001");
    }

    function test_randomCannotCorrect() public {
        _post(tres, IN, 100, "INC-0001");
        vm.prank(rando);
        vm.expectRevert(bytes("Not an authorised poster"));
        l.correctEntry(1, 50, "Cat", "", "", "fix");
    }

    function test_revokedPosterCannotPostOrCorrect() public {
        _post(tres, IN, 100, "INC-0001");
        vm.expectEmit(true, false, false, false, address(l));
        emit PosterRevoked(tres);
        vm.prank(admin);
        l.revokePoster(tres);
        assertFalse(l.isPoster(tres));
        assertEq(l.posterLabel(tres), "Treasurer"); // label kept
        vm.prank(tres);
        vm.expectRevert(bytes("Not an authorised poster"));
        l.postEntry(IN, 100, "Cat", "", "", "INC-0002");
        vm.prank(tres);
        vm.expectRevert(bytes("Not an authorised poster"));
        l.correctEntry(1, 50, "Cat", "", "", "fix");
        // another current poster can still correct it
        _correct(asst, 1, 50, "fix");
        assertEq(l.balance(), 50);
    }

    // ── Rule 2: books never negative ──
    function test_expenseEqualBalanceSucceeds() public {
        _post(tres, IN, 1000, "INC-0001");
        _post(tres, EX, 1000, "EXP-0001");
        assertEq(l.balance(), 0);
        assertEq(l.totalExpense(), 1000);
        _checkBooks();
    }

    function test_expenseOverBalanceRefused() public {
        _post(tres, IN, 1000, "INC-0001");
        vm.prank(tres);
        vm.expectRevert(bytes("Expense exceeds club balance"));
        l.postEntry(EX, 1001, "Cat", "", "", "EXP-0001");
        assertEq(l.balance(), 1000);
    }

    function test_expenseOnEmptyBooksRefused() public {
        vm.prank(tres);
        vm.expectRevert(bytes("Expense exceeds club balance"));
        l.postEntry(EX, 1, "Cat", "", "", "EXP-0001");
    }

    function test_incomeCorrectionAfterSpending_boundary() public {
        _post(tres, IN, 1000, "INC-0001");
        _post(tres, EX, 700, "EXP-0001"); // balance 300
        // 1 fil over: lowering income to 699 would make balance -1
        vm.prank(tres);
        vm.expectRevert(bytes("Correction would make balance negative"));
        l.correctEntry(1, 699, "Cat", "", "", "lower");
        // exact boundary: 700 → balance 0
        _correct(tres, 1, 700, "lower");
        assertEq(l.balance(), 0);
        assertEq(l.totalIncome(), 700);
        _checkBooks();
    }

    function test_expenseCorrectionOverBalanceRefused() public {
        _post(tres, IN, 1000, "INC-0001");
        _post(tres, EX, 600, "EXP-0001"); // balance 400
        vm.prank(tres);
        vm.expectRevert(bytes("Correction would make balance negative"));
        l.correctEntry(2, 1001, "Cat", "", "", "raise");
        _correct(tres, 2, 1000, "raise");
        assertEq(l.balance(), 0);
        assertEq(l.totalExpense(), 1000);
        _checkBooks();
    }

    // ── Rule 3: receipt recorded once ──
    function test_duplicateRefRefused() public {
        _post(tres, IN, 100, "INC-0001");
        vm.prank(asst);
        vm.expectRevert(bytes("Reference code already used"));
        l.postEntry(IN, 100, "Cat", "", "", "INC-0001");
    }

    function test_refCodeAfterCorrectionStillUsed() public {
        _post(tres, IN, 100, "INC-0001");
        _correct(tres, 1, 50, "fix");
        vm.prank(tres);
        vm.expectRevert(bytes("Reference code already used"));
        l.postEntry(IN, 100, "Cat", "", "", "INC-0001");
    }

    function test_invalidRefCodes() public {
        string[5] memory bad = ["exp-0001", "", "ABCDEFGHIJKLMNOPQ", "EXP 0001", "EXP_0001"];
        for (uint256 i; i < bad.length; i++) {
            vm.prank(tres);
            vm.expectRevert(bytes("Invalid reference code"));
            l.postEntry(IN, 100, "Cat", "", "", bad[i]);
        }
        // 16 chars, digits, dashes are fine
        _post(tres, IN, 100, "ABCDEFGHIJKLMNOP");
        _post(tres, IN, 100, "0-9-Z");
    }

    // ── Rule 4: no edits, only corrections ──
    function test_correctionKeepsOriginalByteIdentical() public {
        _post(tres, IN, 100000, "INC-0001");
        vm.prank(tres);
        l.postEntry(EX, 42000, "Events", "Campus Cafe", "Workshop refreshments", "EXP-0002");
        bytes memory before = abi.encode(l.getEntry(2));
        ClubLedger.Entry memory o1 = l.getEntry(2);

        vm.warp(block.timestamp + 1 days);
        vm.expectEmit(true, true, true, true, address(l));
        emit EntryCorrected(2, 3, asst, "Vendor refunded AED 40");
        vm.prank(asst);
        uint256 nid = l.correctEntry(2, 38000, "Events2", "Cafe2", "Desc2", "Vendor refunded AED 40");
        assertEq(nid, 3);

        ClubLedger.Entry memory o2 = l.getEntry(2);
        assertEq(keccak256(abi.encode(o2)), keccak256(before));
        assertEq(o2.id, o1.id);
        assertEq(uint8(o2.kind), uint8(o1.kind));
        assertEq(o2.amount, o1.amount);
        assertEq(o2.category, o1.category);
        assertEq(o2.counterparty, o1.counterparty);
        assertEq(o2.description, o1.description);
        assertEq(o2.refCode, o1.refCode);
        assertEq(o2.poster, o1.poster);
        assertEq(o2.timestamp, o1.timestamp);
        assertEq(o2.correctsId, o1.correctsId);
        assertEq(o2.reason, o1.reason);

        ClubLedger.Entry memory c = l.getEntry(3);
        assertEq(c.id, 3);
        assertEq(uint8(c.kind), uint8(EX));
        assertEq(c.amount, 38000);
        assertEq(c.category, "Events2");
        assertEq(c.refCode, "EXP-0002");
        assertEq(c.poster, asst);
        assertEq(c.correctsId, 2);
        assertEq(c.reason, "Vendor refunded AED 40");
        assertEq(c.timestamp, uint64(block.timestamp));
        assertEq(l.correctedBy(2), 3);
        assertEq(l.correctedBy(3), 0);
        assertEq(l.idByRef(keccak256("EXP-0002")), 2); // not touched
        assertEq(l.balance(), 100000 - 38000);
        assertEq(l.totalExpense(), 38000);
        _checkBooks();
    }

    function test_chainedCorrections() public {
        _post(tres, IN, 10000, "INC-0001");
        uint256 a = _post(tres, EX, 3000, "EXP-0001");
        assertEq(l.balance(), 7000);
        uint256 b = _correct(tres, a, 2000, "B");
        assertEq(l.balance(), 8000);
        uint256 c = _correct(asst, b, 4500, "C");
        assertEq(l.balance(), 5500);
        assertEq(l.totalExpense(), 4500);
        _checkBooks();

        vm.prank(tres);
        vm.expectRevert(bytes("Entry already corrected - correct the latest version"));
        l.correctEntry(a, 1, "Cat", "", "", "again");
        vm.prank(tres);
        vm.expectRevert(bytes("Entry already corrected - correct the latest version"));
        l.correctEntry(b, 1, "Cat", "", "", "again");

        uint256[] memory v = l.versionsOf("EXP-0001");
        assertEq(v.length, 3);
        assertEq(v[0], a);
        assertEq(v[1], b);
        assertEq(v[2], c);
        assertEq(l.versionsOf("INC-0001").length, 1);
        assertEq(l.versionsOf("NOPE").length, 0);
        assertEq(l.versionsOf("exp-0001").length, 0);
    }

    function test_cancelThenReinstate() public {
        _post(tres, IN, 10000, "INC-0001");
        _post(tres, EX, 3000, "EXP-0001");
        uint256 cancel = _correct(tres, 2, 0, "Duplicate");
        assertEq(l.getEntry(cancel).amount, 0);
        assertEq(l.balance(), 10000);
        assertEq(l.totalExpense(), 0);
        uint256 back = _correct(tres, cancel, 2500, "Not a duplicate after all");
        assertEq(l.getEntry(back).amount, 2500);
        assertEq(l.balance(), 7500);
        assertEq(l.totalExpense(), 2500);
        _checkBooks();
        assertEq(l.versionsOf("EXP-0001").length, 3);
    }

    function test_cancelIncome() public {
        _post(tres, IN, 10000, "INC-0001");
        _correct(tres, 1, 0, "Sponsor withdrew");
        assertEq(l.balance(), 0);
        assertEq(l.totalIncome(), 0);
    }

    // ── input validation ──
    function test_amountZeroRefused() public {
        vm.prank(tres);
        vm.expectRevert(bytes("Amount must be greater than zero"));
        l.postEntry(IN, 0, "Cat", "", "", "INC-0001");
    }

    function test_categoryAndTextLimits() public {
        vm.startPrank(tres);
        vm.expectRevert(bytes("Invalid category"));
        l.postEntry(IN, 1, "", "", "", "INC-0001");
        vm.expectRevert(bytes("Invalid category"));
        l.postEntry(IN, 1, _str(33), "", "", "INC-0001");
        vm.expectRevert(bytes("Text too long"));
        l.postEntry(IN, 1, "Cat", _str(65), "", "INC-0001");
        vm.expectRevert(bytes("Text too long"));
        l.postEntry(IN, 1, "Cat", "", _str(281), "INC-0001");
        // exact maxima are accepted
        l.postEntry(IN, 1, _str(32), _str(64), _str(280), "INC-0001");
        vm.stopPrank();
    }

    function test_correctionValidation() public {
        _post(tres, IN, 1000, "INC-0001");
        vm.startPrank(tres);
        vm.expectRevert(bytes("Entry does not exist"));
        l.correctEntry(0, 1, "Cat", "", "", "r");
        vm.expectRevert(bytes("Entry does not exist"));
        l.correctEntry(2, 1, "Cat", "", "", "r");
        vm.expectRevert(bytes("Reason required"));
        l.correctEntry(1, 1, "Cat", "", "", "");
        vm.expectRevert(bytes("Text too long"));
        l.correctEntry(1, 1, "Cat", "", "", _str(141));
        vm.expectRevert(bytes("Invalid category"));
        l.correctEntry(1, 1, "", "", "", "r");
        vm.expectRevert(bytes("Text too long"));
        l.correctEntry(1, 1, "Cat", _str(65), "", "r");
        vm.expectRevert(bytes("Text too long"));
        l.correctEntry(1, 1, "Cat", "", _str(281), "r");
        l.correctEntry(1, 1, "Cat", "", "", _str(140));
        vm.stopPrank();
    }

    // ── admin edge cases ──
    function test_authorizeEmitsAndSets() public {
        vm.expectEmit(true, false, false, true, address(l));
        emit PosterAuthorized(rando, "Helper");
        vm.prank(admin);
        l.authorizePoster(rando, "Helper");
        assertTrue(l.isPoster(rando));
        assertEq(l.posterLabel(rando), "Helper");
    }

    function test_adminEdgeCases() public {
        vm.startPrank(admin);
        vm.expectRevert(bytes("Invalid address"));
        l.authorizePoster(address(0), "X");
        vm.expectRevert(bytes("Admin cannot be a poster"));
        l.authorizePoster(admin, "X");
        vm.expectRevert(bytes("Already a poster"));
        l.authorizePoster(tres, "X");
        vm.expectRevert(bytes("Invalid label"));
        l.authorizePoster(rando, "");
        vm.expectRevert(bytes("Invalid label"));
        l.authorizePoster(rando, _str(33));
        vm.expectRevert(bytes("Not a poster"));
        l.revokePoster(rando);
        vm.stopPrank();

        vm.prank(rando);
        vm.expectRevert(bytes("Only the admin can manage posters"));
        l.authorizePoster(rando, "Me");
        vm.prank(tres);
        vm.expectRevert(bytes("Only the admin can manage posters"));
        l.revokePoster(asst);
    }

    function test_reauthorizeAfterRevoke() public {
        vm.startPrank(admin);
        l.revokePoster(tres);
        l.authorizePoster(tres, "Treasurer 2");
        vm.stopPrank();
        assertTrue(l.isPoster(tres));
        assertEq(l.posterLabel(tres), "Treasurer 2");
    }

    // ── reads ──
    function test_getEntryOutOfRange() public {
        vm.expectRevert(bytes("Entry does not exist"));
        l.getEntry(0);
        vm.expectRevert(bytes("Entry does not exist"));
        l.getEntry(1);
    }

    function test_getEntriesPaging() public {
        assertEq(l.getEntries(1, 10).length, 0); // empty ledger
        for (uint256 i; i < 60; i++) {
            _post(tres, IN, 1, string(abi.encodePacked("INC-", vm.toString(i))));
        }
        assertEq(l.getEntries(0, 10).length, 0);
        assertEq(l.getEntries(61, 10).length, 0);
        assertEq(l.getEntries(1, 100).length, 50); // capped
        ClubLedger.Entry[] memory p = l.getEntries(51, 50); // clamped
        assertEq(p.length, 10);
        assertEq(p[0].id, 51);
        assertEq(p[9].id, 60);
        assertEq(l.getEntries(60, 1)[0].id, 60);
        assertEq(l.getEntries(5, 0).length, 0);
    }

    // ── no ETH ──
    function test_sendingEthReverts() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(l).call{value: 1}("");
        assertFalse(ok);
        (ok,) = address(l).call{value: 1}(hex"deadbeef");
        assertFalse(ok);
        assertEq(address(l).balance, 0);
    }

    // ── full seed table  ──
    function test_seedScenarioEndsAt458000() public {
        _post(tres, IN, 500000, "INC-0001");
        _post(asst, IN, 120000, "INC-0002");
        _post(tres, IN, 250000, "INC-0003");
        _post(tres, EX, 185000, "EXP-0001");
        uint256 e2 = _post(tres, EX, 42000, "EXP-0002");
        _post(asst, EX, 90000, "EXP-0003");
        uint256 e4 = _post(tres, EX, 30000, "EXP-0004");
        _post(tres, IN, 75000, "INC-0004");
        _post(asst, EX, 64000, "EXP-0005");
        _post(tres, EX, 110000, "EXP-0006");
        _correct(tres, e2, 38000, "Vendor refunded AED 40 for undelivered items");
        _correct(tres, e4, 0, "Duplicate - invoice already paid by Student Council");
        assertEq(l.balance(), 458000);
        assertEq(l.totalIncome(), 945000);
        assertEq(l.totalExpense(), 487000);
        assertEq(l.entryCount(), 12);
        assertEq(l.versionsOf("EXP-0002").length, 2);
    }
}
