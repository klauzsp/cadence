// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {ISwapAdapter} from "../src/interfaces/ISwapAdapter.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {RebalanceStrategyFactory} from "../src/strategies/rebalance/RebalanceStrategyFactory.sol";

/// @notice Adds REBALANCE_V1 to an existing primary VaultFactory without replacing the protocol.
contract DeployRebalanceStrategy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        VaultFactory factory = VaultFactory(vm.envAddress("VAULT_FACTORY_ADDRESS"));
        ISwapAdapter adapter = ISwapAdapter(vm.envAddress("SWAP_ADAPTER_ADDRESS"));
        IPriceOracle oracle = IPriceOracle(vm.envAddress("PRICE_ORACLE_ADDRESS"));
        address existingFactory = vm.envOr("REBALANCE_STRATEGY_FACTORY_ADDRESS", address(0));

        vm.startBroadcast(deployerPrivateKey);
        RebalanceStrategyFactory rebalanceFactory = existingFactory == address(0)
            ? new RebalanceStrategyFactory(address(factory), adapter, oracle)
            : RebalanceStrategyFactory(existingFactory);
        factory.setStrategy(rebalanceFactory.strategyId(), address(rebalanceFactory));
        vm.stopBroadcast();

        console2.log("RebalanceStrategyFactory", address(rebalanceFactory));
    }
}
