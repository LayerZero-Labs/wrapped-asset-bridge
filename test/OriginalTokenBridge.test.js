const { expect } = require("chai")
const { ethers, upgrades } = require("hardhat")
const { parseEther, AbiCoder, ZeroAddress } = require("ethers")

describe("OriginalTokenBridge", () => {
    const originalTokenChainId = 0
    const wrappedTokenChainId = 1
    const amount = parseEther("10")
    const pkUnlock = 1
    const sharedDecimals = 6
    const wethSharedDecimals = 18

    let owner, user
    let originalToken, weth
    let originalTokenBridge
    let originalTokenEndpoint, originalTokenBridgeFactory, originalTokenBridgeV2Factory
    let callParams, adapterParams

    const createPayload = (pk = pkUnlock, token = originalToken.target, withdrawalAmount = amount, totalAmount = amount, unwrapWeth = false) =>
        AbiCoder.defaultAbiCoder().encode(["uint8", "address", "address", "uint256", "uint256", "bool"], [pk, token, user.address, withdrawalAmount, totalAmount, unwrapWeth])

    beforeEach(async () => {
        ;[owner, user] = await ethers.getSigners()

        const wethFactory = await ethers.getContractFactory("WETH9")
        weth = await wethFactory.deploy()

        const endpointFactory = await ethers.getContractFactory("LayerZeroEndpointStub")
        originalTokenEndpoint = await endpointFactory.deploy()
        const wrappedTokenEndpoint = await endpointFactory.deploy()

        originalTokenBridgeFactory = await ethers.getContractFactory("OriginalTokenBridgeHarnessUpgradable")
        originalTokenBridge = await upgrades.deployProxy(originalTokenBridgeFactory, [originalTokenEndpoint.target, wrappedTokenChainId, weth.target], { kind: "uups" })

        const wrappedTokenBridgeFactory = await ethers.getContractFactory("WrappedTokenBridgeUpgradable")
        const wrappedTokenBridge = await upgrades.deployProxy(wrappedTokenBridgeFactory, [wrappedTokenEndpoint.target], { kind: "uups" })

        const ERC20Factory = await ethers.getContractFactory("MintableERC20Mock")
        originalToken = await ERC20Factory.deploy("TEST", "TEST")

        await originalTokenBridge.setTrustedRemoteAddress(wrappedTokenChainId, wrappedTokenBridge.target)
        await originalToken.mint(user.address, amount)

        callParams = { refundAddress: user.address, zroPaymentAddress: ZeroAddress }
        adapterParams = "0x"
    })

    it("reverts when passing address zero as WETH in the constructor", async () => {
        await expect(upgrades.deployProxy(originalTokenBridgeFactory, [originalTokenEndpoint.runner.address, wrappedTokenChainId, ZeroAddress], { kind: "uups" })).to.be.revertedWith("OriginalTokenBridge: invalid WETH address")
    })

    it("doesn't renounce ownership", async () => {
        await originalTokenBridge.renounceOwnership()
        expect(await originalTokenBridge.owner()).to.be.eq(owner.address)
    })

    describe("registerToken", () => {
        it("reverts when passing address zero", async () => {
            await expect(originalTokenBridge.registerToken(ZeroAddress, sharedDecimals)).to.be.revertedWith("OriginalTokenBridge: invalid token address")
        })

        it("reverts if token already registered", async () => {
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            await expect(originalTokenBridge.registerToken(originalToken.target, sharedDecimals)).to.be.revertedWith("OriginalTokenBridge: token already registered")
        })

        it("reverts when called by non owner", async () => {
            await expect(originalTokenBridge.connect(user).registerToken(originalToken.target, sharedDecimals)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("reverts when shared decimals is greater than local decimals", async () => {
            const invalidSharedDecimals = 19
            await expect(originalTokenBridge.registerToken(originalToken.target, invalidSharedDecimals)).to.be.revertedWith("OriginalTokenBridge: shared decimals must be less than or equal to local decimals")
        })

        it("registers token and saves local to shared decimals conversion rate", async () => {
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            expect(await originalTokenBridge.supportedTokens(originalToken.target)).to.be.true
            expect(await originalTokenBridge.LDtoSDConversionRate(originalToken.target)).to.be.eq(10 ** 12)
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

        it("sets useCustomAdapterParams to true", async () => {
            await originalTokenBridge.setUseCustomAdapterParams(true)
            expect(await originalTokenBridge.useCustomAdapterParams()).to.be.true
        })
    })

    describe("bridge", () => {
        let fee
        beforeEach(async () => {
            fee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            await originalToken.connect(user).approve(originalTokenBridge.target, amount)
        })

        it("reverts when to is address zero", async () => {
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            await expect(originalTokenBridge.connect(user).bridge(originalToken.target, amount, ZeroAddress, callParams, adapterParams, { value: fee })).to.be.revertedWith("OriginalTokenBridge: invalid to")
        })

        it("reverts when token is not registered", async () => {
            await expect(originalTokenBridge.connect(user).bridge(originalToken.target, amount, user.address, callParams, adapterParams, { value: fee })).to.be.revertedWith("OriginalTokenBridge: token is not supported")
        })

        it("reverts when useCustomAdapterParams is false and non-empty adapterParams are passed", async () => {
            const adapterParamsV1 = AbiCoder.defaultAbiCoder().encode(["uint16", "uint256"], [1, 200000])
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            await expect(originalTokenBridge.connect(user).bridge(originalToken.target, amount, user.address, callParams, adapterParamsV1, { value: fee })).to.be.revertedWith("TokenBridgeBase: adapterParams must be empty")
        })

        it("reverts when amount is 0", async () => {
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            await expect(originalTokenBridge.connect(user).bridge(originalToken.target, 0, user.address, callParams, adapterParams, { value: fee })).to.be.revertedWith("OriginalTokenBridge: invalid amount")
        })

        it("reverts when the sender doesn't have enough tokens", async () => {
            const newAmount = amount + parseEther("0.001")
            await originalToken.connect(user).approve(originalTokenBridge.target, newAmount)
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            await expect(originalTokenBridge.connect(user).bridge(originalToken.target, newAmount, user.address, callParams, adapterParams, { value: fee })).to.be.revertedWith("ERC20: transfer amount exceeds balance")
        })

        it("locks tokens in the contract", async () => {
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            await originalTokenBridge.connect(user).bridge(originalToken.target, amount, user.address, callParams, adapterParams, { value: fee })
            const LDtoSD = await originalTokenBridge.LDtoSDConversionRate(originalToken.target)

            expect(await originalTokenBridge.totalValueLockedSD(originalToken.target)).to.be.eq(amount / LDtoSD)
            expect(await originalToken.balanceOf(originalTokenBridge.target)).to.be.eq(amount)
            expect(await originalToken.balanceOf(user.address)).to.be.eq(0)
        })

        it("locks tokens in the contract and returns dust to the sender", async () => {
            const dust = BigInt("12345")
            const amountWithDust = dust + amount

            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
            await originalToken.mint(user.address, dust)
            await originalToken.connect(user).approve(originalTokenBridge.target, amountWithDust)
            await originalTokenBridge.connect(user).bridge(originalToken.target, amountWithDust, user.address, callParams, adapterParams, { value: fee })
            const LDtoSD = await originalTokenBridge.LDtoSDConversionRate(originalToken.target)

            expect(await originalTokenBridge.totalValueLockedSD(originalToken.target)).to.be.eq(amount / LDtoSD)
            expect(await originalToken.balanceOf(originalTokenBridge.target)).to.be.eq(amount)
            expect(await originalToken.balanceOf(user.address)).to.be.eq(dust)
        })
    })

    describe("bridgeNative", () => {
        let totalAmount
        beforeEach(async () => {
            const fee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            totalAmount = amount + fee
        })

        it("reverts when to is address zero", async () => {
            await originalTokenBridge.registerToken(weth.target, wethSharedDecimals)
            await expect(originalTokenBridge.connect(user).bridgeNative(amount, ZeroAddress, callParams, adapterParams, { value: totalAmount })).to.be.revertedWith("OriginalTokenBridge: invalid to")
        })

        it("reverts when WETH is not registered", async () => {
            await expect(originalTokenBridge.connect(user).bridgeNative(amount, user.address, callParams, adapterParams, { value: totalAmount })).to.be.revertedWith("OriginalTokenBridge: token is not supported")
        })

        it("reverts when useCustomAdapterParams is false and non-empty adapterParams are passed", async () => {
            const adapterParamsV1 = AbiCoder.defaultAbiCoder().encode(["uint16", "uint256"], [1, 200000])
            await originalTokenBridge.registerToken(weth.target, wethSharedDecimals)
            await expect(originalTokenBridge.connect(user).bridgeNative(amount, user.address, callParams, adapterParamsV1, { value: totalAmount })).to.be.revertedWith("TokenBridgeBase: adapterParams must be empty")
        })

        it("reverts when useCustomAdapterParams is true and min gas limit isn't set", async () => {
            const adapterParamsV1 = AbiCoder.defaultAbiCoder().encode(["uint16", "uint256"], [1, 200000])
            await originalTokenBridge.registerToken(weth.target, wethSharedDecimals)
            await originalTokenBridge.setUseCustomAdapterParams(true)
            await expect(originalTokenBridge.connect(user).bridgeNative(amount, user.address, callParams, adapterParamsV1, { value: totalAmount })).to.be.revertedWith("LzApp: minGasLimit not set")
        })

        it("reverts when amount is 0", async () => {
            await originalTokenBridge.registerToken(weth.target, wethSharedDecimals)
            await expect(originalTokenBridge.connect(user).bridgeNative(0, user.address, callParams, adapterParams, { value: totalAmount })).to.be.revertedWith("OriginalTokenBridge: invalid amount")
        })

        it("reverts when value is less than amount", async () => {
            await originalTokenBridge.registerToken(weth.target, wethSharedDecimals)
            await expect(originalTokenBridge.connect(user).bridgeNative(amount, user.address, callParams, adapterParams, { value: 0 })).to.be.revertedWith("OriginalTokenBridge: not enough value sent")
        })

        it("locks WETH in the contract", async () => {
            await originalTokenBridge.registerToken(weth.target, wethSharedDecimals)
            await originalTokenBridge.connect(user).bridgeNative(amount, user.address, callParams, adapterParams, { value: totalAmount })

            expect(await originalTokenBridge.totalValueLockedSD(weth.target)).to.be.eq(amount)
            expect(await weth.balanceOf(originalTokenBridge.target)).to.be.eq(amount)
        })
    })

    describe("_nonblockingLzReceive", () => {
        beforeEach(async () => {
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
        })

        it("reverts when received from an unknown chain", async () => {
            await expect(originalTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, "0x")).to.be.revertedWith("OriginalTokenBridge: invalid source chain id")
        })

        it("reverts when payload has incorrect packet type", async () => {
            const pkUnknown = 0
            await expect(originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnknown))).to.be.revertedWith("OriginalTokenBridge: unknown packet type")
        })

        it("reverts when a token is not supported", async () => {
            const ERC20Factory = await ethers.getContractFactory("MintableERC20Mock")
            const newToken = await ERC20Factory.deploy("NEW", "NEW")
            await expect(originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnlock, newToken.target))).to.be.revertedWith("OriginalTokenBridge: token is not supported")
        })

        it("unlocks, collects withdrawal fees and transfers funds to the recipient", async () => {
            const LDtoSD = await originalTokenBridge.LDtoSDConversionRate(originalToken.target)
            const bridgingFee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            const withdrawalFee = amount / BigInt(100)
            const withdrawalAmount = amount - withdrawalFee
            const withdrawalAmountSD = withdrawalAmount / LDtoSD
            const totalAmountSD = amount / LDtoSD

            // Setup
            await originalToken.connect(user).approve(originalTokenBridge.target, amount)

            // Bridge
            await originalTokenBridge.connect(user).bridge(originalToken.target, amount, user.address, callParams, adapterParams, { value: bridgingFee })

            expect(await originalToken.balanceOf(user.address)).to.be.eq(0)
            expect(await originalToken.balanceOf(originalTokenBridge.target)).to.be.eq(amount)

            // Receive
            await originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnlock, originalToken.target, withdrawalAmountSD, totalAmountSD))

            expect(await originalTokenBridge.totalValueLockedSD(originalToken.target)).to.be.eq(0)
            expect(await originalToken.balanceOf(originalTokenBridge.target)).to.be.eq(withdrawalFee)
            expect(await originalToken.balanceOf(user.address)).to.be.eq(withdrawalAmount)
        })

        it("unlocks WETH and transfers ETH to the recipient", async () => {
            const bridgingFee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            totalAmount = amount + bridgingFee

            // Setup
            await originalTokenBridge.registerToken(weth.target, wethSharedDecimals)

            // Bridge
            await originalTokenBridge.connect(user).bridgeNative(amount, user.address, callParams, adapterParams, { value: totalAmount })
            const recipientBalanceBefore = await ethers.provider.getBalance(user.address)

            // Receive
            await originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnlock, weth.target, amount, amount, true))

            expect(await originalTokenBridge.totalValueLockedSD(weth.target)).to.be.eq(0)
            expect(await weth.balanceOf(originalTokenBridge.target)).to.be.eq(0)
            expect(await weth.balanceOf(user.address)).to.be.eq(0)
            expect(await ethers.provider.getBalance(user.address)).to.be.eq(recipientBalanceBefore + amount)
        })
    })

    describe("withdrawFee", () => {
        beforeEach(async () => {
            await originalTokenBridge.registerToken(originalToken.target, sharedDecimals)
        })

        it("reverts when called by non owner", async () => {
            await expect(originalTokenBridge.connect(user).withdrawFee(originalToken.target, owner.address, 1)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("reverts when not enough fees collected", async () => {
            await expect(originalTokenBridge.withdrawFee(originalToken.target, owner.address, 1)).to.be.revertedWith("OriginalTokenBridge: not enough fees collected")
        })

        it("withdraws fees", async () => {
            const LDtoSD = await originalTokenBridge.LDtoSDConversionRate(originalToken.target)
            const bridgingFee = (await originalTokenBridge.estimateBridgeFee(false, adapterParams)).nativeFee
            const withdrawalFee = amount / BigInt(100)
            const withdrawalAmount = amount - withdrawalFee
            const withdrawalAmountSD = withdrawalAmount / LDtoSD
            const totalAmountSD = amount / LDtoSD

            await originalToken.connect(user).approve(originalTokenBridge.target, amount)
            await originalTokenBridge.connect(user).bridge(originalToken.target, amount, user.address, callParams, adapterParams, { value: bridgingFee })
            await originalTokenBridge.simulateNonblockingLzReceive(wrappedTokenChainId, createPayload(pkUnlock, originalToken.target, withdrawalAmountSD, totalAmountSD))

            await originalTokenBridge.withdrawFee(originalToken.target, owner.address, withdrawalFee)
            expect(await originalToken.balanceOf(owner.address)).to.be.eq(withdrawalFee)
        })
    })

    describe("Upgrades Contract", () => {
        beforeEach(async () => {
            originalTokenBridgeV2Factory = await ethers.getContractFactory("OriginalTokenBridgeHarnessUpgradableV2")
        })

        it("reverts when upgraded by non owner", async () => {
            const connectedProxy = originalTokenBridgeV2Factory.connect(user)
            await expect(upgrades.upgradeProxy(originalTokenBridge, connectedProxy)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("Upgrades the contract", async () => {
            await upgrades.upgradeProxy(originalTokenBridge, originalTokenBridgeV2Factory)
            const filter = originalTokenBridge.filters.Upgraded()
            const logs = await originalTokenBridge.queryFilter(filter)
            const event = logs[0]
            expect(event).to.exist
        })
    })
})
