// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapAdapter} from "../../src/interfaces/ISwapAdapter.sol";

contract MockSwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;

    error SlippageExceeded();

    uint256 public outputBps = 10_000;

    function setOutputBps(uint256 outputBps_) external {
        outputBps = outputBps_;
    }

    function quote(address, address, uint256 amountIn) external view returns (uint256 amountOut) {
        return amountIn * outputBps / 10_000;
    }

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        amountOut = amountIn * outputBps / 10_000;
        if (amountOut < minAmountOut) revert SlippageExceeded();
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}
