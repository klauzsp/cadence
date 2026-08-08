// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Faucet token for the Monad testnet demo. Never use in production.
contract DemoToken is ERC20, Ownable {
    error OnlyMinter();

    event MinterSet(address indexed minter, bool allowed);

    uint8 private immutable _tokenDecimals;
    uint256 public immutable faucetAmount;
    mapping(address minter => bool allowed) public isMinter;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 faucetAmount_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        _tokenDecimals = decimals_;
        faucetAmount = faucetAmount_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function faucet() external {
        _mint(msg.sender, faucetAmount);
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        isMinter[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    function mint(address recipient, uint256 amount) external {
        if (!isMinter[msg.sender]) revert OnlyMinter();
        _mint(recipient, amount);
    }
}
