// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWrappedNative is IERC20 {
    function deposit() external payable;
}

/// @notice Wraps native MON and deposits official WMON into an ERC-4626 vault in one transaction.
contract NativeDepositRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidConfiguration();
    error InvalidReceiver();
    error InvalidVaultAsset(address asset);
    error ZeroDeposit();

    IWrappedNative public immutable wrappedNative;

    constructor(IWrappedNative wrappedNative_) {
        if (address(wrappedNative_) == address(0)) revert InvalidConfiguration();
        wrappedNative = wrappedNative_;
    }

    function deposit(IERC4626 vault, address receiver) external payable nonReentrant returns (uint256 shares) {
        if (receiver == address(0)) revert InvalidReceiver();
        if (msg.value == 0) revert ZeroDeposit();
        if (vault.asset() != address(wrappedNative)) revert InvalidVaultAsset(vault.asset());

        wrappedNative.deposit{value: msg.value}();
        IERC20(address(wrappedNative)).forceApprove(address(vault), msg.value);
        shares = vault.deposit(msg.value, receiver);
        IERC20(address(wrappedNative)).forceApprove(address(vault), 0);
    }

    receive() external payable {
        if (msg.sender != address(wrappedNative)) revert InvalidConfiguration();
    }
}
