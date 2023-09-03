const crossChainHelper = require("../utils/crossChainHelper")
module.exports = async function (taskArgs, hre) {
	await hre.run('compile')

	const originalNetworks = taskArgs.originalNetworks.split(",")
	console.log(`\nDeploying Tokens...`)

	for (let i = 0; i < originalNetworks.length; i++){
		console.log(`\nDeploying MockToken on ${originalNetworks[i]}...`)
		await crossChainHelper.deployContract(hre, originalNetworks[i], ["WrappedERC20"])
	}
}
