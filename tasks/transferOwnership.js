const { getWalletContract } = require("../utils/crossChainHelper")

module.exports = async function (taskArgs, hre) {
	const originalNetworks = taskArgs.originalNetworks.split(",")	
	const wrappedNetwork = taskArgs.wrappedNetwork
	const newOwner = taskArgs.newOwner

	const wrappedTokenBridge = await getWalletContract(hre, wrappedNetwork, "WrappedTokenBridge")
	let tx = await wrappedTokenBridge.transferOwnership(newOwner)
	console.log(`[${wrappedNetwork}] transferOwnership tx ${tx.hash}`)

	for (let i = 0; i < originalNetworks.length; i++) {
		const originalNetwork = originalNetworks[i]
		const originalTokenBridge = await getWalletContract(hre, originalNetwork, "OriginalTokenBridge")
		tx = await originalTokenBridge.transferOwnership(newOwner)
		console.log(`[${originalNetwork}] transferOwnership tx ${tx.hash}`)
	}
}