// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDT0
/// @notice 6 decimals, mintable by owner. For demos on local/test networks.
contract MockUSDT0 is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor(uint256 initialSupply) ERC20("Tether USD0 (Mock)", "USDT0") Ownable(msg.sender) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
