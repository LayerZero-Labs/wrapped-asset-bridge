// scripts/deployWrappedTokenBridgeProxy.js

const { ethers, upgrades } = require("hardhat")

const ENDPOINT_ADDRESS = "" // <-- Replace with the address of the endpoint you want to use

async function main() {
    const Bridge = await ethers.getContractFactory("contracts/WrappedTokenBridgeIERC20BurnableUpgradable.sol:WrappedTokenBridgeIERC20BurnableUpgradable")
    const bridge = await upgrades.deployProxy(Bridge, [ENDPOINT_ADDRESS], { kind: "uups" })
    console.log("Deploying bridge...")
    await bridge.waitForDeployment()
    console.log("Bridge deployed to:", await bridge.getAddress())
}

main()
