// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice DEX-specific routing boundary used by DCA vaults.
/// @dev Adapters must quote in tokenOut units and pull tokenIn from msg.sender.
interface ISwapAdapter {
    function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut);

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
