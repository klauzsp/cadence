// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {DcaStrategyFactory} from "../src/strategies/dca/DcaStrategyFactory.sol";
import {ISwapAdapter} from "../src/interfaces/ISwapAdapter.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {ChainlinkOracleRegistry} from "../src/oracles/ChainlinkOracleRegistry.sol";

contract DeployProtocol is Script {
    function run()
        external
        returns (VaultFactory factory, DcaStrategyFactory dcaStrategyFactory, ChainlinkOracleRegistry oracle)
    {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address adapter = vm.envAddress("SWAP_ADAPTER_ADDRESS");
        uint48 maxStaleness = uint48(vm.envOr("ORACLE_MAX_STALENESS", uint256(1 days)));

        address usdc = vm.envAddress("USDC_ADDRESS");
        address wmon = vm.envAddress("WMON_ADDRESS");
        address weth = vm.envAddress("WETH_ADDRESS");
        address usdcUsdFeed = vm.envAddress("USDC_USD_FEED");
        address monUsdFeed = vm.envAddress("MON_USD_FEED");
        address ethUsdFeed = vm.envAddress("ETH_USD_FEED");

        vm.startBroadcast(deployerPrivateKey);
        factory = new VaultFactory(deployer);
        oracle = new ChainlinkOracleRegistry(deployer);
        oracle.configureToken(usdc, AggregatorV3Interface(usdcUsdFeed), maxStaleness, true);
        oracle.configureToken(wmon, AggregatorV3Interface(monUsdFeed), maxStaleness, true);
        oracle.configureToken(weth, AggregatorV3Interface(ethUsdFeed), maxStaleness, true);
        dcaStrategyFactory = new DcaStrategyFactory(address(factory), ISwapAdapter(adapter), oracle);
        factory.setStrategy(dcaStrategyFactory.strategyId(), address(dcaStrategyFactory));
        vm.stopBroadcast();
    }
}
