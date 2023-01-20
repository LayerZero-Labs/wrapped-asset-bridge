const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants } = require("ethers")

describe("WrappedTokenBridge", () => {
    const originalTokenChainId = 0
    const wrappedTokenChainId = 1
    const amount = utils.parseEther("10")
    const pkWrap = 0

    let owner, user
    let originalToken, wrappedToken
    let wrappedTokenBridge
    let wrappedTokenEndpoint, wrappedTokenBridgeFactory
    let callParams, adapterParams

    const createPayload = (pk = pkWrap, token = originalToken.address) => utils.defaultAbiCoder.encode(["uint8", "address", "address", "uint256"], [pk, token, user.address, amount])

    beforeEach(async () => {
        [owner, user] = await ethers.getSigners()

        const endpointFactory = await ethers.getContractFactory("LayerZeroEndpointStub")
        const originalTokenEndpoint = await endpointFactory.deploy()
        wrappedTokenEndpoint = await endpointFactory.deploy()

        const wethFactory = await ethers.getContractFactory("WETH9")
        const weth = await wethFactory.deploy()
        const originalTokenBridgeFactory = await ethers.getContractFactory("OriginalTokenBridge")
        const originalTokenBridge = await originalTokenBridgeFactory.deploy(originalTokenEndpoint.address, wrappedTokenChainId, weth.address)

        wrappedTokenBridgeFactory = await ethers.getContractFactory("WrappedTokenBridgeHarness")
        wrappedTokenBridge = await wrappedTokenBridgeFactory.deploy(wrappedTokenEndpoint.address)

        const ERC20Factory = await ethers.getContractFactory("MintableERC20Mock")
        originalToken = await ERC20Factory.deploy("TEST", "TEST")
        const originalERC20Decimals = await originalToken.decimals()

        const wrappedERC20Factory = await ethers.getContractFactory("WrappedERC20")
        wrappedToken = await wrappedERC20Factory.deploy(wrappedTokenBridge.address, "WTEST", "WTEST", originalERC20Decimals)

        await wrappedTokenBridge.setTrustedRemoteAddress(originalTokenChainId, originalTokenBridge.address)

        callParams = { refundAddress: user.address, zroPaymentAddress: constants.AddressZero }
        adapterParams = "0x"
    })

    it("doesn't renounce ownership", async () => {
        await wrappedTokenBridge.renounceOwnership()
        expect(await wrappedTokenBridge.owner()).to.be.eq(owner.address)
    })

    describe("registerToken", () => {
        it("reverts when called by non owner", async () => {
            await expect(wrappedTokenBridge.connect(user).registerToken(wrappedToken.address, originalTokenChainId, originalToken.address)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("reverts when local token is address zero", async () => {
            await expect(wrappedTokenBridge.registerToken(constants.AddressZero, originalTokenChainId, originalToken.address)).to.be.revertedWith("WrappedTokenBridge: invalid local token")
        })

        it("reverts when remote token is address zero", async () => {
            await expect(wrappedTokenBridge.registerToken(wrappedToken.address, originalTokenChainId, constants.AddressZero)).to.be.revertedWith("WrappedTokenBridge: invalid remote token")
        })

        it("registers tokens", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.address, originalTokenChainId, originalToken.address)

            expect(await wrappedTokenBridge.localToRemote(wrappedToken.address, originalTokenChainId)).to.be.eq(originalToken.address)
            expect(await wrappedTokenBridge.remoteToLocal(originalToken.address, originalTokenChainId)).to.be.eq(wrappedToken.address)
        })
    })

    describe("_nonblockingLzReceive", () => {
        it("reverts when payload has incorrect packet type", async () => {
            const pkInvalid = 1
            await expect(wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload(pkInvalid))).to.be.revertedWith("WrappedTokenBridge: unknown packet type")
        })

        it("reverts when tokens aren't registered", async () => {
            await expect(wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload())).to.be.revertedWith("WrappedTokenBridge: token is not supported")
        })

        it("reverts when globalPaused is true", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.address, originalTokenChainId, originalToken.address)
            await wrappedTokenBridge.setGlobalPause(true)
            await expect(wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload())).to.be.revertedWith("WrappedTokenBridge: paused")
        })

        it("reverts when token is paused", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.address, originalTokenChainId, originalToken.address)
            await wrappedTokenBridge.setTokenPause(wrappedToken.address, true)
            await expect(wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload())).to.be.revertedWith("WrappedTokenBridge: paused")
        })

        it("mints wrapped tokens", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.address, originalTokenChainId, originalToken.address)
            await wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload())

            expect(await wrappedToken.totalSupply()).to.be.eq(amount)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(amount)
            expect(await wrappedTokenBridge.totalValueLocked(originalTokenChainId, originalToken.address)).to.be.eq(amount)
        })
    })

    describe("bridge", () => {
        let fee
        beforeEach(async () => {
            fee = (await wrappedTokenBridge.estimateBridgeFee(wrappedToken.address, originalTokenChainId, amount, user.address, false, false, adapterParams)).nativeFee
        })

        it("reverts when globalPaused is true", async () => {
            await wrappedTokenBridge.setGlobalPause(true)
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.address, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("TokenBridgeBase: paused")
        })

        it("reverts when token is paused", async () => {
            await wrappedTokenBridge.setTokenPause(wrappedToken.address, true)
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.address, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("TokenBridgeBase: paused")
        })

        it("reverts when token is address zero", async () => {
            await expect(wrappedTokenBridge.connect(user).bridge(constants.AddressZero, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("WrappedTokenBridge: invalid token")
        })

        it("reverts when to is address zero", async () => {
            await expect(
                wrappedTokenBridge.connect(user).bridge(wrappedToken.address, originalTokenChainId, amount, constants.AddressZero, false, callParams, adapterParams, {
                    value: fee,
                })
            ).to.be.revertedWith("WrappedTokenBridge: invalid to")
        })

        it("reverts when useCustomAdapterParams is false and non-empty adapterParams are passed", async () => {
            const adapterParamsV1 = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.address, originalTokenChainId, amount, user.address, false, callParams, adapterParamsV1, { value: fee })).to.be.revertedWith("TokenBridgeBase: adapterParams must be empty")
        })

        it("reverts when token is not registered", async () => {
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.address, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("WrappedTokenBridge: token is not supported")
        })

        it("reverts when amount is 0", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.address, originalTokenChainId, originalToken.address)
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.address, originalTokenChainId, 0, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("WrappedTokenBridge: invalid amount")
        })

        it("burns wrapped tokens", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.address, originalTokenChainId, originalToken.address)

            // Tokens minted
            await wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload())

            expect(await wrappedToken.totalSupply()).to.be.eq(amount)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(amount)
            expect(await wrappedTokenBridge.totalValueLocked(originalTokenChainId, originalToken.address)).to.be.eq(amount)

            // Tokens burned
            await wrappedTokenBridge.connect(user).bridge(wrappedToken.address, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })

            expect(await wrappedToken.totalSupply()).to.be.eq(0)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(0)
            expect(await wrappedTokenBridge.totalValueLocked(originalTokenChainId, originalToken.address)).to.be.eq(0)
        })
    })
})