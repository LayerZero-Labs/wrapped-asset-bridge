const crossChainHelper = require("../utils/crossChainHelper")

module.exports = async function (taskArgs, hre) {
	await hre.run('compile')

	const originalNetworks = taskArgs.originalNetworks.split(",")
	const wrappedNetwork = taskArgs.wrappedNetwork
	console.log(`\nDeploying Bridges...`)

	for (let i = 0; i < originalNetworks.length; i++){
		console.log(`\nDeploying OriginalTokenBridge on ${originalNetworks[i]}...`)
		await crossChainHelper.deployContract(hre, originalNetworks[i], ["OriginalTokenBridge"])
	}

	console.log(`\nDeploying WrappedTokenBridge on ${wrappedNetwork}`)
	await crossChainHelper.deployContract(hre, wrappedNetwork, ["WrappedTokenBridge"])
}
