// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DcaVault} from "./DcaVault.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

/// @notice Permissionless factory for DCA strategy vaults using one reviewed swap adapter.
contract DcaVaultFactory {
    event VaultCreated(
        address indexed creator,
        address indexed vault,
        address indexed asset,
        address targetToken,
        uint256 amountPerSwap,
        uint256 interval
    );

    ISwapAdapter public immutable swapAdapter;
    address[] private _vaults;

    constructor(ISwapAdapter swapAdapter_) {
        if (address(swapAdapter_) == address(0)) revert DcaVault.InvalidConfiguration();
        swapAdapter = swapAdapter_;
    }

    function createVault(
        IERC20 asset,
        IERC20 targetToken,
        uint256 amountPerSwap,
        uint256 interval,
        string calldata name,
        string calldata symbol
    ) external returns (DcaVault vault) {
        vault = new DcaVault(asset, targetToken, swapAdapter, amountPerSwap, interval, name, symbol);
        _vaults.push(address(vault));
        emit VaultCreated(msg.sender, address(vault), address(asset), address(targetToken), amountPerSwap, interval);
    }

    function vaultCount() external view returns (uint256) {
        return _vaults.length;
    }

    function vaultAt(uint256 index) external view returns (address) {
        return _vaults[index];
    }
}
