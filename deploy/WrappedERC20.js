const { getWalletContract } = require("../utils/crossChainHelper")
module.exports = async function ({ deployments, getNamedAccounts }) {
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	console.log(`Deployer address: ${deployer}`)

	const wrappedTokens = ["WETH", "USDC", "USDT"]

	for (let i = 0; i < wrappedTokens.length; i++) {
		await deploy(wrappedTokens[i], {
			from: deployer,
			args: [process.env.DESTINATION_BRIDGE_ADDRESS],
			log: true,
			waitConfirmations: 1,
			skipIfAlreadyDeployed: true
		})
	}
}

module.exports.tags = ["WrappedERC20"]