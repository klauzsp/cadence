// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {ChainlinkOracleRegistry} from "../src/oracles/ChainlinkOracleRegistry.sol";
import {DcaVault} from "../src/strategies/dca/DcaVault.sol";
import {DcaStrategyFactory} from "../src/strategies/dca/DcaStrategyFactory.sol";
import {MockChainlinkFeed} from "./mocks/MockChainlinkFeed.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapAdapter} from "./mocks/MockSwapAdapter.sol";

contract VaultFactoryTest is Test {
    uint256 private constant DEPOSIT = 1_000e18;
    uint256 private constant TRANCHE = 100e18;
    uint256 private constant INTERVAL = 1 days;
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
    DcaStrategyFactory private dcaStrategyFactory;
    DcaVault private vault;
    bytes32 private dcaStrategyId;

    function setUp() public {
        vm.warp(1 days);
        asset = new MockERC20("Mock USD", "mUSD", 18);
        target = new MockERC20("Mock MON", "mMON", 18);
        adapter = new MockSwapAdapter();
        assetFeed = new MockChainlinkFeed(8, 1e8);
        targetFeed = new MockChainlinkFeed(8, 1e8);
        oracle = new ChainlinkOracleRegistry(address(this));
        oracle.configureToken(address(asset), assetFeed, 1 days, true);
        oracle.configureToken(address(target), targetFeed, 1 days, true);

        factory = new VaultFactory(address(this));
        dcaStrategyFactory = new DcaStrategyFactory(address(factory), adapter, oracle);
        dcaStrategyId = dcaStrategyFactory.strategyId();
        factory.setStrategy(dcaStrategyId, address(dcaStrategyFactory));
        vault = DcaVault(factory.createVault(dcaStrategyId, _dcaConfig()));

        asset.mint(depositor, DEPOSIT);
        target.mint(address(adapter), 10_000e18);
        asset.mint(address(adapter), 10_000e18);

        vm.prank(depositor);
        asset.approve(address(vault), type(uint256).max);
    }

    function testPrimaryFactoryTracksVaultAndStrategy() public view {
        assertEq(factory.vaultCount(), 1);
        assertEq(factory.vaultAt(0), address(vault));
        assertTrue(factory.isVault(address(vault)));
        assertEq(factory.vaultStrategy(address(vault)), dcaStrategyId);
        assertEq(factory.creatorVaultCount(address(this)), 1);
        assertEq(factory.creatorVaultAt(address(this), 0), address(vault));
    }

    function testAnyoneCanCreateARegisteredStrategy() public {
        vm.prank(depositor);
        address depositorVault = factory.createVault(dcaStrategyId, _dcaConfig());

        assertTrue(factory.isVault(depositorVault));
        assertEq(factory.creatorVaultCount(depositor), 1);
        assertEq(factory.creatorVaultAt(depositor, 0), depositorVault);
    }

    function testOnlyOwnerCanRegisterStrategies() public {
        vm.prank(depositor);
        vm.expectRevert();
        factory.setStrategy(dcaStrategyId, address(dcaStrategyFactory));
    }

    function testUnknownStrategyCannotBeCreated() public {
        bytes32 unknownId = keccak256("REBALANCE_V1");
        vm.expectRevert(abi.encodeWithSelector(VaultFactory.UnknownStrategy.selector, unknownId));
        factory.createVault(unknownId, "");
    }

    function testDcaFactoryCannotBeCalledDirectly() public {
        vm.expectRevert(DcaStrategyFactory.OnlyVaultFactory.selector);
        dcaStrategyFactory.createStrategy(address(this), _dcaConfig());
    }

    function testUnsupportedTokenCannotBeUsedForNewVault() public {
        MockERC20 unsupported = new MockERC20("Unsupported", "NOPE", 18);
        bytes memory config = abi.encode(unsupported, target, TRANCHE, INTERVAL, MAX_SLIPPAGE_BPS, "Nope", "NOPE");

        vm.expectRevert(abi.encodeWithSelector(DcaStrategyFactory.UnsupportedToken.selector, address(unsupported)));
        factory.createVault(dcaStrategyId, config);
    }

    function testDisablingTokenOnlyStopsNewVaults() public {
        oracle.setTokenAllowed(address(target), false);

        assertEq(vault.totalAssets(), 0);
        vm.expectRevert(abi.encodeWithSelector(DcaStrategyFactory.UnsupportedToken.selector, address(target)));
        factory.createVault(dcaStrategyId, _dcaConfig());
    }

    function testOracleHandlesTokenDecimals() public {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockChainlinkFeed usdcFeed = new MockChainlinkFeed(8, 1e8);
        targetFeed.setAnswer(2_000e8);
        oracle.configureToken(address(usdc), usdcFeed, 1 days, true);

        assertEq(oracle.quote(address(usdc), address(target), 1_000e6), 0.5e18);
    }

    function testDisablingStrategyDoesNotAffectExistingVault() public {
        factory.setStrategy(dcaStrategyId, address(0));

        assertTrue(factory.isVault(address(vault)));
        vm.expectRevert(abi.encodeWithSelector(VaultFactory.UnknownStrategy.selector, dcaStrategyId));
        factory.createVault(dcaStrategyId, _dcaConfig());
    }

    function testDepositAndPermissionlessExecution() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);

        vm.prank(keeper);
        uint256 received = vault.executeDca();

        assertEq(received, TRANCHE);
        assertEq(asset.balanceOf(address(vault)), DEPOSIT - TRANCHE);
        assertEq(target.balanceOf(address(vault)), TRANCHE);
        assertEq(vault.totalAssets(), DEPOSIT);
    }

    function testCannotExecuteTwiceInOneInterval() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.executeDca();

        vm.expectRevert(abi.encodeWithSelector(DcaVault.ExecutionNotReady.selector, block.timestamp + INTERVAL));
        vault.executeDca();
    }

    function testOracleMinimumProtectsPermissionlessExecution() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        adapter.setOutputBps(9_800);

        vm.expectRevert(MockSwapAdapter.SlippageExceeded.selector);
        vm.prank(keeper);
        vault.executeDca();
    }

    function testStaleOracleStopsExecution() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectRevert();
        vault.executeDca();
    }

    function testWithdrawUnwindsInvestedPosition() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.executeDca();

        vm.prank(depositor);
        vault.withdraw(DEPOSIT, depositor, depositor);

        assertEq(asset.balanceOf(depositor), DEPOSIT);
        assertEq(vault.balanceOf(depositor), 0);
        assertEq(target.balanceOf(address(vault)), 0);
    }

    function testExecutesAgainAfterInterval() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.executeDca();

        vm.warp(block.timestamp + INTERVAL);
        assetFeed.setAnswer(1e8);
        targetFeed.setAnswer(1e8);
        vault.executeDca();

        assertEq(target.balanceOf(address(vault)), TRANCHE * 2);
    }

    function _dcaConfig() private view returns (bytes memory) {
        return abi.encode(asset, target, TRANCHE, INTERVAL, MAX_SLIPPAGE_BPS, "DCA MON", "dcaMON");
    }
}
