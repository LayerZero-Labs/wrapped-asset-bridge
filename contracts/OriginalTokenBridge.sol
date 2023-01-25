// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LzLib} from "@layerzerolabs/solidity-examples/contracts/libraries/LzLib.sol";
import {TokenBridgeBase} from "./TokenBridgeBase.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @dev Locks an ERC20 on the source chain and sends LZ message to the remote chain to mint a wrapped token
contract OriginalTokenBridge is TokenBridgeBase {
    using SafeERC20 for IERC20;

    /// @notice Tokens that can be bridged to the remote chain
    mapping(address => bool) public supportedTokens;

    /// @notice Total value locked per each supported token
    mapping(address => uint) public totalValueLocked;

    /// @notice LayerZero id of the remote chain where wrapped tokens are minted
    uint16 public remoteChainId;   

    /// @notice Address of the wrapped native gas token (e.g. WETH, WBNB, WMATIC)
    address public immutable weth;

    event SendToken(address token, address from, address to, uint amount);
    event ReceiveToken(address token, address to, uint amount);
    event SetRemoteChainId(uint16 remoteChainId);    
    event RegisterToken(address token);
    event WithdrawFee(address indexed token, address to, uint amount);

    constructor(address _endpoint, uint16 _remoteChainId, address _weth) TokenBridgeBase(_endpoint) {
        require(_weth != address(0), "OriginalTokenBridge: invalid WETH address");
        remoteChainId = _remoteChainId;
        weth = _weth;
    }

    function registerToken(address token) external onlyOwner {
        require(token != address(0), "OriginalTokenBridge: invalid token address");
        require(!supportedTokens[token], "OriginalTokenBridge: token already registered");
        supportedTokens[token] = true;
        emit RegisterToken(token);
    }

    function setRemoteChainId(uint16 _remoteChainId) external onlyOwner {
        remoteChainId = _remoteChainId;
        emit SetRemoteChainId(_remoteChainId);
    }   

    function accruedFee(address token) public view returns (uint) {
        return IERC20(token).balanceOf(address(this)) - totalValueLocked[token];
    }

    function estimateBridgeFee(bool useZro, bytes calldata adapterParams) public view returns (uint nativeFee, uint zroFee) {
        // Only the payload format matters when estimating fee, not the actual data
        bytes memory payload = abi.encode(PT_MINT, address(this), address(this), 0);
        return lzEndpoint.estimateFees(remoteChainId, address(this), payload, useZro, adapterParams);
    }

    /// @notice Bridges ERC20 to the remote chain
    /// @dev Locks an ERC20 on the source chain and sends LZ message to the remote chain to mint a wrapped token
    function bridge(address token, uint amount, address to, LzLib.CallParams calldata callParams, bytes memory adapterParams) external payable nonReentrant {
        // Supports tokens with transfer fee
        uint balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint balanceAfter = IERC20(token).balanceOf(address(this));
        amount = balanceAfter - balanceBefore;

        _bridge(token, amount, to, msg.value, callParams, adapterParams);
    }

    /// @notice Bridges ETH to the remote chain
    /// @dev Locks WETH on the source chain and sends LZ message to the remote chain to mint a wrapped token
    function bridgeETH(uint amount, address to, LzLib.CallParams calldata callParams, bytes memory adapterParams) external payable nonReentrant {
        require(msg.value > amount, "OriginalTokenBridge: not enough value sent");
        IWETH(weth).deposit{value: amount}();
        _bridge(weth, amount, to, msg.value - amount, callParams, adapterParams);
    }

    function _bridge(address token, uint amount, address to, uint nativeFee, LzLib.CallParams calldata callParams, bytes memory adapterParams) private {
        require(to != address(0), "OriginalTokenBridge: invalid to");
        require(supportedTokens[token], "OriginalTokenBridge: token is not supported");
        require(amount > 0, "OriginalTokenBridge: invalid amount");
        _checkAdapterParams(remoteChainId, PT_MINT, adapterParams);

        totalValueLocked[token] += amount;
        bytes memory payload = abi.encode(PT_MINT, token, to, amount);
        _lzSend(remoteChainId, payload, callParams.refundAddress, callParams.zroPaymentAddress, adapterParams, nativeFee);
        emit SendToken(token, msg.sender, to, amount);
    }

    function withdrawFee(address token, address to, uint amount) public onlyOwner {
        uint fee = accruedFee(token);
        require(amount <= fee, "OriginalTokenBridge: not enough fees collected");

        IERC20(token).safeTransfer(to, amount);
        emit WithdrawFee(token, to, amount);
    }

    /// @notice Receives ERC20 tokens or ETH from the remote chain
    /// @dev Unlocks locked ERC20 tokens or ETH in response to LZ message from the remote chain
    function _nonblockingLzReceive(uint16 srcChainId, bytes memory, uint64, bytes memory payload) internal virtual override {
        require(srcChainId == remoteChainId, "OriginalTokenBridge: invalid source chain id");

        (uint8 packetType, address token, address to, uint withdrawalAmount, uint totalAmount, bool unwrapWeth) = abi.decode(payload, (uint8, address, address, uint, uint, bool));
        require(packetType == PT_UNLOCK, "OriginalTokenBridge: unknown packet type");
        require(supportedTokens[token], "OriginalTokenBridge: token is not supported");

        totalValueLocked[token] -= totalAmount;       

        if (token == weth && unwrapWeth) {
            IWETH(weth).withdraw(withdrawalAmount);
            (bool success, ) = payable(to).call{value: withdrawalAmount}("");
            require(success, "OriginalTokenBridge: failed to send");
            emit ReceiveToken(address(0), to, withdrawalAmount);
        } else {
            IERC20(token).safeTransfer(to, withdrawalAmount);
            emit ReceiveToken(token, to, withdrawalAmount);
        }
    }

    /// @dev Allows receiving ETH when calling WETH.withdraw()
    receive() external payable {}
}