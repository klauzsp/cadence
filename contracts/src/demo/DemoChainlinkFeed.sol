// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @notice Testnet relay target for prices read from Chainlink on Monad mainnet.
/// @dev This is centralized demo infrastructure, not a Chainlink deployment.
contract DemoChainlinkFeed is Ownable, AggregatorV3Interface {
    error InvalidAnswer();
    error InvalidTimestamp();

    event AnswerUpdated(int256 indexed answer, uint80 indexed roundId, uint256 sourceUpdatedAt);

    uint8 public constant override decimals = 8;
    string public description;
    uint80 public roundId;
    int256 public answer;
    uint256 public updatedAt;

    constructor(string memory description_, int256 initialAnswer, uint256 sourceUpdatedAt, address initialOwner)
        Ownable(initialOwner)
    {
        description = description_;
        _updateAnswer(initialAnswer, sourceUpdatedAt);
    }

    function updateAnswer(int256 newAnswer, uint256 sourceUpdatedAt) external onlyOwner {
        _updateAnswer(newAnswer, sourceUpdatedAt);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }

    function _updateAnswer(int256 newAnswer, uint256 sourceUpdatedAt) private {
        if (newAnswer <= 0) revert InvalidAnswer();
        if (sourceUpdatedAt == 0 || sourceUpdatedAt > block.timestamp || sourceUpdatedAt < updatedAt) {
            revert InvalidTimestamp();
        }

        roundId += 1;
        answer = newAnswer;
        updatedAt = sourceUpdatedAt;
        emit AnswerUpdated(newAnswer, roundId, sourceUpdatedAt);
    }
}
