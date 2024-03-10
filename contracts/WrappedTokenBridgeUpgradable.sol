// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LzLib} from "@layerzerolabs/solidity-examples/contracts/libraries/LzLib.sol";
import {TokenBridgeBaseUpgradable} from "./TokenBridgeBaseUpgradable.sol";
import {IWrappedERC20} from "./interfaces/IWrappedERC20.sol";

/// @dev Mints a wrapped token when a message received from a remote chain and burns a wrapped token when bridging to a remote chain
contract WrappedTokenBridgeUpgradable is TokenBridgeBaseUpgradable {
    /// @notice Total bps representing 100%
    uint16 public constant TOTAL_BPS = 10000;

    /// @notice An optional fee charged on withdrawal, expressed in bps. E.g., 1bps = 0.01%
    uint16 public withdrawalFeeBps;

    /// @notice Tokens that can be bridged
    /// @dev [local token] => [remote chain] => [remote token]
    mapping(address => mapping(uint16 => address)) public localToRemote;

    /// @notice Tokens that can be bridged
    /// @dev [remote token] => [remote chain] => [local token]
    mapping(address => mapping(uint16 => address)) public remoteToLocal;

    /// @notice Total value bridged per token and remote chains
    /// @dev [remote chain] => [remote token] => [bridged amount]
    mapping(uint16 => mapping(address => uint)) public totalValueLocked;

    bool private _paused;

    event WrapToken(address localToken, address remoteToken, uint16 remoteChainId, address to, uint amount);
    event UnwrapToken(address localToken, address remoteToken, uint16 remoteChainId, address to, uint amount);
    event RegisterToken(address localToken, uint16 remoteChainId, address remoteToken);
    event SetWithdrawalFeeBps(uint16 withdrawalFeeBps);
    event Paused(address account);
    event Unpaused(address account);

    function __WrappedTokenBridgeBaseUpgradable_init(address _endpoint) internal onlyInitializing {
        __TokenBridgeBaseUpgradable_init(_endpoint);
        _paused = false;
    }

    function initialize(address _endpoint) external virtual initializer {
        __WrappedTokenBridgeBaseUpgradable_init(_endpoint);
    }

    function registerToken(address localToken, uint16 remoteChainId, address remoteToken) external onlyOwner {
        require(localToken != address(0), "WrappedTokenBridge: invalid local token");
        require(remoteToken != address(0), "WrappedTokenBridge: invalid remote token");
        require(localToRemote[localToken][remoteChainId] == address(0) && remoteToLocal[remoteToken][remoteChainId] == address(0), "WrappedTokenBridge: token already registered");

        localToRemote[localToken][remoteChainId] = remoteToken;
        remoteToLocal[remoteToken][remoteChainId] = localToken;
        emit RegisterToken(localToken, remoteChainId, remoteToken);
    }

    function setWithdrawalFeeBps(uint16 _withdrawalFeeBps) external onlyOwner {
        require(_withdrawalFeeBps < TOTAL_BPS, "WrappedTokenBridge: invalid withdrawal fee bps");
        withdrawalFeeBps = _withdrawalFeeBps;
        emit SetWithdrawalFeeBps(_withdrawalFeeBps);
    }

    function estimateBridgeFee(uint16 remoteChainId, bool useZro, bytes calldata adapterParams) external view returns (uint nativeFee, uint zroFee) {
        // Only the payload format matters when estimating fee, not the actual data
        bytes memory payload = abi.encode(PT_UNLOCK, address(this), address(this), 0, 0, false);
        return lzEndpoint.estimateFees(remoteChainId, address(this), payload, useZro, adapterParams);
    }

    /// @notice Bridges `localToken` to the remote chain
    /// @dev Burns wrapped tokens and sends LZ message to the remote chain to unlock original tokens
    function bridge(address localToken, uint16 remoteChainId, uint amount, address to, bool unwrapWeth, LzLib.CallParams calldata callParams, bytes memory adapterParams) external payable nonReentrant virtual whenNotPaused {
        require(localToken != address(0), "WrappedTokenBridge: invalid token");
        require(to != address(0), "WrappedTokenBridge: invalid to");
        require(amount > 0, "WrappedTokenBridge: invalid amount");
        _checkAdapterParams(remoteChainId, PT_UNLOCK, adapterParams);

        address remoteToken = localToRemote[localToken][remoteChainId];
        require(remoteToken != address(0), "WrappedTokenBridge: token is not supported");
        require(totalValueLocked[remoteChainId][remoteToken] >= amount, "WrappedTokenBridge: insufficient liquidity on the destination");

        totalValueLocked[remoteChainId][remoteToken] -= amount;
        IWrappedERC20(localToken).burn(msg.sender, amount);

        uint withdrawalAmount = amount;
        if (withdrawalFeeBps > 0) {
            uint withdrawalFee = (amount * withdrawalFeeBps) / TOTAL_BPS;
            withdrawalAmount -= withdrawalFee;
        }

        bytes memory payload = abi.encode(PT_UNLOCK, remoteToken, to, withdrawalAmount, amount, unwrapWeth);
        _lzSend(remoteChainId, payload, callParams.refundAddress, callParams.zroPaymentAddress, adapterParams, msg.value);
        emit UnwrapToken(localToken, remoteToken, remoteChainId, to, amount);
    }

    /// @notice Receives ERC20 tokens or ETH from the remote chain
    /// @dev Mints wrapped tokens in response to LZ message from the remote chain
    function _nonblockingLzReceive(uint16 srcChainId, bytes memory, uint64, bytes memory payload) internal virtual override whenNotPaused {
        (uint8 packetType, address remoteToken, address to, uint amount) = abi.decode(payload, (uint8, address, address, uint));
        require(packetType == PT_MINT, "WrappedTokenBridge: unknown packet type");

        address localToken = remoteToLocal[remoteToken][srcChainId];
        require(localToken != address(0), "WrappedTokenBridge: token is not supported");

        totalValueLocked[srcChainId][remoteToken] += amount;
        IWrappedERC20(localToken).mint(to, amount);

        emit WrapToken(localToken, remoteToken, srcChainId, to, amount);
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        require(!paused(), "Pausable: paused");
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        require(paused(), "Pausable: not paused");
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }

    /// @dev Pauses the contract
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
