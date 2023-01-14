const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants } = require("ethers")

describe("End to End", function () {
    const originalAssetChainId = 0
    const wrappedAssetChainId = 1

    let owner, user
    let originalERC20, wrappedERC20
    let originalAssetBridge, wrappedAssetBridge

    beforeEach(async () => {
        [owner, user] = await ethers.getSigners()

        const endpointFactory = await ethers.getContractFactory("LZEndpointMock")
        const originalAssetEndpoint = await endpointFactory.deploy(originalAssetChainId)
        const wrappedAssetEndpoint = await endpointFactory.deploy(wrappedAssetChainId)

        const originalAssetBridgeFactory = await ethers.getContractFactory("OriginalAssetBridge")
        originalAssetBridge = await originalAssetBridgeFactory.deploy(originalAssetEndpoint, wrappedAssetChainId)

        const wrappedAssetBridgeFactory = await ethers.getContractFactory("WrappedAssetBridge")
        wrappedAssetBridge = await wrappedAssetBridgeFactory.deploy(wrappedAssetEndpoint)

        const ERC20Factory = await ethers.getContractFactory("MintableERC20Mock")
        originalERC20 = await ERC20Factory.deploy("TEST", "TEST")
        const originalERC20Decimals = await originalERC20.decimals()

        const wrappedERC20Factory = await ethers.getContractFactory("WrappedERC20")
        wrappedERC20 = wrappedERC20Factory.deploy(wrappedAssetBridge.addresss, "WTEST", "WTEST", originalERC20Decimals)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await originalAssetEndpoint.setDestLzEndpoint(wrappedAssetBridge.address, wrappedAssetEndpoint.address)
        await wrappedAssetEndpoint.setDestLzEndpoint(originalAssetBridge.address, originalAssetEndpoint.address)

        await originalAssetBridge.setTrustedRemoteAddress(wrappedAssetChainId, wrappedAssetBridge.address)
        await wrappedAssetBridge.setTrustedRemoteAddress(originalAssetChainId, originalAssetBridge.address)
    })

    describe("locks original ERC20 and mints wrapped ERC20", function () {
        const amount = utils.parseEther("10")
    })
})