const { getWalletContract } = require("../utils/crossChainHelper")
const CHAIN_IDS = require("../constants/chainIds.json")
const TOKENS = require("../constants/tokens.json")
const SHARED_DECIMALS = require("../constants/sharedDecimals.json")

module.exports = async function (taskArgs, hre) {
	const originalNetworks = taskArgs.originalNetworks.split(",")
	const tokens = taskArgs.tokens.split(",")
	const wrappedNetwork = taskArgs.wrappedNetwork
	const wrappedTokenBridge = await getWalletContract(hre, wrappedNetwork, "WrappedTokenBridge")
	const wrappedProvider = wrappedTokenBridge.provider
	const wrappedGasPrice = await wrappedProvider.getGasPrice()
	const increasedWrappedGasPrice = wrappedGasPrice.mul(5).div(4)

	for(let i = 0; i < originalNetworks.length; i++) {
		const originalNetwork = originalNetworks[i]
		const originalTokenChainId = CHAIN_IDS[originalNetwork]
		const originalTokenBridge = await getWalletContract(hre, originalNetwork, "OriginalTokenBridge")
		const originalProvider = originalTokenBridge.provider
		const gasPrice = await originalProvider.getGasPrice()
		const increasedGasPrice = gasPrice.mul(5).div(4)

		for (let j = 0; j < tokens.length; j++) {
			const token = tokens[j]
			const decimals = SHARED_DECIMALS[token]
			const originalToken = TOKENS[originalNetwork][token]
			if (!originalToken) continue
			const wrappedToken = TOKENS[wrappedNetwork][token]

			console.log(`\n[${originalNetwork}] OriginalTokenBridge at ${originalTokenBridge.address} calling registerToken(${originalToken}, ${decimals})`)
			let tx = await originalTokenBridge.registerToken(originalToken, decimals, { gasPrice: increasedGasPrice })
			console.log(tx.hash)

			console.log(`[${wrappedNetwork}] WrappedTokenBridge at ${wrappedTokenBridge.address} calling registerToken(${wrappedToken}, ${originalTokenChainId}, ${originalToken})`)
			tx = await wrappedTokenBridge.registerToken(wrappedToken, originalTokenChainId, originalToken, { gasPrice: increasedWrappedGasPrice })
			console.log(tx.hash)
		}
	}
}