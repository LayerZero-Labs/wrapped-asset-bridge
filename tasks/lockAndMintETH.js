module.exports = async function (taskArgs, hre) {
	const signers = await ethers.getSigners()
	const owner = signers[0]
	const amount = ethers.utils.parseEther(taskArgs.amount)
	const bridge = await ethers.getContract("OriginalTokenBridge")

	const nativeFee = (await bridge.estimateBridgeFee(false, "0x")).nativeFee
	const increasedNativeFee = nativeFee.mul(5).div(4) // 20% increase
	const callParams = {
		refundAddress: owner.address,
		zroPaymentAddress: ethers.constants.AddressZero
	}

	tx = await bridge.bridgeNative(amount, owner.address, callParams, "0x", { value: amount.add(increasedNativeFee) })
	await tx.wait()
	console.log(`Bridged ${tx.hash}`)
}