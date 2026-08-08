// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

/// @notice An ERC-4626 vault that permissionlessly DCA-swaps idle assets into one target token.
/// @dev The adapter is part of the vault's trust model. Production adapters need manipulation-resistant quotes.
contract DcaVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidConfiguration();
    error ExecutionNotReady(uint256 nextExecution);
    error NothingToInvest();
    error SlippageExceeded(uint256 minimum, uint256 received);
    error InsufficientLiquidity(uint256 available, uint256 required);

    event DcaExecuted(address indexed executor, uint256 assetsIn, uint256 targetTokensOut, uint256 nextExecution);

    IERC20 public immutable targetToken;
    ISwapAdapter public immutable swapAdapter;
    uint256 public immutable amountPerSwap;
    uint256 public immutable interval;
    uint256 public nextExecution;

    constructor(
        IERC20 asset_,
        IERC20 targetToken_,
        ISwapAdapter swapAdapter_,
        uint256 amountPerSwap_,
        uint256 interval_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) ERC4626(asset_) {
        if (
            address(asset_) == address(0) || address(targetToken_) == address(0) || address(swapAdapter_) == address(0)
                || address(asset_) == address(targetToken_) || amountPerSwap_ == 0 || interval_ == 0
        ) revert InvalidConfiguration();

        targetToken = targetToken_;
        swapAdapter = swapAdapter_;
        amountPerSwap = amountPerSwap_;
        interval = interval_;
        nextExecution = block.timestamp;
    }

    /// @notice Values both idle assets and invested target tokens in the ERC-4626 asset.
    function totalAssets() public view override returns (uint256) {
        uint256 idleAssets = IERC20(asset()).balanceOf(address(this));
        uint256 investedBalance = targetToken.balanceOf(address(this));
        if (investedBalance == 0) return idleAssets;
        return idleAssets + swapAdapter.quote(address(targetToken), asset(), investedBalance);
    }

    /// @notice Executes one tranche. Anyone can call this after the current interval elapses.
    function executeDca(uint256 minTargetTokensOut) external nonReentrant returns (uint256 targetTokensOut) {
        if (block.timestamp < nextExecution) revert ExecutionNotReady(nextExecution);

        IERC20 assetToken = IERC20(asset());
        uint256 idleAssets = assetToken.balanceOf(address(this));
        uint256 assetsToInvest = idleAssets < amountPerSwap ? idleAssets : amountPerSwap;
        if (assetsToInvest == 0) revert NothingToInvest();

        nextExecution = block.timestamp + interval;
        uint256 targetBalanceBefore = targetToken.balanceOf(address(this));
        assetToken.forceApprove(address(swapAdapter), assetsToInvest);
        swapAdapter.swapExactInput(asset(), address(targetToken), assetsToInvest, minTargetTokensOut, address(this));
        assetToken.forceApprove(address(swapAdapter), 0);
        targetTokensOut = targetToken.balanceOf(address(this)) - targetBalanceBefore;
        if (targetTokensOut < minTargetTokensOut) revert SlippageExceeded(minTargetTokensOut, targetTokensOut);

        emit DcaExecuted(msg.sender, assetsToInvest, targetTokensOut, nextExecution);
    }

    /// @dev If idle assets are insufficient, unwind the target position before the ERC-4626 transfer.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        IERC20 assetToken = IERC20(asset());
        uint256 idleAssets = assetToken.balanceOf(address(this));

        if (idleAssets < assets) {
            uint256 targetBalance = targetToken.balanceOf(address(this));
            targetToken.forceApprove(address(swapAdapter), targetBalance);
            swapAdapter.swapExactInput(address(targetToken), asset(), targetBalance, assets - idleAssets, address(this));
            targetToken.forceApprove(address(swapAdapter), 0);
        }

        uint256 available = assetToken.balanceOf(address(this));
        if (available < assets) revert InsufficientLiquidity(available, assets);
        super._withdraw(caller, receiver, owner, assets, shares);
    }
}
