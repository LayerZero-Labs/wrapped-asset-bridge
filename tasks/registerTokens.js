const { getWalletContract } = require("../utils/crossChainHelper")
const CHAIN_IDS = require("../constants/chainIds.json")
const TOKENS = require("../constants/tokens.json")
const SHARED_DECIMALS = require("../constants/sharedDecimals.json")

module.exports = async function (taskArgs, hre) {
	const originalNetworks = taskArgs.originalNetworks.split(",")
	const tokens = taskArgs.tokens.split(",")
	const wrappedNetwork = taskArgs.wrappedNetwork
	const wrappedTokenBridge = await getWalletContract(hre, wrappedNetwork, "WrappedTokenBridge")

	for(let i = 0; i < originalNetworks.length; i++) {
		const originalNetwork = originalNetworks[i]
		const originalTokenChainId = CHAIN_IDS[originalNetwork]
		const originalTokenBridge = await getWalletContract(hre, originalNetwork, "OriginalTokenBridge")

		for (let j = 0; j < tokens.length; j++) {
			const token = tokens[j]
			const decimals = SHARED_DECIMALS[token]
			const originalToken = TOKENS[originalNetwork][token]
			if (!originalToken) continue
			const wrappedToken = TOKENS[wrappedNetwork][token]

			console.log(`\n[${originalNetwork}] OriginalTokenBridge at ${originalTokenBridge.address} calling registerToken(${originalToken}, ${decimals})`)
			let tx = await originalTokenBridge.registerToken(originalToken, decimals)
			console.log(tx.hash)

			console.log(`[${wrappedNetwork}] WrappedTokenBridge at ${wrappedTokenBridge.address} calling registerToken(${wrappedToken}, ${originalTokenChainId}, ${originalToken})`)
			tx = await wrappedTokenBridge.registerToken(wrappedToken, originalTokenChainId, originalToken)
			console.log(tx.hash)
		}
	}
}