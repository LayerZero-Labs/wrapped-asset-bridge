const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")

module.exports = async function ({ deployments, getNamedAccounts, network }) {
	const { deploy } = deployments
	const { deployer } = await getNamedAccounts()
	console.log(`Deployer address: ${deployer}`)

	const lzEndpointAddress = LZ_ENDPOINTS[network.name]
	console.log(`[${network.name}] Endpoint Address: ${lzEndpointAddress}`)

	await deploy("WrappedTokenBridge", {
		from: deployer,
		args: [lzEndpointAddress],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true
	})
}

module.exports.tags = ["WrappedTokenBridge"]