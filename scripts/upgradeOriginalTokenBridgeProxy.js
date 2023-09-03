// scripts/deployOriginalTokenBridgeProxy.js
const { ethers, upgrades } = require("hardhat")

const OLD_PROXY_ADDRESS = "" // <-- Replace with the address of the proxy you want to upgrade

async function main() {
    const BridgeV2 = await ethers.getContractFactory("contracts/OriginalTokenBridgeUpgradableV2.sol:OriginalTokenBridgeUpgradableV2")
    const bridge = await upgrades.upgradeProxy(OLD_PROXY_ADDRESS, BridgeV2)
    console.log("Deploying bridge...")
    await bridge.waitForDeployment()
    console.log("Bridge deployed to:", await bridge.getAddress())
}

main()
