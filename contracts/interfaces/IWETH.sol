// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title Interface for WETH and other wrapped native gas tokens (e.g., WBNB, WAVAX, etc.)
interface IWETH {
    /// @notice Deposit ether to get wrapped ether
    function deposit() external payable;

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint) external;
}