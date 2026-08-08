// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStrategyFactory} from "./interfaces/IStrategyFactory.sol";

/// @notice Primary protocol entry point for creating registered ERC-4626 strategies.
/// @dev Strategy registration is curated; creating a vault from a registered strategy is permissionless.
contract VaultFactory is Ownable, ReentrancyGuard {
    error InvalidStrategyId();
    error InvalidStrategyFactory(address strategyFactory);
    error StrategyIdMismatch(bytes32 expected, bytes32 actual);
    error UnknownStrategy(bytes32 strategyId);
    error InvalidVault(address vault);

    event StrategySet(bytes32 indexed strategyId, address indexed previousFactory, address indexed strategyFactory);
    event VaultCreated(address indexed creator, address indexed vault, bytes32 indexed strategyId);

    mapping(bytes32 strategyId => address strategyFactory) public strategyFactories;
    mapping(address vault => bool registered) public isVault;
    mapping(address vault => bytes32 strategyId) public vaultStrategy;
    mapping(address vault => address creator) public vaultCreator;

    address[] private _vaults;
    mapping(address creator => address[] vaults) private _creatorVaults;

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Adds, replaces, or disables a strategy type. Use address(0) to disable one.
    function setStrategy(bytes32 strategyId, address strategyFactory) external onlyOwner {
        if (strategyId == bytes32(0)) revert InvalidStrategyId();
        if (strategyFactory != address(0)) {
            if (strategyFactory.code.length == 0) revert InvalidStrategyFactory(strategyFactory);
            bytes32 reportedId = IStrategyFactory(strategyFactory).strategyId();
            if (reportedId != strategyId) revert StrategyIdMismatch(strategyId, reportedId);
        }

        address previousFactory = strategyFactories[strategyId];
        strategyFactories[strategyId] = strategyFactory;
        emit StrategySet(strategyId, previousFactory, strategyFactory);
    }

    /// @notice Permissionlessly creates a vault using the selected strategy type.
    function createVault(bytes32 strategyId, bytes calldata initData) external nonReentrant returns (address vault) {
        address strategyFactory = strategyFactories[strategyId];
        if (strategyFactory == address(0)) revert UnknownStrategy(strategyId);

        vault = IStrategyFactory(strategyFactory).createStrategy(msg.sender, initData);
        if (vault == address(0) || vault.code.length == 0) revert InvalidVault(vault);

        isVault[vault] = true;
        vaultStrategy[vault] = strategyId;
        vaultCreator[vault] = msg.sender;
        _vaults.push(vault);
        _creatorVaults[msg.sender].push(vault);

        emit VaultCreated(msg.sender, vault, strategyId);
    }

    function vaultCount() external view returns (uint256) {
        return _vaults.length;
    }

    function vaultAt(uint256 index) external view returns (address) {
        return _vaults[index];
    }

    function creatorVaultCount(address creator) external view returns (uint256) {
        return _creatorVaults[creator].length;
    }

    function creatorVaultAt(address creator, uint256 index) external view returns (address) {
        return _creatorVaults[creator][index];
    }
}
