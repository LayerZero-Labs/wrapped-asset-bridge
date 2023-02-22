const { getWalletContract } = require("../utils/crossChainHelper")
const CHAIN_IDS = require("../constants/chainIds.json")

module.exports = async function (taskArgs, hre) {
	const originalNetworks = taskArgs.originalNetworks.split(",")
	const wrappedNetwork = taskArgs.wrappedNetwork

	const wrappedTokenBridge = await getWalletContract(hre, wrappedNetwork, "WrappedTokenBridge")
	const wrappedTokenChainId = CHAIN_IDS[wrappedNetwork]

	for (let i = 0; i < originalNetworks.length; i++) {
		const originalTokenChainId = CHAIN_IDS[originalNetworks[i]]
		const originalTokenBridge = await getWalletContract(hre, originalNetworks[i], "OriginalTokenBridge")
		const originalProvider = originalTokenBridge.provider
		const gasPrice = await originalProvider.getGasPrice()
		const increasedGasPrice = gasPrice.mul(5).div(4)

		console.log(`\n[${originalNetworks[i]}] OriginalTokenBridge at ${originalTokenBridge.address} calling setTrustedRemoteAddress(${wrappedTokenChainId}, ${wrappedTokenBridge.address})`)
		let tx = await originalTokenBridge.setTrustedRemoteAddress(wrappedTokenChainId, wrappedTokenBridge.address, {gasPrice: increasedGasPrice})
		console.log(tx.hash)
		
		console.log(`[${wrappedNetwork}] WrappedTokenBridge at ${wrappedTokenBridge.address} calling setTrustedRemoteAddress(${originalTokenChainId}, ${originalTokenBridge.address})`)
		tx = await wrappedTokenBridge.setTrustedRemoteAddress(originalTokenChainId, originalTokenBridge.address)
		console.log(tx.hash)
	}
}
