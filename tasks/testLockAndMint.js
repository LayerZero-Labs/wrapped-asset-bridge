module.exports = async function (taskArgs, hre) {
	const signers = await ethers.getSigners()
	const owner = signers[0]
	const amount = ethers.utils.parseEther(taskArgs.amount)
	const token = await ethers.getContract("MintableERC20Mock")
	const bridge = await ethers.getContract("OriginalTokenBridge")

	let tx = await token.mint(owner.address, amount)
	await tx.wait()
	console.log(`Minted ${tx.hash}`)

	tx = await token.approve(bridge.address, amount)
	await tx.wait()
	console.log(`Approved ${tx.hash}`)

	const nativeFee = (await bridge.estimateBridgeFee(false, "0x")).nativeFee
	const increasedNativeFee = nativeFee.mul(5).div(4) // 20% increase
	const callParams = { 
		refundAddress: owner.address,
		zroPaymentAddress: ethers.constants.AddressZero
	}

	tx = await bridge.bridge(token.address, amount, owner.address, callParams, "0x", { value: increasedNativeFee })
	console.log(tx)
	await tx.wait()
	console.log(`Bridged ${tx.hash}`)
}