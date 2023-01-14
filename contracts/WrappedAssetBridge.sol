// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {NonblockingLzApp} from "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";
import {IWrappedERC20} from "./IWrappedERC20.sol";

contract WrappedAssetBridge is NonblockingLzApp {
    using SafeERC20 for IERC20;

    // packet type
    uint16 public constant PT_WRAP = 0;
    uint16 public constant PT_UNWRAP = 1;

    // [wrapped token] => [remote chain] => [remote token]
    mapping(address => mapping(uint16 => address)) public trustedTokens;
    // [remote chain] => [local token] => [bridged amount]
    mapping(uint16 => mapping(address => uint)) deposits;

    event WrapToken(address localToken, address remoteToken, uint16 remoteChainId, address to, uint amount);
    event UnwrapToken(address localToken, address remoteToken, uint16 remoteChainId, address to, uint amount);
    event MapTokens(address localToken, uint16 remoteChainId, address remoteToken);

    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    function mapTokens(address localToken, uint16 remoteChainId, address remoteToken) external onlyOwner {
        trustedTokens[localToken][remoteChainId] = remoteToken;
        emit MapTokens(localToken, remoteChainId, remoteToken);
    }

    function estimateBridgeFee(address localToken, uint16 remoteChainId, uint amount, address to, bool useZro, bytes calldata adapterParams) external view returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(PT_WRAP, localToken, trustedTokens[localToken][remoteChainId], to, amount);
        return lzEndpoint.estimateFees(remoteChainId, address(this), payload, useZro, adapterParams);
    }

    function bridge(address localToken, uint16 remoteChainId, uint amount, address to, address payable refundAddress, address zroPaymentAddress, bytes memory adapterParams) external payable {
        require(localToken != address(0), "WrappedAssetBridge: invalid local token");

        require(to != address(0), "WrappedAssetBridge: invalid to");
        require(amount > 0, "WrappedAssetBridge: invalid amount");

        address remoteToken = trustedTokens[localToken][remoteChainId];
        require(remoteToken != address(0), "WrappedAssetBridge: unknown remote token");
        require(deposits[remoteChainId][localToken] >= amount, "WrappedAssetBridge: not enough liquidity on the destination");

        deposits[remoteChainId][localToken] -= amount;
        IWrappedERC20(localToken).burn(msg.sender, amount);

        bytes memory payload = abi.encode(PT_UNWRAP, localToken, remoteToken, to, amount);
        _lzSend(remoteChainId, payload, refundAddress, zroPaymentAddress, adapterParams, msg.value);

        emit UnwrapToken(localToken, remoteToken, remoteChainId, to, amount);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual override {
        uint16 packetType;
        assembly {
            packetType := mload(add(_payload, 32))
        }

        (, address remoteToken, address localToken, address to, uint amount) = abi.decode(_payload, (uint16, address, address, address, uint));
        require(trustedTokens[localToken][_srcChainId] == remoteToken, "WrappedAssetBridge: unknown remote token");
        require(packetType == PT_WRAP, "WrappedAssetBridge: unknown packet type");

        deposits[_srcChainId][localToken] += amount;
        IWrappedERC20(localToken).mint(to, amount);

        emit WrapToken(localToken, remoteToken, _srcChainId, to, amount);
    }
}