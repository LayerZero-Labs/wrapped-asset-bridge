// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {NonblockingLzApp} from "@layerzerolabs/solidity-examples/contracts/lzApp/NonblockingLzApp.sol";

/// @notice Locks an ERC20 on the source chain and sends LZ message to the remote chain mint
/// @dev Explain to a developer any extra details
contract OriginalAssetBridge is NonblockingLzApp {
    using SafeERC20 for IERC20;

    // packet type
    uint16 public constant PT_WRAP = 0;
    uint16 public constant PT_UNWRAP = 1;

    /// @notice maps local tokens to wrapped remote tokens [local] => [remote]
    mapping(address => address) public trustedTokens;

    mapping(address => mapping(address => uint)) deposits;

    /// @notice LayerZero id of the remote chain
    uint16 public remoteChainId;

    event SendToken(address localToken, address remoteToken, address to, uint amount);
    event ReceiveToken(address localToken, address remoteToken, address to, uint amount);
    event SetRemoteChainId(uint16 remoteChainId);
    event MapTokens(address localToken, address remoteToken);

    constructor(address _endpoint, uint16 _remoteChainId) NonblockingLzApp(_endpoint) {
        remoteChainId = _remoteChainId;
    }

    function mapTokens(address localToken, address remoteToken) external onlyOwner {
        trustedTokens[localToken] = remoteToken;
    }

    function setRemoteChainId(uint16 _remoteChainId) external onlyOwner {
        remoteChainId = _remoteChainId;
        emit SetRemoteChainId(_remoteChainId);
    }

    function estimateBridgeFee(address localToken, uint amount, address to, bool useZro, bytes calldata adapterParams) external view returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(PT_WRAP, localToken, trustedTokens[localToken], to, amount);
        return lzEndpoint.estimateFees(remoteChainId, address(this), payload, useZro, adapterParams);
    }

    function bridge(address localToken, uint amount, address to, address payable refundAddress, address zroPaymentAddress, bytes memory adapterParams) external payable {
        require(localToken != address(0), "OriginalAssetBridge: invalid local token");
        require(to != address(0), "OriginalAssetBridge: invalid to");
        require(amount > 0, "OriginalAssetBridge: invalid amount");

        address remoteToken = trustedTokens[localToken];
        require(remoteToken != address(0), "OriginalAssetBridge: remote token not mapped");

        IERC20(localToken).safeTransferFrom(msg.sender, address(this), amount);
        deposits[localToken][remoteToken] += amount;
        bytes memory payload = abi.encode(PT_WRAP, localToken, remoteToken, to, amount);
        _lzSend(remoteChainId, payload, refundAddress, zroPaymentAddress, adapterParams, msg.value);

        emit SendToken(localToken, remoteToken, to, amount);
    }

    function _nonblockingLzReceive(uint16, bytes memory, uint64, bytes memory _payload) internal virtual override {
        uint16 packetType;
        assembly {
            packetType := mload(add(_payload, 32))
        }

        require(packetType == PT_UNWRAP, "OriginalAssetBridge: unknown packet type");

        (, address remoteToken, address localToken, address to, uint amount) = abi.decode(_payload, (uint16, address, address, address, uint));
        require(trustedTokens[localToken] == remoteToken, "OriginalAssetBridge: unknown token");

        deposits[localToken][remoteToken] -= amount;
        IERC20(localToken).safeTransfer(to, amount);

        emit ReceiveToken(localToken, remoteToken, to, amount);
    }
}