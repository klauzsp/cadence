// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DcaVault} from "../src/DcaVault.sol";
import {DcaVaultFactory} from "../src/DcaVaultFactory.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapAdapter} from "./mocks/MockSwapAdapter.sol";

contract DcaVaultTest is Test {
    uint256 private constant DEPOSIT = 1_000e18;
    uint256 private constant TRANCHE = 100e18;
    uint256 private constant INTERVAL = 1 days;

    address private depositor = makeAddr("depositor");
    address private keeper = makeAddr("keeper");
    MockERC20 private asset;
    MockERC20 private target;
    MockSwapAdapter private adapter;
    DcaVaultFactory private factory;
    DcaVault private vault;

    function setUp() public {
        asset = new MockERC20("Mock USD", "mUSD");
        target = new MockERC20("Mock MON", "mMON");
        adapter = new MockSwapAdapter();
        factory = new DcaVaultFactory(adapter);
        vault = factory.createVault(asset, target, TRANCHE, INTERVAL, "DCA MON", "dcaMON");

        asset.mint(depositor, DEPOSIT);
        target.mint(address(adapter), 10_000e18);
        asset.mint(address(adapter), 10_000e18);

        vm.prank(depositor);
        asset.approve(address(vault), type(uint256).max);
    }

    function testFactoryTracksPermissionlesslyCreatedVault() public view {
        assertEq(factory.vaultCount(), 1);
        assertEq(factory.vaultAt(0), address(vault));
    }

    function testDepositAndPermissionlessExecution() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);

        vm.prank(keeper);
        uint256 received = vault.executeDca(TRANCHE);

        assertEq(received, TRANCHE);
        assertEq(asset.balanceOf(address(vault)), DEPOSIT - TRANCHE);
        assertEq(target.balanceOf(address(vault)), TRANCHE);
        assertEq(vault.totalAssets(), DEPOSIT);
    }

    function testCannotExecuteTwiceInOneInterval() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.executeDca(0);

        vm.expectRevert(abi.encodeWithSelector(DcaVault.ExecutionNotReady.selector, block.timestamp + INTERVAL));
        vault.executeDca(0);
    }

    function testWithdrawUnwindsInvestedPosition() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.executeDca(0);

        vm.prank(depositor);
        vault.withdraw(DEPOSIT, depositor, depositor);

        assertEq(asset.balanceOf(depositor), DEPOSIT);
        assertEq(vault.balanceOf(depositor), 0);
        assertEq(target.balanceOf(address(vault)), 0);
    }

    function testExecutesAgainAfterInterval() public {
        vm.prank(depositor);
        vault.deposit(DEPOSIT, depositor);
        vault.executeDca(0);

        vm.warp(block.timestamp + INTERVAL);
        vault.executeDca(0);

        assertEq(target.balanceOf(address(vault)), TRANCHE * 2);
    }
}
