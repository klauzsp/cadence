// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Deploys one kind of strategy vault for the primary VaultFactory.
interface IStrategyFactory {
    function strategyId() external view returns (bytes32);

    function createStrategy(address creator, bytes calldata initData) external returns (address vault);
}
