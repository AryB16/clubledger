// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ClubLedger} from "../src/ClubLedger.sol";

/// @notice Seeds the fictional data and asserts the end balance is AED 4,580.00.
contract Seed is Script {
    ClubLedger.Kind constant IN = ClubLedger.Kind.Income;
    ClubLedger.Kind constant EX = ClubLedger.Kind.Expense;

    function run() external {
        ClubLedger l = ClubLedger(vm.envAddress("CLUBLEDGER_ADDRESS"));
        uint256 pkAdmin = vm.envUint("PK_ADMIN");
        uint256 pkT = vm.envUint("PK_TREASURER");
        uint256 pkA = vm.envUint("PK_ASST");
        address tres = vm.addr(pkT);
        address asst = vm.addr(pkA);

        vm.startBroadcast(pkAdmin);
        l.authorizePoster(tres, "Treasurer");
        l.authorizePoster(asst, "Asst. Treasurer");
        vm.stopBroadcast();

        vm.startBroadcast(pkT);
        l.postEntry(IN, 500000, "Sponsorship", "Nova Robotics LLC (fictional)", "Season sponsorship", "INC-0001");
        vm.stopBroadcast();

        vm.startBroadcast(pkA);
        l.postEntry(IN, 120000, "Membership", "40 members", unicode"40 × AED 30 membership fees", "INC-0002");
        vm.stopBroadcast();

        vm.startBroadcast(pkT);
        l.postEntry(IN, 250000, "Grant", "Student Council", "Activity grant", "INC-0003");
        l.postEntry(EX, 185000, "Equipment", "Circuit Souk (fictional)", "Servo motors and microcontroller kits", "EXP-0001");
        uint256 exp2 = l.postEntry(EX, 42000, "Events", unicode"Campus Café (fictional)", "Workshop refreshments", "EXP-0002");
        vm.stopBroadcast();

        vm.startBroadcast(pkA);
        l.postEntry(EX, 90000, "Competition", "Inter-Uni Robotics Meet (fictional)", "Team registration", "EXP-0003");
        vm.stopBroadcast();

        vm.startBroadcast(pkT);
        uint256 exp4 = l.postEntry(EX, 30000, "Printing", "PrintHub (fictional)", "Event posters", "EXP-0004");
        l.postEntry(IN, 75000, "Events", "Ticket sales", "Robot-sumo night tickets", "INC-0004");
        vm.stopBroadcast();

        vm.startBroadcast(pkA);
        l.postEntry(EX, 64000, "Transport", "Desert Coaches (fictional)", "Bus hire for competition", "EXP-0005");
        vm.stopBroadcast();

        vm.startBroadcast(pkT);
        l.postEntry(EX, 110000, "Equipment", "Circuit Souk (fictional)", "3D printer filament and spares", "EXP-0006");
        l.correctEntry(exp2, 38000, "Events", unicode"Campus Café (fictional)", "Workshop refreshments",
            "Vendor refunded AED 40 for undelivered items");
        l.correctEntry(exp4, 0, "Printing", "PrintHub (fictional)", "Event posters",
            unicode"Duplicate — invoice already paid by Student Council");
        vm.stopBroadcast();

        require(l.balance() == 458000, "Seed balance mismatch");
        console2.log("Seed complete. Balance (fils):", l.balance());
    }
}
