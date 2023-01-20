// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {WrappedTokenBridge} from "../WrappedTokenBridge.sol";

/// @dev used only in unit tests to call internal _nonblockingLzReceive
contract WrappedTokenBridgeHarness is WrappedTokenBridge {
    constructor(address _endpoint) WrappedTokenBridge(_endpoint) {}

    function simulateNonblockingLzReceive(uint16 srcChainId, bytes memory payload) external {
        _nonblockingLzReceive(srcChainId, "0x", 0, payload);
    }
}