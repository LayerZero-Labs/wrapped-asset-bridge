
# Fuse V2 Bridge

Wrapped asset bridge allows bridging `ERC20` tokens and native gas tokens (e.g. `ETH`) from existing EVM chains (e.g. Ethereum, Avalanche, BSC, etc.) to subnets or brand new EVM chains where those assets do not exist natively. It supports mapping the same wrapped token to multiple tokens on other chains. E.g. moving native USDC from Ethereum or Avalanche to NewChainX will result in the same wrapped asset on NewChainX.

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

To deploy fresh contracts plese delete the contents of the `deployments` folder.

Populate the env MNENOIC in the env file and run the following commands in order.


1. `npx hardhat deployBridges --original-networks "polygon,gnosis" --wrapped-network "fuse"`

Now populate the Bridge address on Fuse in the env file and proceed.

2. `npx hardhat deployTestTokens --original-networks "fuse"`
3. `npx hardhat setTrustedRemote --original-networks "gnosis" --wrapped-network "fuse"`
4. `npx hardhat registerTokens --original-networks "gnosis" --wrapped-network "fuse" --tokens "USDC,USDT,WETH"`

New tokens can be added by adding them in constants and updating the list in `deploy/WrappedERC20.js`


## Deployed Proxy Contracts

### Polygon
OriginalTokenBridge: `0x8f5D6332eD11338D2dA4fAAC6675e9A6757BeC8b`<br>
WrappedTokenBridge: `0xe453d6649643F1F460C371dC3D1da98F7922fe51`<br>

### Gnosis
OriginalTokenBridge: `0xb0F9cE8598c623Ff42e52388F9b452B7CDc409a1`<br>
WrappedTokenBridge: `0x4014115fB4816Bc8343d8e69d2708Fa738dCaa15`<br>

### Optimism
OriginalTokenBridge: `0x081dF5af5d022D4A4a4520D4D0D336B8432fDBBb`<br>
WrappedTokenBridge: `0xEEd9154F63f6F0044E6b00dDdEFD895b5B4ED580`<br>

### Arbitrum
OriginalTokenBridge: `0x081dF5af5d022D4A4a4520D4D0D336B8432fDBBb`<br>
WrappedTokenBridge: `0xEEd9154F63f6F0044E6b00dDdEFD895b5B4ED580`<br>

### Fuse
OriginalTokenBridge(to Polygon): `0x36207130CF22d8C54842569A32a0Cd5D711f3580`<br>
OriginalTokenBridge(to Gnosis): `0xc465107230c21f154627e017b6727A3C18984B02`<br>
OriginalTokenBridge(to Optimism): `0xeC3FD32cd5389FbC581427A648d6dc1bc5cfFE3B`<br>
OriginalTokenBridge(to Arbitrum): `0x56dF61E9f39C75e2d84C05753557bEBB9841Eb5B`<br>
WrappedTokenBridge: `0x353af4878d7452e974538706273887F7ED90Da47`<br>