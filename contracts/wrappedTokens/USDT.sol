// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {WrappedERC20} from "../WrappedERC20.sol";

contract USDT is WrappedERC20 {
	constructor(address _bridge) WrappedERC20(_bridge, "Tether USD", "USDT", 6) {}
}