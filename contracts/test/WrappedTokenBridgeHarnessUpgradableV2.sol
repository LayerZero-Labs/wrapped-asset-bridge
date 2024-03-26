// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {WrappedTokenBridgeUpgradable} from "../bridges/WrappedTokenBridgeUpgradable.sol";

/// @dev Locks an ERC20 on the source chain and sends LZ message to the remote chain to mint a wrapped token
contract WrappedTokenBridgeHarnessUpgradableV2 is WrappedTokenBridgeUpgradable {

    function initialize(address _endpoint) override external initializer {
        __WrappedTokenBridgeBaseUpgradable_init(_endpoint);
    }
}
