// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {ISwapAdapter} from "../interfaces/ISwapAdapter.sol";

/// @notice Testnet-only, oracle-priced swap inventory. This is not a DEX.
contract InventorySwapAdapter is Ownable, ReentrancyGuard, ISwapAdapter {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;

    error InvalidConfiguration();
    error InsufficientInventory(address token, uint256 available, uint256 required);
    error SlippageExceeded(uint256 minimum, uint256 received);

    IPriceOracle public immutable priceOracle;
    uint16 public immutable executionBps;

    constructor(IPriceOracle priceOracle_, uint16 executionBps_, address initialOwner) Ownable(initialOwner) {
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
    ) external nonReentrant returns (uint256 amountOut) {
        amountOut = quote(tokenIn, tokenOut, amountIn);
        if (amountOut < minAmountOut) revert SlippageExceeded(minAmountOut, amountOut);

        uint256 inventory = IERC20(tokenOut).balanceOf(address(this));
        if (inventory < amountOut) revert InsufficientInventory(tokenOut, inventory, amountOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }

    function withdrawInventory(IERC20 token, address receiver, uint256 amount) external onlyOwner {
        token.safeTransfer(receiver, amount);
    }
}
