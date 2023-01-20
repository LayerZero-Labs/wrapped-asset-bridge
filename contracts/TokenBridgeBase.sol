// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {NonblockingLzApp} from "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

/// @dev An abstract contract containing a common functionality used by OriginalTokenBridge and WrappedTokenBridge
abstract contract TokenBridgeBase is NonblockingLzApp, ReentrancyGuard {
    /// @notice A packet type used to identify messages sent from an original token chain when an original token is locked
    uint8 public constant PT_WRAP = 0;

    /// @notice A packet type used to identify messages sent from a wrapped token chain when a wrapped token is burnt
    uint8 public constant PT_UNWRAP = 1;

    bool public useCustomAdapterParams;
    bool public globalPaused;
    mapping(address => bool) public pausedTokens;

    event SetGlobalPause(bool paused);
    event SetTokenPause(address token, bool paused);
    event SetUseCustomAdapterParams(bool useCustomAdapterParams);

    modifier whenNotPaused(address _token) {
        require(!globalPaused && !pausedTokens[_token], "TokenBridgeBase: paused");
        _;
    }

    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    /// @notice Pauses or resumes sending and receiving of all tokens
    /// @dev Can be called only by the bridge owner
    function setGlobalPause(bool paused) external onlyOwner {
        globalPaused = paused;
        emit SetGlobalPause(paused);
    }

    /// @notice Pauses or resumes sending and receiving of a specified `token`
    /// @dev Can be called only by the bridge owner
    function setTokenPause(address token, bool paused) external onlyOwner {
        require(token != address(0), "TokenBridgeBase: invalid token");
        pausedTokens[token] = paused;
        emit SetTokenPause(token, paused);
    }

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