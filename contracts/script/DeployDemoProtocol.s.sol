// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {ChainlinkOracleRegistry} from "../src/oracles/ChainlinkOracleRegistry.sol";
import {DcaStrategyFactory} from "../src/strategies/dca/DcaStrategyFactory.sol";
import {DemoChainlinkFeed} from "../src/demo/DemoChainlinkFeed.sol";
import {DemoSwapAdapter} from "../src/demo/DemoSwapAdapter.sol";
import {DemoToken} from "../src/demo/DemoToken.sol";

/// @notice Deploys a complete, clearly marked demo environment to Monad testnet.
contract DeployDemoProtocol is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        DemoToken[3] memory tokens = _deployTokens(deployer);
        DemoChainlinkFeed[3] memory feeds = _deployFeeds(deployer);

        ChainlinkOracleRegistry oracle = new ChainlinkOracleRegistry(deployer);
        uint48 maxStaleness = 2 hours;
        oracle.configureToken(address(tokens[0]), feeds[0], maxStaleness, true);
        oracle.configureToken(address(tokens[1]), feeds[1], maxStaleness, true);
        oracle.configureToken(address(tokens[2]), feeds[2], maxStaleness, true);

        DemoSwapAdapter adapter = new DemoSwapAdapter(oracle, 9_950);
        tokens[0].setMinter(address(adapter), true);
        tokens[1].setMinter(address(adapter), true);
        tokens[2].setMinter(address(adapter), true);

        VaultFactory factory = new VaultFactory(deployer);
        DcaStrategyFactory dcaFactory = new DcaStrategyFactory(address(factory), adapter, oracle);
        factory.setStrategy(dcaFactory.strategyId(), address(dcaFactory));

        vm.stopBroadcast();

        console2.log("VaultFactory", address(factory));
        console2.log("DcaStrategyFactory", address(dcaFactory));
        console2.log("ChainlinkOracleRegistry", address(oracle));
        console2.log("DemoSwapAdapter", address(adapter));
        console2.log("USDC", address(tokens[0]));
        console2.log("WMON", address(tokens[1]));
        console2.log("WETH", address(tokens[2]));
        console2.log("USDC_USD_FEED", address(feeds[0]));
        console2.log("MON_USD_FEED", address(feeds[1]));
        console2.log("ETH_USD_FEED", address(feeds[2]));
    }

    function _deployTokens(address deployer) private returns (DemoToken[3] memory tokens) {
        tokens[0] = new DemoToken("Demo USD Coin", "USDC", 6, 10_000e6, deployer);
        tokens[1] = new DemoToken("Demo Wrapped MON", "WMON", 18, 1_000e18, deployer);
        tokens[2] = new DemoToken("Demo Wrapped Ether", "WETH", 18, 10e18, deployer);
    }

    function _deployFeeds(address deployer) private returns (DemoChainlinkFeed[3] memory feeds) {
        feeds[0] = new DemoChainlinkFeed(
            "USDC / USD (Chainlink relay)",
            int256(vm.envUint("USDC_USD_PRICE")),
            vm.envUint("USDC_USD_UPDATED_AT"),
            deployer
        );
        feeds[1] = new DemoChainlinkFeed(
            "MON / USD (Chainlink relay)",
            int256(vm.envUint("MON_USD_PRICE")),
            vm.envUint("MON_USD_UPDATED_AT"),
            deployer
        );
        feeds[2] = new DemoChainlinkFeed(
            "ETH / USD (Chainlink relay)",
            int256(vm.envUint("ETH_USD_PRICE")),
            vm.envUint("ETH_USD_UPDATED_AT"),
            deployer
        );
    }
}
