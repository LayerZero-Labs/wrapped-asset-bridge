// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {WrappedERC20} from "./WrappedERC20.sol";

contract USDC is WrappedERC20 {
	constructor(address _bridge) WrappedERC20(_bridge, "USD Coin", "USDC", 6) {}
}