// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ChainlinkOracleRegistry} from "../src/oracles/ChainlinkOracleRegistry.sol";
import {DemoChainlinkFeed} from "../src/demo/DemoChainlinkFeed.sol";
import {DemoSwapAdapter} from "../src/demo/DemoSwapAdapter.sol";
import {DemoToken} from "../src/demo/DemoToken.sol";

contract DemoProtocolTest is Test {
    address private investor = makeAddr("investor");
    DemoToken private usdc;
    DemoToken private weth;
    DemoChainlinkFeed private usdcFeed;
    DemoChainlinkFeed private wethFeed;
    ChainlinkOracleRegistry private oracle;
    DemoSwapAdapter private adapter;

    function setUp() public {
        vm.warp(2 days);
        usdc = new DemoToken("Demo USDC", "USDC", 6, 10_000e6, address(this));
        weth = new DemoToken("Demo WETH", "WETH", 18, 10e18, address(this));
        usdcFeed = new DemoChainlinkFeed("USDC / USD", 1e8, block.timestamp, address(this));
        wethFeed = new DemoChainlinkFeed("ETH / USD", 2_000e8, block.timestamp, address(this));
        oracle = new ChainlinkOracleRegistry(address(this));
        oracle.configureToken(address(usdc), usdcFeed, 2 hours, true);
        oracle.configureToken(address(weth), wethFeed, 2 hours, true);
        adapter = new DemoSwapAdapter(oracle, 9_950);
        weth.setMinter(address(adapter), true);
    }

    function testFaucetAndOraclePricedSwap() public {
        vm.startPrank(investor);
        usdc.faucet();
        usdc.approve(address(adapter), 2_000e6);
        uint256 received = adapter.swapExactInput(address(usdc), address(weth), 2_000e6, 0.99e18, investor);
        vm.stopPrank();

        assertEq(received, 0.995e18);
        assertEq(weth.balanceOf(investor), 0.995e18);
    }

    function testRelayedPriceBecomesStale() public {
        vm.warp(block.timestamp + 2 hours + 1);
        vm.expectRevert();
        oracle.price(address(weth));
    }

    function testOnlyOwnerCanUpdateRelay() public {
        vm.prank(investor);
        vm.expectRevert();
        wethFeed.updateAnswer(2_100e8, block.timestamp);
    }
}
