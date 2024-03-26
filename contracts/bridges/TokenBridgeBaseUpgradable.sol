// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {NonblockingLzAppUpgradeable} from "@layerzerolabs/solidity-examples/contracts/contracts-upgradable/lzApp/NonblockingLzAppUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @dev An abstract contract containing a common functionality used by OriginalTokenBridge and WrappedTokenBridge
abstract contract TokenBridgeBaseUpgradable is NonblockingLzAppUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    /// @notice A packet type used to identify messages requesting minting of wrapped tokens
    uint8 public constant PT_MINT = 0;

    /// @notice A packet type used to identify messages requesting unlocking of original tokens
    uint8 public constant PT_UNLOCK = 1;

    bool public useCustomAdapterParams;

    event SetUseCustomAdapterParams(bool useCustomAdapterParams);

    function __TokenBridgeBaseUpgradable_init(address _endpoint) internal onlyInitializing {
        __NonblockingLzAppUpgradeable_init(_endpoint);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
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

    /// @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by {upgradeTo} and {upgradeToAndCall}.
    function _authorizeUpgrade(address newImplemantation) internal override onlyOwner {}
}
