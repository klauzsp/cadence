// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {ISwapAdapter} from "../interfaces/ISwapAdapter.sol";
import {DemoToken} from "./DemoToken.sol";

/// @notice Oracle-priced minting adapter for deterministic testnet demos. Never use in production.
contract DemoSwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;

    error InvalidConfiguration();
    error SlippageExceeded(uint256 minimum, uint256 received);

    IPriceOracle public immutable priceOracle;
    uint16 public immutable executionBps;

    constructor(IPriceOracle priceOracle_, uint16 executionBps_) {
        if (address(priceOracle_) == address(0) || executionBps_ == 0 || executionBps_ > BPS) {
            revert InvalidConfiguration();
        }
        priceOracle = priceOracle_;
        executionBps = executionBps_;
    }

    function quote(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256 amountOut) {
        return priceOracle.quote(tokenIn, tokenOut, amountIn) * executionBps / BPS;
    }

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        amountOut = quote(tokenIn, tokenOut, amountIn);
        if (amountOut < minAmountOut) revert SlippageExceeded(minAmountOut, amountOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        DemoToken(tokenOut).mint(recipient, amountOut);
    }
}
