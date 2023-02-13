const CHAIN_IDS = require("../constants/chainIds.json")

module.exports = async function (taskArgs, hre) {
	const signers = await ethers.getSigners()
	const owner = signers[0]
	const originalNetwork = taskArgs.originalNetwork
	const originalTokenChainId = CHAIN_IDS[originalNetwork]

	const amount = ethers.utils.parseUnits(taskArgs.amount, 6)
	const token = await ethers.getContract("USDC")
	const bridge = await ethers.getContract("WrappedTokenBridge")

	const nativeFee = (await bridge.estimateBridgeFee(originalTokenChainId, false, "0x")).nativeFee
	const increasedNativeFee = nativeFee.mul(5).div(4) // 20% increase
	const callParams = {
		refundAddress: owner.address,
		zroPaymentAddress: ethers.constants.AddressZero
	}

	const tx = await bridge.bridge(token.address, originalTokenChainId, amount, owner.address, false, callParams, "0x", { value: increasedNativeFee })	
	await tx.wait()
	console.log(`Bridged ${tx.hash}`)
}