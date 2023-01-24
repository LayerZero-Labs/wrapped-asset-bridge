// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {NonblockingLzApp} from "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

/// @dev An abstract contract containing a common functionality used by OriginalTokenBridge and WrappedTokenBridge
abstract contract TokenBridgeBase is NonblockingLzApp, ReentrancyGuard {
    /// @notice A packet type used to identify messages requesting minting of wrapped tokens
    uint8 public constant PT_MINT = 0;

    /// @notice A packet type used to identify messages requesting unlocking of original tokens
    uint8 public constant PT_UNLOCK = 1;

    bool public useCustomAdapterParams;

    event SetUseCustomAdapterParams(bool useCustomAdapterParams);

    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    /// @notice Sets the `useCustomAdapterParams` flag indicating whether the contract uses custom adapter parameters or the default ones
    /// @dev Can be called only by the bridge owner
    function setUseCustomAdapterParams(bool _useCustomAdapterParams) external onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    /// @dev Checks `adapterParams` for correctness
    function _checkAdapterParams(uint16 dstChainId, uint16 pkType, bytes memory adapterParams) internal virtual {
        if (useCustomAdapterParams) {
            _checkGasLimit(dstChainId, pkType, adapterParams, 0);
        } else {
            require(adapterParams.length == 0, "TokenBridgeBase: adapterParams must be empty");
        }
    }

    /// @dev Overrides the renounce ownership logic inherited from openZeppelin `Ownable`
    function renounceOwnership() public override onlyOwner {}
}