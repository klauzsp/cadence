// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {ChainlinkOracleRegistry} from "../src/oracles/ChainlinkOracleRegistry.sol";
import {RebalanceVault} from "../src/strategies/rebalance/RebalanceVault.sol";
import {RebalanceStrategyFactory} from "../src/strategies/rebalance/RebalanceStrategyFactory.sol";
import {MockChainlinkFeed} from "./mocks/MockChainlinkFeed.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapAdapter} from "./mocks/MockSwapAdapter.sol";

contract RebalanceStrategyTest is Test {
    uint256 private constant DEPOSIT = 1_000e18;
    uint256 private constant INTERVAL = 1 hours;
    uint16 private constant TARGET_BPS = 5_000;
    uint16 private constant THRESHOLD_BPS = 500;
    uint16 private constant MAX_SLIPPAGE_BPS = 100;

    address private depositor = makeAddr("depositor");
    address private keeper = makeAddr("keeper");
    MockERC20 private asset;
    MockERC20 private target;
    MockSwapAdapter private adapter;
    MockChainlinkFeed private assetFeed;
    MockChainlinkFeed private targetFeed;
    ChainlinkOracleRegistry private oracle;
    VaultFactory private factory;
    RebalanceStrategyFactory private strategyFactory;
    RebalanceVault private vault;
    bytes32 private strategyId;

    function setUp() public {
        vm.warp(1 days);
        asset = new MockERC20("Mock USD", "mUSD", 18);
        target = new MockERC20("Mock ETH", "mETH", 18);
        adapter = new MockSwapAdapter();
        assetFeed = new MockChainlinkFeed(8, 1e8);
        targetFeed = new MockChainlinkFeed(8, 1e8);
        oracle = new ChainlinkOracleRegistry(address(this));
        oracle.configureToken(address(asset), assetFeed, 2 days, true);
        oracle.configureToken(address(target), targetFeed, 2 days, true);

        factory = new VaultFactory(address(this));
        strategyFactory = new RebalanceStrategyFactory(address(factory), adapter, oracle);
        strategyId = strategyFactory.strategyId();
        factory.setStrategy(strategyId, address(strategyFactory));
        vault = RebalanceVault(factory.createVault(strategyId, _config()));

        asset.mint(depositor, DEPOSIT);
        asset.mint(address(adapter), 10_000e18);
        target.mint(address(adapter), 10_000e18);
        vm.prank(depositor);
        asset.approve(address(vault), type(uint256).max);
    }

    function testFactoryRegistersPermissionlessRebalanceVault() public {
        vm.prank(depositor);
        address anotherVault = factory.createVault(strategyId, _config());

        assertTrue(factory.isVault(anotherVault));
        assertEq(factory.vaultStrategy(anotherVault), strategyId);
        assertEq(factory.vaultCreator(anotherVault), depositor);
    }

    function testAnyoneCanRebalanceBelowTarget() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);

        (bool needed, uint256 beforeAllocation) = vault.needsRebalance();
        assertTrue(needed);
        assertEq(beforeAllocation, 0);

        vm.prank(keeper);
        uint256 received = vault.rebalance();

        assertEq(received, 500e18);
        assertEq(asset.balanceOf(address(vault)), 500e18);
        assertEq(target.balanceOf(address(vault)), 500e18);
        assertEq(vault.currentAllocationBps(), TARGET_BPS);
        assertEq(vault.totalAssets(), DEPOSIT);
        assertEq(vault.executionCount(), 1);
        assertEq(vault.totalRebalanced(), 500e18);
    }

    function testRebalancesBackFromAboveTarget() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.rebalance();

        vm.warp(block.timestamp + INTERVAL);
        target.mint(address(vault), 300e18);
        assertGt(vault.currentAllocationBps(), TARGET_BPS + THRESHOLD_BPS);

        vault.rebalance();

        assertApproxEqAbs(vault.currentAllocationBps(), TARGET_BPS, 1);
        assertEq(vault.executionCount(), 2);
    }

    function testCannotRebalanceInsideThreshold() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.rebalance();

        vm.warp(block.timestamp + INTERVAL);
        vm.expectRevert(abi.encodeWithSelector(RebalanceVault.AllocationWithinThreshold.selector, TARGET_BPS));
        vault.rebalance();
    }

    function testCooldownAppliesAfterRebalance() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.rebalance();

        vm.expectRevert(abi.encodeWithSelector(RebalanceVault.ExecutionNotReady.selector, block.timestamp + INTERVAL));
        vault.rebalance();
    }

    function testOracleSlippageProtectsRebalance() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        adapter.setOutputBps(9_800);

        vm.expectRevert(MockSwapAdapter.SlippageExceeded.selector);
        vault.rebalance();
    }

    function testWithdrawUnwindsTargetPosition() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.rebalance();

        vm.prank(depositor);
        vault.withdraw(DEPOSIT, depositor, depositor);

        assertEq(asset.balanceOf(depositor), DEPOSIT);
        assertEq(vault.balanceOf(depositor), 0);
        assertEq(target.balanceOf(address(vault)), 0);
    }

    function testInvalidAllocationBandIsRejected() public {
        bytes memory badConfig =
            abi.encode(asset, target, uint16(500), uint16(500), INTERVAL, MAX_SLIPPAGE_BPS, "Invalid", "BAD");
        vm.expectRevert(RebalanceVault.InvalidConfiguration.selector);
        factory.createVault(strategyId, badConfig);
    }

    function testUnsupportedTokenIsRejected() public {
        MockERC20 unsupported = new MockERC20("Unsupported", "NOPE", 18);
        bytes memory badConfig =
            abi.encode(asset, unsupported, TARGET_BPS, THRESHOLD_BPS, INTERVAL, MAX_SLIPPAGE_BPS, "Invalid", "BAD");
        vm.expectRevert(
            abi.encodeWithSelector(RebalanceStrategyFactory.UnsupportedToken.selector, address(unsupported))
        );
        factory.createVault(strategyId, badConfig);
    }

    function _config() private view returns (bytes memory) {
        return abi.encode(asset, target, TARGET_BPS, THRESHOLD_BPS, INTERVAL, MAX_SLIPPAGE_BPS, "Balanced Vault", "BAL");
    }
}
