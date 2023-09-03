// scripts/deployOriginalTokenBridgeProxy.js
const { ethers, upgrades } = require("hardhat")

const ENDPOINT_ADDRESS = "" // <-- Replace with the address of the endpoint you want to use
const FOREIGN_CHAIN_ID = 138 // <-- Replace with the chain ID of the foreign chain
const WETH_ADDRESS = "" // <-- Replace with the address of the WETH token on the source chain

async function main() {
    const Bridge = await ethers.getContractFactory("contracts/OriginalTokenBridgeUpgradable.sol:OriginalTokenBridgeUpgradable")
    const bridge = await upgrades.deployProxy(Bridge, [ENDPOINT_ADDRESS, FOREIGN_CHAIN_ID, WETH_ADDRESS], { kind: "uups" })
    console.log("Deploying bridge...")
    await bridge.waitForDeployment()
    console.log(bridge.deploymentTransaction().hash)
    console.log("Bridge deployed to:", await bridge.getAddress())
}

main()
