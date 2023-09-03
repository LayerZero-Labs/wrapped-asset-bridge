module.exports = async function (taskArgs, hre) {
    const signers = await ethers.getSigners()
    const owner = signers[0]
    const amount = ethers.utils.parseUnits(taskArgs.amount, taskArgs.decimals)
    const token = await hre.ethers.getContractAt(["function approve(address,uint256) public returns (bool)"], taskArgs.token)
    const bridge = await ethers.getContract("OriginalTokenBridge")

    const gasPrice = await ethers.provider.getGasPrice()
    const increasedGasPrice = gasPrice.mul(5).div(4)
    let tx = await token.approve(bridge.address, amount, { gasPrice: increasedGasPrice })
    await tx.wait()
    console.log(`Approved ${tx.hash}`)

    const nativeFee = (await bridge.estimateBridgeFee(false, "0x")).nativeFee
    const increasedNativeFee = nativeFee.mul(5).div(4) // 20% increase
    const callParams = {
        refundAddress: owner.address,
        zroPaymentAddress: ethers.constants.AddressZero,
    }
    console.log(`Gas price: ${increasedNativeFee}`)
    tx = await bridge.bridge(token.address, amount, owner.address, callParams, "0x", { value: increasedNativeFee, gasPrice: increasedGasPrice })
    await tx.wait()
    console.log(`Bridged ${tx.hash}`)
}
