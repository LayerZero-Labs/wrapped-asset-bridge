// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LzLib} from "@layerzerolabs/solidity-examples/contracts/libraries/LzLib.sol";
import {TokenBridgeBase} from "./TokenBridgeBase.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @notice Locks an ERC20 on the source chain and sends LZ message to the remote chain to mint a wrapped token
contract OriginalTokenBridge is TokenBridgeBase {
    using SafeERC20 for IERC20;

    /// @notice total bps representing 100%
    uint16 public constant TOTAL_BPS = 10000;

    mapping(address => bool) public supportedTokens;
    mapping(address => uint) public totalValueLocked;

    /// @notice LayerZero id of the remote chain where wrapped tokens are minted
    uint16 public remoteChainId;

    /// @notice An optional fee charged on withdrawal, expressed in bps. E.g., 1bps = 0.01%
    uint16 public withdrawalFeeBps;

    address public immutable weth;
    bool public emergencyWithdrawEnabled;
    uint public emergencyWithdrawTime;

    event SendToken(address token, address from, address to, uint amount);
    event ReceiveToken(address token, address to, uint amount);
    event SetRemoteChainId(uint16 remoteChainId);
    event SetWithdrawalFeeBps(uint16 withdrawalFeeBps);
    event RegisterToken(address token);
    event EnableEmergencyWithdraw(bool enabled, uint unlockTime);
    event WithdrawFee(address indexed token, address to, uint amount);
    event WithdrawTotalValueLocked(address indexed token, address to, uint amount);

    modifier emergencyWithdrawUnlocked() {
        require(emergencyWithdrawEnabled && block.timestamp >= emergencyWithdrawTime, "OriginalTokenBridge: emergency withdraw locked");
        _;
    }

    constructor(address _endpoint, uint16 _remoteChainId, address _weth) TokenBridgeBase(_endpoint) {
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

    function setWithdrawalFeeBps(uint16 _withdrawalFeeBps) external onlyOwner {
        require(_withdrawalFeeBps <= TOTAL_BPS, "OriginalTokenBridge: invalid withdrawal fee");
        withdrawalFeeBps = _withdrawalFeeBps;
        emit SetWithdrawalFeeBps(_withdrawalFeeBps);
    }

    function accruedFee(address token) public view returns (uint) {
        return IERC20(token).balanceOf(address(this)) - totalValueLocked[token];
    }

    function estimateBridgeFee(address token, uint amount, address to, bool useZro, bytes calldata adapterParams) external view returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(PT_WRAP, token, to, amount);
        return lzEndpoint.estimateFees(remoteChainId, address(this), payload, useZro, adapterParams);
    }

    function bridge(address token, uint amount, address to, LzLib.CallParams calldata callParams, bytes memory adapterParams) external payable whenNotPaused(token) nonReentrant {
        require(token != address(0), "OriginalTokenBridge: invalid token");
        require(to != address(0), "OriginalTokenBridge: invalid to");
        require(supportedTokens[token], "OriginalTokenBridge: token is not supported");
        _checkAdapterParams(remoteChainId, PT_WRAP, adapterParams);

        // support tokens with transfer fee
        uint balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint balanceAfter = IERC20(token).balanceOf(address(this));
        amount = balanceAfter - balanceBefore;
        require(amount > 0, "OriginalTokenBridge: invalid amount");

        totalValueLocked[token] += amount;
        bytes memory payload = abi.encode(PT_WRAP, token, to, amount);
        _lzSend(remoteChainId, payload, callParams.refundAddress, callParams.zroPaymentAddress, adapterParams, msg.value);
        emit SendToken(token, msg.sender, to, amount);
    }

    function bridgeETH(uint amount, address to, LzLib.CallParams calldata callParams, bytes memory adapterParams) external payable whenNotPaused(weth) nonReentrant {
        // gas savings
        address _weth = weth;

        require(to != address(0), "OriginalTokenBridge: invalid to");
        require(supportedTokens[_weth], "OriginalTokenBridge: weth is not supported");
        require(amount > 0, "OriginalTokenBridge: invalid amount");
        require(msg.value >= amount, "OriginalTokenBridge: not enough value sent");
        _checkAdapterParams(remoteChainId, PT_WRAP, adapterParams);

        IWETH(_weth).deposit{value: amount}();
        totalValueLocked[_weth] += amount;
        bytes memory payload = abi.encode(PT_WRAP, _weth, to, amount);
        _lzSend(remoteChainId, payload, callParams.refundAddress, callParams.zroPaymentAddress, adapterParams, msg.value - amount);
        emit SendToken(_weth, msg.sender, to, amount);
    }

    function enableEmergencyWithdraw(bool enabled) external onlyOwner {
        emergencyWithdrawEnabled = enabled;
        // overrides an existing lock time
        emergencyWithdrawTime = enabled ? block.timestamp + 1 weeks : 0;
        emit EnableEmergencyWithdraw(enabled, emergencyWithdrawTime);
    }

    function withdrawFee(address token, address to, uint amount) public onlyOwner {
        uint fee = accruedFee(token);
        require(amount <= fee, "TokenBridge: not enough fees collected");

        IERC20(token).safeTransfer(to, amount);
        emit WithdrawFee(token, to, amount);
    }

    function withdrawTotalValueLocked(address token, address to, uint amount) public onlyOwner emergencyWithdrawUnlocked {
        totalValueLocked[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
        emit WithdrawTotalValueLocked(token, to, amount);
    }

    function emergencyWithdraw(address token, address to) external {
        withdrawFee(token, to, accruedFee(token));
        withdrawTotalValueLocked(token, to, totalValueLocked[token]);
    }

    function _nonblockingLzReceive(uint16 srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual override {
        require(srcChainId == remoteChainId, "OriginalTokenBridge: invalid source chain id");

        (uint8 packetType, address token, address to, uint amount, bool unwrap) = abi.decode(_payload, (uint8, address, address, uint, bool));
        require(packetType == PT_UNWRAP, "OriginalTokenBridge: unknown packet type");
        require(!globalPaused && !pausedTokens[token], "OriginalTokenBridge: paused");
        require(supportedTokens[token], "OriginalTokenBridge: token is not supported");

        totalValueLocked[token] -= amount;

        if (withdrawalFeeBps > 0) {
            uint withdrawalFee = (amount * withdrawalFeeBps) / TOTAL_BPS;
            amount -= withdrawalFee;
        }

        if (token == weth && unwrap) {
            IWETH(weth).withdraw(amount);
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "OriginalTokenBridge: failed to send");
            emit ReceiveToken(address(0), to, amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
            emit ReceiveToken(token, to, amount);
        }
    }
}