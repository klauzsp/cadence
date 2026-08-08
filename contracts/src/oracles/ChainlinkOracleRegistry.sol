// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice USD-denominated Chainlink feed registry and DCA token allowlist.
contract ChainlinkOracleRegistry is Ownable, IPriceOracle {
    error InvalidConfiguration();
    error TokenNotConfigured(address token);
    error InvalidPrice(address token, int256 answer);
    error StalePrice(address token, uint256 updatedAt);
    error IncompleteRound(address token, uint80 roundId, uint80 answeredInRound);

    event TokenConfigured(address indexed token, address indexed feed, uint48 maxStaleness, bool allowed);
    event TokenAllowed(address indexed token, bool allowed);

    struct TokenConfig {
        AggregatorV3Interface feed;
        uint48 maxStaleness;
        uint8 tokenDecimals;
        uint8 feedDecimals;
        bool allowed;
    }

    mapping(address token => TokenConfig config) public tokenConfigs;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function configureToken(address token, AggregatorV3Interface feed, uint48 maxStaleness, bool allowed)
        external
        onlyOwner
    {
        if (token == address(0) || address(feed) == address(0) || maxStaleness == 0) {
            revert InvalidConfiguration();
        }

        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        uint8 feedDecimals = feed.decimals();
        if (tokenDecimals > 18 || feedDecimals > 18) revert InvalidConfiguration();

        tokenConfigs[token] = TokenConfig(feed, maxStaleness, tokenDecimals, feedDecimals, allowed);
        emit TokenConfigured(token, address(feed), maxStaleness, allowed);
    }

    /// @notice Stops new vaults using a token without breaking existing vault pricing.
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        TokenConfig storage config = tokenConfigs[token];
        if (address(config.feed) == address(0)) revert TokenNotConfigured(token);
        config.allowed = allowed;
        emit TokenAllowed(token, allowed);
    }

    function isTokenAllowed(address token) external view returns (bool) {
        return tokenConfigs[token].allowed;
    }

    function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        TokenConfig memory configIn = _configuredToken(tokenIn);
        TokenConfig memory configOut = _configuredToken(tokenOut);
        uint256 priceIn = _readPrice(tokenIn, configIn);
        uint256 priceOut = _readPrice(tokenOut, configOut);

        uint256 valueUsd = Math.mulDiv(amountIn, priceIn, 10 ** configIn.tokenDecimals);
        amountOut = Math.mulDiv(valueUsd, 10 ** configOut.tokenDecimals, priceOut);
    }

    function price(address token) external view returns (uint256 priceUsd) {
        TokenConfig memory config = _configuredToken(token);
        return _readPrice(token, config);
    }

    function _configuredToken(address token) private view returns (TokenConfig memory config) {
        config = tokenConfigs[token];
        if (address(config.feed) == address(0)) revert TokenNotConfigured(token);
    }

    function _readPrice(address token, TokenConfig memory config) private view returns (uint256 priceUsd) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = config.feed.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp) revert InvalidPrice(token, answer);
        if (answeredInRound < roundId) revert IncompleteRound(token, roundId, answeredInRound);
        if (block.timestamp - updatedAt > config.maxStaleness) revert StalePrice(token, updatedAt);

        priceUsd = uint256(answer) * (10 ** (18 - config.feedDecimals));
    }
}
