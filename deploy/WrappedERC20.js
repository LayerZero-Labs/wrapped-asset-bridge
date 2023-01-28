module.exports = async function ({ deployments, getNamedAccounts }) {
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	console.log(`Deployer address: ${deployer}`)

	const wrappedTokenBridge = await ethers.getContract("WrappedTokenBridge")
	const name = "TEST"
	const symbol = "TEST"
	const decimals = 18

	await deploy("WrappedERC20", {
		from: deployer,
		args: [wrappedTokenBridge.address, name, symbol, decimals],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true
	})
}

module.exports.tags = ["WrappedERC20"]