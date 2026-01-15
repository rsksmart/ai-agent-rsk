// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPriceOracle {
    /// @notice Returns the USD price for 1 unit of `asset` with 18 decimals (1e18 = $1).
    function getPrice(address asset) external view returns (uint256 priceE18);
}
