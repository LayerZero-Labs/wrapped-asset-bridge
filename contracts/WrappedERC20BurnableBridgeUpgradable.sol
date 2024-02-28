// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {LzLib} from "@layerzerolabs/solidity-examples/contracts/libraries/LzLib.sol";
import {WrappedTokenBridgeUpgradable} from "./WrappedTokenBridgeUpgradable.sol";
import {IERC20Burnable} from "./interfaces/IERC20Burnable.sol";

/// @dev Mints a wrapped token when a message received from a remote chain and burns a wrapped token when bridging to a remote chain
contract WrappedERC20BurnableBridgeUpgradable is WrappedTokenBridgeUpgradable {
    /// @notice Bridges `localToken` to the remote chain
    /// @dev Burns wrapped tokens and sends LZ message to the remote chain to unlock original tokens
    function bridge(address localToken, uint16 remoteChainId, uint amount, address to, bool unwrapWeth, LzLib.CallParams calldata callParams, bytes memory adapterParams) external payable nonReentrant override whenNotPaused {
        require(localToken != address(0), "WrappedTokenBridge: invalid token");
        require(to != address(0), "WrappedTokenBridge: invalid to");
        require(amount > 0, "WrappedTokenBridge: invalid amount");
        _checkAdapterParams(remoteChainId, PT_UNLOCK, adapterParams);

        address remoteToken = localToRemote[localToken][remoteChainId];
        require(remoteToken != address(0), "WrappedTokenBridge: token is not supported");
        require(totalValueLocked[remoteChainId][remoteToken] >= amount, "WrappedTokenBridge: insufficient liquidity on the destination");

        totalValueLocked[remoteChainId][remoteToken] -= amount;
        IERC20Burnable(localToken).burnFrom(msg.sender, amount);

        uint withdrawalAmount = amount;
        if (withdrawalFeeBps > 0) {
            uint withdrawalFee = (amount * withdrawalFeeBps) / TOTAL_BPS;
            withdrawalAmount -= withdrawalFee;
        }

        bytes memory payload = abi.encode(PT_UNLOCK, remoteToken, to, withdrawalAmount, amount, unwrapWeth);
        _lzSend(remoteChainId, payload, callParams.refundAddress, callParams.zroPaymentAddress, adapterParams, msg.value);
        emit UnwrapToken(localToken, remoteToken, remoteChainId, to, amount);
    }  
}
