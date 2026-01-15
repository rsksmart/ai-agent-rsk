// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title UmbrellaOracleAdapter (Mock)
/// @notice Minimal, owner-settable prices for quick demos.
///         Replace with a real oracle integration for production.
contract UmbrellaOracleAdapter is IPriceOracle, Ownable {
    /// @dev Price mapping: asset => USD price with 18 decimals (1e18 = $1).
    mapping(address => uint256) public pricesE18;

    event PriceUpdated(address indexed asset, uint256 priceE18);

    constructor() Ownable(msg.sender) {}

    function setPriceE18(address asset, uint256 priceE18) external onlyOwner {
        require(asset != address(0) || asset == address(0), "invalid asset");
        require(priceE18 > 0, "invalid price");
        pricesE18[asset] = priceE18;
        emit PriceUpdated(asset, priceE18);
    }

    function setBatch(address[] calldata assets, uint256[] calldata prices) external onlyOwner {
        require(assets.length == prices.length, "length mismatch");
        for (uint256 i = 0; i < assets.length; i++) {
            require(prices[i] > 0, "invalid price");
            pricesE18[assets[i]] = prices[i];
            emit PriceUpdated(assets[i], prices[i]);
        }
    }

    /// @inheritdoc IPriceOracle
    function getPrice(address asset) external view override returns (uint256 priceE18) {
        priceE18 = pricesE18[asset];
        require(priceE18 > 0, "PRICE_NOT_SET");
    }
}
