// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {NativeDepositRouter, IWrappedNative} from "../src/NativeDepositRouter.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {ChainlinkOracleRegistry} from "../src/oracles/ChainlinkOracleRegistry.sol";
import {DcaStrategyFactory} from "../src/strategies/dca/DcaStrategyFactory.sol";
import {DemoToken} from "../src/demo/DemoToken.sol";
import {InventorySwapAdapter} from "../src/demo/InventorySwapAdapter.sol";

/// @notice Deploys official WMON plus test USDC/WETH with finite, Chainlink-priced swap inventory.
contract DeployHybridDemo is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        IWrappedNative wmon = IWrappedNative(vm.envAddress("WMON_ADDRESS"));
        AggregatorV3Interface usdcFeed = AggregatorV3Interface(vm.envAddress("USDC_USD_FEED"));
        AggregatorV3Interface monFeed = AggregatorV3Interface(vm.envAddress("MON_USD_FEED"));
        AggregatorV3Interface ethFeed = AggregatorV3Interface(vm.envAddress("ETH_USD_FEED"));
        uint256 wmonInventory = vm.envOr("WMON_INVENTORY", uint256(0.1 ether));

        vm.startBroadcast(deployerPrivateKey);

        DemoToken usdc = new DemoToken("Test USD Coin", "tUSDC", 6, 10_000e6, deployer);
        DemoToken weth = new DemoToken("Test Wrapped Ether", "tWETH", 18, 10e18, deployer);

        ChainlinkOracleRegistry oracle = new ChainlinkOracleRegistry(deployer);
        uint48 maxStaleness = 2 hours;
        oracle.configureToken(address(usdc), usdcFeed, maxStaleness, true);
        oracle.configureToken(address(wmon), monFeed, maxStaleness, true);
        oracle.configureToken(address(weth), ethFeed, maxStaleness, true);

        InventorySwapAdapter adapter = new InventorySwapAdapter(oracle, 9_950, deployer);
        NativeDepositRouter nativeDepositRouter = new NativeDepositRouter(wmon);

        usdc.setMinter(deployer, true);
        weth.setMinter(deployer, true);
        usdc.mint(address(adapter), 1_000_000e6);
        weth.mint(address(adapter), 500e18);
        usdc.setMinter(deployer, false);
        weth.setMinter(deployer, false);

        wmon.deposit{value: wmonInventory}();
        IERC20(address(wmon)).transfer(address(adapter), wmonInventory);

        VaultFactory factory = new VaultFactory(deployer);
        DcaStrategyFactory dcaFactory = new DcaStrategyFactory(address(factory), adapter, oracle);
        factory.setStrategy(dcaFactory.strategyId(), address(dcaFactory));

        vm.stopBroadcast();

        console2.log("VaultFactory", address(factory));
        console2.log("DcaStrategyFactory", address(dcaFactory));
        console2.log("ChainlinkOracleRegistry", address(oracle));
        console2.log("InventorySwapAdapter", address(adapter));
        console2.log("NativeDepositRouter", address(nativeDepositRouter));
        console2.log("TestUSDC", address(usdc));
        console2.log("OfficialWMON", address(wmon));
        console2.log("TestWETH", address(weth));
    }
}
