// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ClubLedger} from "../src/ClubLedger.sol";

/// @notice Deploys ClubLedger with the admin key (PK_ADMIN becomes the Club Advisor).
contract Deploy is Script {
    function run() external returns (ClubLedger l) {
        uint256 pk = vm.envUint("PK_ADMIN");
        vm.startBroadcast(pk);
        l = new ClubLedger("BITS Dubai Robotics Club (demo)");
        vm.stopBroadcast();
        console2.log("ClubLedger deployed at", address(l));
    }
}
