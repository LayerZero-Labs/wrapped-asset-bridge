// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {NonblockingLzApp} from "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

/// @dev an abstract contract containing a common functionality used by OriginalTokenBridge and WrappedTokenBridge
abstract contract TokenBridgeBase is NonblockingLzApp, ReentrancyGuard {
    uint16 public constant PT_WRAP = 0;
    uint8 public constant PT_UNWRAP = 1;

    bool public useCustomAdapterParams;
    bool public globalPaused;
    mapping(address => bool) public pausedTokens; // token address => paused

    event SetGlobalPause(bool paused);
    event SetTokenPause(address token, bool paused);
    event SetUseCustomAdapterParams(bool useCustomAdapterParams);

    modifier whenNotPaused(address _token) {
        require(!globalPaused && !pausedTokens[_token], "TokenBridgeBase: paused");
        _;
    }

    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    function setGlobalPause(bool paused) external onlyOwner {
        globalPaused = paused;
        emit SetGlobalPause(paused);
    }

    function setTokenPause(address token, bool paused) external onlyOwner {
        pausedTokens[token] = paused;
        emit SetTokenPause(token, paused);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) external onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function _checkAdapterParams(uint16 dstChainId, uint16 pkType, bytes memory adapterParams) internal virtual {
        if (useCustomAdapterParams) {
            _checkGasLimit(dstChainId, pkType, adapterParams, 0);
        } else {
            require(adapterParams.length == 0, "TokenBridgeBase: _adapterParams must be empty.");
        }
    }

    // override the renounce ownership inherited by openZeppelin Ownable
    function renounceOwnership() public override onlyOwner {}
}