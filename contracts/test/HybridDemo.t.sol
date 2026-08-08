// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {NativeDepositRouter, IWrappedNative} from "../src/NativeDepositRouter.sol";
import {DemoToken} from "../src/demo/DemoToken.sol";
import {InventorySwapAdapter} from "../src/demo/InventorySwapAdapter.sol";
import {ChainlinkOracleRegistry} from "../src/oracles/ChainlinkOracleRegistry.sol";
import {MockChainlinkFeed} from "./mocks/MockChainlinkFeed.sol";

contract MockWrappedNative is ERC20, IWrappedNative {
    constructor() ERC20("Wrapped MON", "WMON") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
}

contract MockWmonVault is ERC4626 {
    constructor(IERC20 asset_) ERC20("MON Vault", "vMON") ERC4626(asset_) {}
}

contract HybridDemoTest is Test {
    address private investor = makeAddr("investor");
    MockWrappedNative private wmon;
    DemoToken private weth;
    ChainlinkOracleRegistry private oracle;
    InventorySwapAdapter private adapter;

    function setUp() public {
        vm.warp(2 days);
        wmon = new MockWrappedNative();
        weth = new DemoToken("Test WETH", "tWETH", 18, 10e18, address(this));

        MockChainlinkFeed monFeed = new MockChainlinkFeed(8, 20_000_000);
        MockChainlinkFeed ethFeed = new MockChainlinkFeed(8, 200_000_000_000);
        oracle = new ChainlinkOracleRegistry(address(this));
        oracle.configureToken(address(wmon), monFeed, 2 hours, true);
        oracle.configureToken(address(weth), ethFeed, 2 hours, true);
        adapter = new InventorySwapAdapter(oracle, 9_950, address(this));

        weth.setMinter(address(this), true);
        weth.mint(address(adapter), 100e18);
    }

    function testInventorySwapUsesOraclePriceAndFiniteTokens() public {
        vm.deal(investor, 100 ether);
        vm.startPrank(investor);
        wmon.deposit{value: 10 ether}();
        wmon.approve(address(adapter), 10 ether);
        uint256 received = adapter.swapExactInput(address(wmon), address(weth), 10 ether, 0.00099e18, investor);
        vm.stopPrank();

        assertEq(received, 0.000995e18);
        assertEq(weth.balanceOf(investor), received);
        assertEq(wmon.balanceOf(address(adapter)), 10 ether);
    }

    function testInventorySwapRevertsWhenOutputInventoryIsEmpty() public {
        adapter.withdrawInventory(weth, address(this), weth.balanceOf(address(adapter)));
        vm.deal(investor, 1 ether);
        vm.startPrank(investor);
        wmon.deposit{value: 1 ether}();
        wmon.approve(address(adapter), 1 ether);
        vm.expectRevert();
        adapter.swapExactInput(address(wmon), address(weth), 1 ether, 0, investor);
        vm.stopPrank();
    }

    function testNativeRouterWrapsAndDepositsMon() public {
        MockWmonVault vault = new MockWmonVault(wmon);
        NativeDepositRouter router = new NativeDepositRouter(wmon);
        vm.deal(investor, 5 ether);

        vm.prank(investor);
        uint256 shares = router.deposit{value: 2 ether}(vault, investor);

        assertEq(shares, 2 ether);
        assertEq(vault.balanceOf(investor), 2 ether);
        assertEq(wmon.balanceOf(address(vault)), 2 ether);
        assertEq(wmon.balanceOf(address(router)), 0);
    }
}
