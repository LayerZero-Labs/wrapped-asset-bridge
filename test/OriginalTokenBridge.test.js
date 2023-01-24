const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants } = require("ethers")

describe("OriginalTokenBridge", () => {
    const originalTokenChainId = 0
    const wrappedTokenChainId = 1
    const amount = utils.parseEther("10")
    const pkUnlock = 1

    let owner, user
    let originalToken, weth
    let originalTokenBridge
    let originalTokenEndpoint, originalTokenBridgeFactory
    let callParams, adapterParams

    const createPayload = (pk = pkUnlock, token = originalToken.address, withdrawalAmount = amount, totalAmount = amount, unwrapWeth = false) => utils.defaultAbiCoder.encode(
        ["uint8", "address", "address", "uint256", "uint256", "bool"], 
        [pk, token, user.address, withdrawalAmount, totalAmount, unwrapWeth]
    )

    beforeEach(async () => {
        [owner, user] = await ethers.getSigners()

        const wethFactory = await ethers.getContractFactory("WETH9")
        weth = await wethFactory.deploy()

        const endpointFactory = await ethers.getContractFactory("LayerZeroEndpointStub")
        originalTokenEndpoint = await endpointFactory.deploy()
        const wrappedTokenEndpoint = await endpointFactory.deploy()

        originalTokenBridgeFactory = await ethers.getContractFactory("OriginalTokenBridgeHarness")
        originalTokenBridge = await originalTokenBridgeFactory.deploy(originalTokenEndpoint.address, wrappedTokenChainId, weth.address)

        const wrappedTokenBridgeFactory = await ethers.getContractFactory("WrappedTokenBridge")
        const wrappedTokenBridge = await wrappedTokenBridgeFactory.deploy(wrappedTokenEndpoint.address)

        const ERC20Factory = await ethers.getContractFactory("MintableERC20Mock")
        originalToken = await ERC20Factory.deploy("TEST", "TEST")

        await originalTokenBridge.setTrustedRemoteAddress(wrappedTokenChainId, wrappedTokenBridge.address)
        await originalToken.mint(user.address, amount)

        callParams = { refundAddress: user.address, zroPaymentAddress: constants.AddressZero }
        adapterParams = "0x"
    })

    it("reverts when passing address zero as WETH in the constructor", async () => {
        await expect(originalTokenBridgeFactory.deploy(originalTokenEndpoint.address, wrappedTokenChainId, constants.AddressZero)).to.be.revertedWith("OriginalTokenBridge: invalid WETH address")
    })

    it("doesn't renounce ownership", async () => {
        await originalTokenBridge.renounceOwnership()
        expect(await originalTokenBridge.owner()).to.be.eq(owner.address)
    })

    describe("registerToken", () => {
        it("reverts when passing address zero", async () => {
            await expect(originalTokenBridge.registerToken(constants.AddressZero)).to.be.revertedWith("OriginalTokenBridge: invalid token address")
        })

        it("reverts if token already registered", async () => {
            await originalTokenBridge.registerToken(originalToken.address)
            await expect(originalTokenBridge.registerToken(originalToken.address)).to.be.revertedWith("OriginalTokenBridge: token already registered")
        })

        it("reverts when called by non owner", async () => {
            await expect(originalTokenBridge.connect(user).registerToken(originalToken.address)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("registers token when", async () => {
            await originalTokenBridge.registerToken(originalToken.address)
            expect(await originalTokenBridge.supportedTokens(originalToken.address)).to.be.true
        })
    })

    describe("setRemoteChainId", () => {
        const newRemoteChainId = 2
        it("reverts when called by non owner", async () => {
            await expect(originalTokenBridge.connect(user).setRemoteChainId(newRemoteChainId)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("sets remote chain id", async () => {
            await originalTokenBridge.setRemoteChainId(newRemoteChainId)
            expect(await originalTokenBridge.remoteChainId()).to.be.eq(newRemoteChainId)
        })
    })   

    describe("setUseCustomAdapterParams", () => {
        it("reverts when called by non owner", async () => {
            await expect(originalTokenBridge.connect(user).setUseCustomAdapterParams(true)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("sets global pause", async () => {
            await originalTokenBridge.setUseCustomAdapterParams(true)
            expect(await originalTokenBridge.useCustomAdapterParams()).to.be.true
        })
    })

    describe("bridge", () => {
        let fee
        beforeEach(async () => {
            fee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            await originalToken.connect(user).approve(originalTokenBridge.address, amount)
        })
            
        it("reverts when to is address zero", async () => {
            await expect(originalTokenBridge.connect(user).bridge(originalToken.address, amount, constants.AddressZero, callParams, adapterParams, { value: fee })).to.be.revertedWith("OriginalTokenBridge: invalid to")
        })

        it("reverts when token is not registered", async () => {
            await expect(originalTokenBridge.connect(user).bridge(originalToken.address, amount, user.address, callParams, adapterParams, { value: fee })).to.be.revertedWith("OriginalTokenBridge: token is not supported")
        })

        it("reverts when useCustomAdapterParams is false and non-empty adapterParams are passed", async () => {
            const adapterParamsV1 = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])
            await originalTokenBridge.registerToken(originalToken.address)
            await expect(originalTokenBridge.connect(user).bridge(originalToken.address, amount, user.address, callParams, adapterParamsV1, { value: fee })).to.be.revertedWith("TokenBridgeBase: adapterParams must be empty")
        })

        it("reverts when amount is 0", async () => {
            await originalTokenBridge.registerToken(originalToken.address)
            await expect(originalTokenBridge.connect(user).bridge(originalToken.address, 0, user.address, callParams, adapterParams, { value: fee })).to.be.revertedWith("OriginalTokenBridge: invalid amount")
        })

        it("locks tokens in the contract", async () => {
            await originalTokenBridge.registerToken(originalToken.address)            
            await originalTokenBridge.connect(user).bridge(originalToken.address, amount, user.address, callParams, adapterParams, { value: fee })

            expect(await originalTokenBridge.totalValueLocked(originalToken.address)).to.be.eq(amount)
            expect(await originalToken.balanceOf(originalTokenBridge.address)).to.be.eq(amount)
        })
    })

    describe("bridgeETH", () => {
        let totalAmount
        beforeEach(async () => {
            const fee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            totalAmount = amount.add(fee)
        })

        it("reverts when to is address zero", async () => {
            await expect(originalTokenBridge.connect(user).bridgeETH(amount, constants.AddressZero, callParams, adapterParams, { value: totalAmount })).to.be.revertedWith("OriginalTokenBridge: invalid to")
        })

        it("reverts when WETH is not registered", async () => {
            await expect(originalTokenBridge.connect(user).bridgeETH(amount, user.address, callParams, adapterParams, { value: totalAmount })).to.be.revertedWith("OriginalTokenBridge: token is not supported")
        })

        it("reverts when useCustomAdapterParams is false and non-empty adapterParams are passed", async () => {
            const adapterParamsV1 = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])
            await originalTokenBridge.registerToken(weth.address)
            await expect(originalTokenBridge.connect(user).bridgeETH(amount, user.address, callParams, adapterParamsV1, { value: totalAmount })).to.be.revertedWith("TokenBridgeBase: adapterParams must be empty")
        })

        it("reverts when useCustomAdapterParams is true and min gas limit isn't set", async () => {
            const adapterParamsV1 = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])
            await originalTokenBridge.registerToken(weth.address)
            await originalTokenBridge.setUseCustomAdapterParams(true)
            await expect(originalTokenBridge.connect(user).bridgeETH(amount, user.address, callParams, adapterParamsV1, { value: totalAmount })).to.be.revertedWith("LzApp: minGasLimit not set")
        })

        it("reverts when amount is 0", async () => {
            await originalTokenBridge.registerToken(weth.address)
            await expect(originalTokenBridge.connect(user).bridgeETH(0, user.address, callParams, adapterParams, { value: totalAmount })).to.be.revertedWith("OriginalTokenBridge: invalid amount")
        })

        it("reverts when value is less than amount", async () => {
            await originalTokenBridge.registerToken(weth.address)
            await expect(originalTokenBridge.connect(user).bridgeETH(amount, user.address, callParams, adapterParams, { value: 0 })).to.be.reverted
        })

        it("locks WETH in the contract", async () => {
            await originalTokenBridge.registerToken(weth.address)
            await originalTokenBridge.connect(user).bridgeETH(amount, user.address, callParams, adapterParams, { value: totalAmount })

            expect(await originalTokenBridge.totalValueLocked(weth.address)).to.be.eq(amount)
            expect(await weth.balanceOf(originalTokenBridge.address)).to.be.eq(amount)
        })
    })

    describe("_nonblockingLzReceive", () => {
        it("reverts when received from an unknown chain", async () => {
            await expect(originalTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, "0x")).to.be.revertedWith("OriginalTokenBridge: invalid source chain id")
        })

        it("reverts when payload has incorrect packet type", async () => {
            const PK_INVALID = 0
            await expect(originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(PK_INVALID))).to.be.revertedWith("OriginalTokenBridge: unknown packet type")
        })

        it("unlocks, collects withdrawal fees and transfers funds to the recipient", async () => {
            const bridgingFee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            const withdrawalFee = amount.div(100)
            const withdrawalAmount = amount.sub(withdrawalFee)

            // Setup
            await originalTokenBridge.registerToken(originalToken.address)
            await originalToken.connect(user).approve(originalTokenBridge.address, amount)

            // Bridge
            await originalTokenBridge.connect(user).bridge(originalToken.address, amount, user.address, callParams, adapterParams, { value: bridgingFee })

            expect(await originalToken.balanceOf(user.address)).to.be.eq(0)
            expect(await originalToken.balanceOf(originalTokenBridge.address)).to.be.eq(amount)

            // Receive
            await originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnlock, originalToken.address, withdrawalAmount, amount))

            expect(await originalTokenBridge.totalValueLocked(originalToken.address)).to.be.eq(0)
            expect(await originalToken.balanceOf(originalTokenBridge.address)).to.be.eq(withdrawalFee)
            expect(await originalToken.balanceOf(user.address)).to.be.eq(withdrawalAmount)
        })

        it("unlocks WETH and transfers ETH to the recipient", async () => {
            const bridgingFee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            totalAmount = amount.add(bridgingFee)

            // Setup
            await originalTokenBridge.registerToken(weth.address)

            // Bridge
            await originalTokenBridge.connect(user).bridgeETH(amount, user.address, callParams, adapterParams, { value: totalAmount })
            const recipientBalanceBefore = await ethers.provider.getBalance(user.address)

            // Receive
            await originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnlock, weth.address, amount, amount, true))

            expect(await originalTokenBridge.totalValueLocked(weth.address)).to.be.eq(0)
            expect(await weth.balanceOf(originalTokenBridge.address)).to.be.eq(0)
            expect(await weth.balanceOf(user.address)).to.be.eq(0)
            expect(await ethers.provider.getBalance(user.address)).to.be.eq(recipientBalanceBefore.add(amount))
        })
    })

    describe("withdrawFee", () => {
        it("reverts when called by non owner", async () => {
            await expect(originalTokenBridge.connect(user).withdrawFee(originalToken.address, owner.address, 1)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("reverts when not enough fees collected", async () => {
            await expect(originalTokenBridge.withdrawFee(originalToken.address, owner.address, 1)).to.be.revertedWith("OriginalTokenBridge: not enough fees collected")
        })

        it("withdraws fees", async () => {
            const bridgingFee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            const withdrawFee = amount.div(100)
            const withdrawAmount = amount.sub(withdrawFee)

            await originalTokenBridge.registerToken(originalToken.address)
            await originalToken.connect(user).approve(originalTokenBridge.address, amount)

            await originalTokenBridge.connect(user).bridge(originalToken.address, amount, user.address, callParams, adapterParams, { value: bridgingFee })
            await originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnlock, originalToken.address, withdrawAmount, amount))

            await originalTokenBridge.withdrawFee(originalToken.address, owner.address, withdrawFee)
            expect(await originalToken.balanceOf(owner.address)).to.be.eq(withdrawFee)
        })
    })
})