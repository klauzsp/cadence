// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategyFactory} from "../../interfaces/IStrategyFactory.sol";
import {ISwapAdapter} from "../../interfaces/ISwapAdapter.sol";
import {IPriceOracle} from "../../interfaces/IPriceOracle.sol";
import {DcaVault} from "./DcaVault.sol";

/// @notice Strategy-specific deployer registered with the primary VaultFactory.
contract DcaStrategyFactory is IStrategyFactory {
    error OnlyVaultFactory();
    error InvalidConfiguration();
    error UnsupportedToken(address token);

    bytes32 public constant override strategyId = keccak256("DCA_V1");

    address public immutable vaultFactory;
    ISwapAdapter public immutable swapAdapter;
    IPriceOracle public immutable priceOracle;

    constructor(address vaultFactory_, ISwapAdapter swapAdapter_, IPriceOracle priceOracle_) {
        if (vaultFactory_ == address(0) || address(swapAdapter_) == address(0) || address(priceOracle_) == address(0)) {
            revert InvalidConfiguration();
        }
        vaultFactory = vaultFactory_;
        swapAdapter = swapAdapter_;
        priceOracle = priceOracle_;
    }

    /// @dev initData = abi.encode(asset, targetToken, amountPerSwap, interval, maxSlippageBps, name, symbol).
    function createStrategy(address, bytes calldata initData) external returns (address vault) {
        if (msg.sender != vaultFactory) revert OnlyVaultFactory();

        (
            IERC20 asset,
            IERC20 targetToken,
            uint256 amountPerSwap,
            uint256 interval,
            uint16 maxSlippageBps,
            string memory name,
            string memory symbol
        ) = abi.decode(initData, (IERC20, IERC20, uint256, uint256, uint16, string, string));

        if (!priceOracle.isTokenAllowed(address(asset))) revert UnsupportedToken(address(asset));
        if (!priceOracle.isTokenAllowed(address(targetToken))) revert UnsupportedToken(address(targetToken));

        vault = address(
            new DcaVault(
                asset, targetToken, swapAdapter, priceOracle, amountPerSwap, interval, maxSlippageBps, name, symbol
            )
        );
    }
}
