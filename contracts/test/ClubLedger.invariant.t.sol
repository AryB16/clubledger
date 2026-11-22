// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClubLedger} from "../src/ClubLedger.sol";

/// @dev Drives random posts/corrections from random actors and records whether any call that
///      should have been refused (would go negative, or came from a non-poster) was accepted.
contract Handler is Test {
    ClubLedger public l;
    address[] public actors;
    uint256 public refCounter;

    uint256 public ghostBadAccepted; // calls that should have reverted but did not
    uint256 public ghostNegativeAttempts; // calls that would have gone negative (all must revert)
    uint256 public ghostSuccesses;
    uint256 public ghostIncome;
    uint256 public ghostExpense;

    constructor(ClubLedger _l, address[] memory _actors) {
        l = _l;
        actors = _actors;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function post(uint256 actorSeed, bool isExpense, uint256 amount) external {
        address a = _actor(actorSeed);
        amount = bound(amount, 1, 1_000_000_00);
        string memory ref = string(abi.encodePacked("R-", vm.toString(++refCounter)));
        uint256 bal = l.balance();
        bool wouldGoNegative = isExpense && amount > bal;
        bool shouldFail = !l.isPoster(a) || wouldGoNegative;
        if (wouldGoNegative && l.isPoster(a)) ghostNegativeAttempts++;

        vm.prank(a);
        try l.postEntry(
            isExpense ? ClubLedger.Kind.Expense : ClubLedger.Kind.Income, amount, "Cat", "", "", ref
        ) {
            if (shouldFail) ghostBadAccepted++;
            ghostSuccesses++;
            if (isExpense) ghostExpense += amount;
            else ghostIncome += amount;
        } catch {
            if (!shouldFail) ghostBadAccepted++; // a valid call was refused — also wrong
        }
    }

    function correct(uint256 actorSeed, uint256 idSeed, uint256 newAmount) external {
        uint256 n = l.entryCount();
        if (n == 0) return;
        address a = _actor(actorSeed);
        uint256 id = bound(idSeed, 1, n);
        newAmount = bound(newAmount, 0, 1_000_000_00);
        ClubLedger.Entry memory e = l.getEntry(id);
        uint256 bal = l.balance();
        bool wouldGoNegative = e.kind == ClubLedger.Kind.Income
            ? bal + newAmount < e.amount
            : newAmount > bal + e.amount;
        bool shouldFail = !l.isPoster(a) || l.correctedBy(id) != 0 || wouldGoNegative;
        if (wouldGoNegative && l.isPoster(a) && l.correctedBy(id) == 0) ghostNegativeAttempts++;

        vm.prank(a);
        try l.correctEntry(id, newAmount, "Cat", "", "", "fix") {
            if (shouldFail) ghostBadAccepted++;
            ghostSuccesses++;
            if (e.kind == ClubLedger.Kind.Income) ghostIncome = ghostIncome + newAmount - e.amount;
            else ghostExpense = ghostExpense + newAmount - e.amount;
        } catch {
            if (!shouldFail) ghostBadAccepted++;
        }
    }
}

contract ClubLedgerInvariantTest is Test {
    ClubLedger l;
    Handler h;

    function setUp() public {
        address admin = makeAddr("admin");
        address tres = makeAddr("treasurer");
        address asst = makeAddr("asst");
        address rando = makeAddr("random");
        vm.prank(admin);
        l = new ClubLedger("Invariant Club");
        vm.startPrank(admin);
        l.authorizePoster(tres, "Treasurer");
        l.authorizePoster(asst, "Asst. Treasurer");
        vm.stopPrank();

        address[] memory actors = new address[](4);
        actors[0] = tres;
        actors[1] = asst;
        actors[2] = rando;
        actors[3] = admin;
        h = new Handler(l, actors);
        targetContract(address(h));
    }

    /// balance == totalIncome - totalExpense, always.
    function invariant_balanceEqualsIncomeMinusExpense() public view {
        assertEq(l.balance(), l.totalIncome() - l.totalExpense());
    }

    /// Totals match an independent model of every accepted call.
    function invariant_totalsMatchModel() public view {
        assertEq(l.totalIncome(), h.ghostIncome());
        assertEq(l.totalExpense(), h.ghostExpense());
    }

    /// Every call that would have made the balance negative (or came from a non-poster) reverted,
    /// and every valid call succeeded.
    function invariant_noBadCallAccepted() public view {
        assertEq(h.ghostBadAccepted(), 0);
    }
}
