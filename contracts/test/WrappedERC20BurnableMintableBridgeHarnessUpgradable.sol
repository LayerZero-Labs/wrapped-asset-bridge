// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {WrappedERC20BurnableMintableBridgeUpgradable} from "../bridges/WrappedERC20BurnableMintableBridgeUpgradable.sol";

/// @dev Locks an ERC20 on the source chain and sends LZ message to the remote chain to mint a wrapped token
contract WrappedERC20BurnableMintableBridgeHarnessUpgradable is WrappedERC20BurnableMintableBridgeUpgradable {

    function initialize(address _endpoint) override external initializer {
        __WrappedTokenBridgeBaseUpgradable_init(_endpoint);
    }

    function simulateNonblockingLzReceive(uint16 srcChainId, bytes memory payload) external {
        _nonblockingLzReceive(srcChainId, "0x", 0, payload);
    }
}
