// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapAdapter} from "../../interfaces/ISwapAdapter.sol";
import {IPriceOracle} from "../../interfaces/IPriceOracle.sol";

/// @notice An ERC-4626 vault that keeps a second token inside a target allocation band.
contract RebalanceVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_SLIPPAGE_BPS = 1_000;

    error InvalidConfiguration();
    error ExecutionNotReady(uint256 nextExecution);
    error NothingToRebalance();
    error AllocationWithinThreshold(uint256 currentAllocationBps);
    error SlippageExceeded(uint256 minimum, uint256 received);
    error InsufficientLiquidity(uint256 available, uint256 required);

    event Rebalanced(
        address indexed executor,
        address indexed tokenIn,
        uint256 amountIn,
        address indexed tokenOut,
        uint256 amountOut,
        uint256 secondaryAllocationBps,
        uint256 nextExecution
    );

    IERC20 public immutable targetToken;
    ISwapAdapter public immutable swapAdapter;
    IPriceOracle public immutable priceOracle;
    uint16 public immutable targetAllocationBps;
    uint16 public immutable thresholdBps;
    uint256 public immutable interval;
    uint16 public immutable maxSlippageBps;
    uint256 public nextExecution;
    uint256 public executionCount;
    uint256 public totalRebalanced;

    constructor(
        IERC20 asset_,
        IERC20 targetToken_,
        ISwapAdapter swapAdapter_,
        IPriceOracle priceOracle_,
        uint16 targetAllocationBps_,
        uint16 thresholdBps_,
        uint256 interval_,
        uint16 maxSlippageBps_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) ERC4626(asset_) {
        if (
            address(asset_) == address(0) || address(targetToken_) == address(0) || address(swapAdapter_) == address(0)
                || address(priceOracle_) == address(0) || address(asset_) == address(targetToken_)
                || targetAllocationBps_ == 0 || targetAllocationBps_ >= BPS || thresholdBps_ == 0
                || thresholdBps_ >= targetAllocationBps_ || uint256(targetAllocationBps_) + thresholdBps_ >= BPS
                || interval_ == 0 || maxSlippageBps_ > MAX_SLIPPAGE_BPS
        ) revert InvalidConfiguration();

        targetToken = targetToken_;
        swapAdapter = swapAdapter_;
        priceOracle = priceOracle_;
        targetAllocationBps = targetAllocationBps_;
        thresholdBps = thresholdBps_;
        interval = interval_;
        maxSlippageBps = maxSlippageBps_;
        nextExecution = block.timestamp;
    }

    /// @notice Values both portfolio legs in the ERC-4626 deposit asset.
    function totalAssets() public view override returns (uint256) {
        uint256 idleAssets = IERC20(asset()).balanceOf(address(this));
        uint256 targetBalance = targetToken.balanceOf(address(this));
        if (targetBalance == 0) return idleAssets;
        return idleAssets + priceOracle.quote(address(targetToken), asset(), targetBalance);
    }

    function currentAllocationBps() public view returns (uint256) {
        uint256 portfolioValue = totalAssets();
        if (portfolioValue == 0) return 0;
        uint256 targetValue = priceOracle.quote(address(targetToken), asset(), targetToken.balanceOf(address(this)));
        return Math.mulDiv(targetValue, BPS, portfolioValue);
    }

    function needsRebalance() public view returns (bool needed, uint256 allocationBps) {
        allocationBps = currentAllocationBps();
        uint256 lowerBound = uint256(targetAllocationBps) - thresholdBps;
        uint256 upperBound = uint256(targetAllocationBps) + thresholdBps;
        needed = totalAssets() > 0 && (allocationBps < lowerBound || allocationBps > upperBound);
    }

    /// @notice Restores the target allocation when it is outside the configured band. Anyone may call it when due.
    function rebalance() external nonReentrant returns (uint256 amountOut) {
        if (block.timestamp < nextExecution) revert ExecutionNotReady(nextExecution);

        address tokenIn;
        address tokenOut;
        uint256 amountIn;

        {
            uint256 portfolioValue = totalAssets();
            if (portfolioValue == 0) revert NothingToRebalance();

            uint256 targetBalance = targetToken.balanceOf(address(this));
            uint256 targetValue = priceOracle.quote(address(targetToken), asset(), targetBalance);
            uint256 allocationBps = Math.mulDiv(targetValue, BPS, portfolioValue);
            uint256 lowerBound = uint256(targetAllocationBps) - thresholdBps;
            uint256 upperBound = uint256(targetAllocationBps) + thresholdBps;
            if (allocationBps >= lowerBound && allocationBps <= upperBound) {
                revert AllocationWithinThreshold(allocationBps);
            }

            uint256 desiredTargetValue = Math.mulDiv(portfolioValue, targetAllocationBps, BPS);
            if (targetValue < desiredTargetValue) {
                tokenIn = asset();
                tokenOut = address(targetToken);
                amountIn = desiredTargetValue - targetValue;
                uint256 assetBalance = IERC20(asset()).balanceOf(address(this));
                if (amountIn > assetBalance) amountIn = assetBalance;
            } else {
                tokenIn = address(targetToken);
                tokenOut = asset();
                amountIn = priceOracle.quote(asset(), address(targetToken), targetValue - desiredTargetValue);
                if (amountIn > targetBalance) amountIn = targetBalance;
            }
        }
        if (amountIn == 0) revert NothingToRebalance();

        nextExecution = block.timestamp + interval;
        amountOut = _swap(tokenIn, tokenOut, amountIn);

        executionCount += 1;
        totalRebalanced += priceOracle.quote(tokenIn, asset(), amountIn);
        emit Rebalanced(msg.sender, tokenIn, amountIn, tokenOut, amountOut, currentAllocationBps(), nextExecution);
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn) private returns (uint256 amountOut) {
        uint256 expectedOut = priceOracle.quote(tokenIn, tokenOut, amountIn);
        uint256 minAmountOut = Math.mulDiv(expectedOut, BPS - maxSlippageBps, BPS);
        IERC20 inputToken = IERC20(tokenIn);
        IERC20 outputToken = IERC20(tokenOut);
        uint256 balanceBefore = outputToken.balanceOf(address(this));

        inputToken.forceApprove(address(swapAdapter), amountIn);
        swapAdapter.swapExactInput(tokenIn, tokenOut, amountIn, minAmountOut, address(this));
        inputToken.forceApprove(address(swapAdapter), 0);
        amountOut = outputToken.balanceOf(address(this)) - balanceBefore;
        if (amountOut < minAmountOut) revert SlippageExceeded(minAmountOut, amountOut);
    }

    /// @dev The hackathon MVP fully unwinds the target leg only when idle assets cannot cover a withdrawal.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        IERC20 assetToken = IERC20(asset());
        uint256 idleAssets = assetToken.balanceOf(address(this));

        if (idleAssets < assets) {
            uint256 targetBalance = targetToken.balanceOf(address(this));
            uint256 expectedAssets = priceOracle.quote(address(targetToken), asset(), targetBalance);
            uint256 oracleMinAssets = Math.mulDiv(expectedAssets, BPS - maxSlippageBps, BPS);
            uint256 requiredAssets = assets - idleAssets;
            uint256 minAssetsOut = oracleMinAssets > requiredAssets ? oracleMinAssets : requiredAssets;

            targetToken.forceApprove(address(swapAdapter), targetBalance);
            swapAdapter.swapExactInput(address(targetToken), asset(), targetBalance, minAssetsOut, address(this));
            targetToken.forceApprove(address(swapAdapter), 0);
        }

        uint256 available = assetToken.balanceOf(address(this));
        if (available < assets) revert InsufficientLiquidity(available, assets);
        super._withdraw(caller, receiver, owner, assets, shares);
    }
}
