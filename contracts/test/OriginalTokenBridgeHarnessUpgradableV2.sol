// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {OriginalTokenBridgeUpgradable} from "../bridges/OriginalTokenBridgeUpgradable.sol";

/// @dev used only in unit tests to call internal _nonblockingLzReceive
contract OriginalTokenBridgeHarnessUpgradableV2 is OriginalTokenBridgeUpgradable {
      
    function initialize(address _endpoint, uint16 _remoteChainId, address _weth) override external initializer {
        __OriginalTokenBridgeBaseUpgradable_init(_endpoint, _remoteChainId, _weth);
    }
}
