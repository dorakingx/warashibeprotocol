// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {StrawNFT} from "../src/StrawNFT.sol";
import {WarashibeEscrow} from "../src/WarashibeEscrow.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        new StrawNFT();
        new WarashibeEscrow();
        vm.stopBroadcast();
    }
}
