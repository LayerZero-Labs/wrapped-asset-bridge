module.exports = async function ({ deployments, getNamedAccounts, network }) {
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	console.log(`Deployer address: ${deployer}`)

	const name = "TEST"
	const symbol = "TEST"

	await deploy("MintableERC20Mock", {
		from: deployer,
		args: [name, symbol],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true
	})
}

module.exports.tags = ["MintableERC20Mock"]