module.exports = async function ({ deployments, getNamedAccounts }) {
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	console.log(`Deployer address: ${deployer}`)

	const name = "USDC Mock"
	const symbol = "USDC"
	const decimals = 6

	await deploy("USDCMock", {
		from: deployer,
		args: [name, symbol, decimals],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true
	})
}

module.exports.tags = ["USDCMock"]