const { getWalletContract } = require("../utils/crossChainHelper")
module.exports = async function ({ deployments, getNamedAccounts }) {
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	console.log(`Deployer address: ${deployer}`)

	const wrappedTokenBridge = await ethers.getContract("WrappedTokenBridge")
	const wrappedTokens = ["WETH", "USDC", "USDT"]

	for (let i = 0; i < wrappedTokens.length; i++) {
		await deploy(wrappedTokens[i], {
			from: deployer,
			args: [wrappedTokenBridge.address],
			log: true,
			waitConfirmations: 1,
			skipIfAlreadyDeployed: true
		})
	}
}

module.exports.tags = ["WrappedERC20"]