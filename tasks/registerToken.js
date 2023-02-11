const { getWalletContract } = require("../utils/crossChainHelper")
const CHAIN_IDS = require("../constants/chainIds.json")

module.exports = async function (taskArgs, hre) {
	const originalNetwork = taskArgs.originalNetwork
	const originalTokenChainId = CHAIN_IDS[originalNetwork]
	const originalTokenBridge = await getWalletContract(hre, originalNetwork, "OriginalTokenBridge")	

	const wrappedNetwork = taskArgs.wrappedNetwork
	const wrappedTokenBridge = await getWalletContract(hre, wrappedNetwork, "WrappedTokenBridge")

	console.log(`\n[${originalNetwork}] OriginalTokenBridge at ${originalTokenBridge.address} calling registerToken(${taskArgs.originalToken})`)
	await originalTokenBridge.registerToken(taskArgs.originalToken)

	console.log(`\n[${wrappedNetwork}] WrappedTokenBridge at ${wrappedTokenBridge.address} calling registerToken(${taskArgs.wrappedToken}, ${originalTokenChainId}, ${taskArgs.originalToken})`)
	await wrappedTokenBridge.registerToken(taskArgs.wrappedToken, originalTokenChainId, taskArgs.originalToken)	
}
