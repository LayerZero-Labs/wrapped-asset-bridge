<div align="center">
    <img alt="LayerZero" src="resources/LayerZeroLogo.png"/>
</div>

---

# Wrapped Asset Bridge

Wrapped asset bridge allows bridging `ERC20` tokens and native gas tokens (e.g. `ETH`) from existing EVM chains (e.g. Ethereum, Avalanche, BSC, etc.) to subnets or brand new EVM chains where those assets do not exist natively. It supports mapping the same wrapped token to multiple tokens on other chains. E.g. moving native USDC from Ethereum or Avalanche to NewChainX will result in the same wrapped asset on NewChainX. 


<br>


[badge-warning]: https://github.com/Mqxx/GitHub-Markdown/blob/main/blockquotes/badge/dark-theme/warning.svg 'Warning'

> ![badge-warning][badge-warning]<br>
> The bridge is not intended for bridging between existing L1 EVM chains (e.g. between Ethereum and Avalanche)

<br>

## Getting Started

### Setup

- Clone the repository
- run `yarn`

### Test

`yarn test`

Run the full suite of unit tests.

### Coverage

`yarn coverage`

Get the coverage report.

<br>

## Deployment and configuration

1. Deploy `OriginalTokenBridge.sol` on existing EVM chains.
2. Deploy `WrappedTokenBridge.sol` on the new EVM chain.
3. Call `setTrustedRemoteAddress` in `WrappedTokenBridge` contract and in each `OriginalTokenBridge` contract.
4. For each token you want to bridge (e.g., `USDC`, `WETH`, etc), deploy `WrappedERC20` contract on the new EVM chain. Make sure to set `decimals` in the `WrappedERC20` to the number of decimals used in the original token you want to bridge (e.g., `6` decimals for `USDC`, `18` decimals for `WETH`). If you want to add an additional functionality to the wrapped token, inherit it from `WrappedERC20` and add a custom logic to the derived contract.
5. For each token you want to bridge, call `registerToken(address token, uint8 sharedDecimals)` function in `OriginalTokenBridge` and `registerToken(address localToken, uint16 remoteChainId, address remoteToken)` function in `WrappedTokenBridge`. Each wrapped token can be mapped to multiple original tokens on different chains (e.g. `USDC` on the new chain is mapped to `USDC` on Ethereum and `USDC` on Avalanche).

<br>

## Bridging from a native asset EVM chain to a new EVM chain

1. Call `estimateBridgeFee(bool useZro, bytes calldata adapterParams)` in `OriginalTokenBridge` contract.
2. Call `bridge(address token, uint amountLD, address to, LzLib.CallParams calldata callParams, bytes memory adapterParams)` in `OriginalTokenBridge` contract to bridge `ERC20` tokens passing `nativeFee` obtained earlier as a value. This will lock `ERC20` tokens in `OriginalTokenBridge` contract and send a LayerZero message to the `WrappedTokenBridge` on another chain to mint wrapped tokens. To bridge `ETH` use `bridgeNative(uint amountLD, address to, LzLib.CallParams calldata callParams, bytes memory adapterParams)` function and pass a sum of `nativeFee` and amount as a value.

</br>

## Bridging from a new EVM chain to a native asset EVM
1. Call `estimateBridgeFee(uint16 remoteChainId, bool useZro, bytes calldata adapterParams)` in `WrappedTokenBridge`.
2. Call `bridge(address localToken, uint16 remoteChainId, uint amount, address to, bool unwrapWeth, LzLib.CallParams calldata callParams, bytes memory adapterParams)` supplying `nativeFee` obtained earlier as a value. This will burn wrapped tokens and send a LayerZero message to `OriginalTokenBridge` contract on another chain to unlock original tokens.

## Using Scripts

To deploy fresh contracts plese dele the contents of the `deployments` folder.

Populate the env MNENOIC in the env file and run the following commands in order.


1. `npx hardhat deployBridges --original-networks "polygon,gnosis" --wrapped-network "fuse"`

Now populate the Bridge address on Fuse in the env file and proceed.

2. `npx hardhat deployTestTokens --original-networks "fuse"`
3. `npx hardhat setTrustedRemote --original-networks "gnosis" --wrapped-network "fuse"`
4. `npx hardhat registerTokens --original-networks "gnosis" --wrapped-network "fuse" --tokens "USDC,USDT,WETH"`

New tokens can be added by adding them in constants and updating the list in `deploy/WrappedERC20.js`
