// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {DcaVaultFactory} from "../src/DcaVaultFactory.sol";
import {ISwapAdapter} from "../src/interfaces/ISwapAdapter.sol";

contract DeployFactory is Script {
    function run() external returns (DcaVaultFactory factory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address adapter = vm.envAddress("SWAP_ADAPTER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        factory = new DcaVaultFactory(ISwapAdapter(adapter));
        vm.stopBroadcast();
    }
}
