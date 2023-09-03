const { expect } = require("chai")
const { ethers, upgrades } = require("hardhat")
const { parseEther, AbiCoder, ZeroAddress } = require("ethers")

describe("WrappedTokenBridge", () => {
    const originalTokenChainId = 0
    const wrappedTokenChainId = 1
    const amount = parseEther("10")
    const pkMint = 0

    let owner, user
    let originalToken, wrappedToken
    let wrappedTokenBridge
    let wrappedTokenEndpoint, wrappedTokenBridgeFactory, wrappedTokenBridgeV2Factory
    let callParams, adapterParams

    const createPayload = (pk = pkMint, token = originalToken.target) => AbiCoder.defaultAbiCoder().encode(["uint8", "address", "address", "uint256"], [pk, token, user.address, amount])

    beforeEach(async () => {
        ;[owner, user] = await ethers.getSigners()

        const endpointFactory = await ethers.getContractFactory("LayerZeroEndpointStub")
        const originalTokenEndpoint = await endpointFactory.deploy()
        wrappedTokenEndpoint = await endpointFactory.deploy()

        const wethFactory = await ethers.getContractFactory("WETH9")
        const weth = await wethFactory.deploy()
        const originalTokenBridgeFactory = await ethers.getContractFactory("OriginalTokenBridgeUpgradable")
        const originalTokenBridge = await upgrades.deployProxy(originalTokenBridgeFactory, [originalTokenEndpoint.target, wrappedTokenChainId, weth.target], { kind: "uups" })

        wrappedTokenBridgeFactory = await ethers.getContractFactory("WrappedTokenBridgeHarnessUpgradable")
        wrappedTokenBridge = await upgrades.deployProxy(wrappedTokenBridgeFactory, [wrappedTokenEndpoint.target], { kind: "uups" })

        const ERC20Factory = await ethers.getContractFactory("MintableERC20Mock")
        originalToken = await ERC20Factory.deploy("TEST", "TEST")
        const originalERC20Decimals = await originalToken.decimals()

        const wrappedERC20Factory = await ethers.getContractFactory("WrappedERC20")
        wrappedToken = await wrappedERC20Factory.deploy(wrappedTokenBridge.target, "WTEST", "WTEST", originalERC20Decimals)

        await wrappedTokenBridge.setTrustedRemoteAddress(originalTokenChainId, originalTokenBridge.target)

        callParams = { refundAddress: user.address, zroPaymentAddress: ZeroAddress }
        adapterParams = "0x"
    })

    it("doesn't renounce ownership", async () => {
        await wrappedTokenBridge.renounceOwnership()
        expect(await wrappedTokenBridge.owner()).to.be.eq(owner.address)
    })

    describe("registerToken", () => {
        it("reverts when called by non owner", async () => {
            await expect(wrappedTokenBridge.connect(user).registerToken(wrappedToken.target, originalTokenChainId, originalToken.target)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("reverts when local token is address zero", async () => {
            await expect(wrappedTokenBridge.registerToken(ZeroAddress, originalTokenChainId, originalToken.target)).to.be.revertedWith("WrappedTokenBridge: invalid local token")
        })

        it("reverts when remote token is address zero", async () => {
            await expect(wrappedTokenBridge.registerToken(wrappedToken.target, originalTokenChainId, ZeroAddress)).to.be.revertedWith("WrappedTokenBridge: invalid remote token")
        })

        it("reverts if token already registered", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.target, originalTokenChainId, originalToken.target)
            await expect(wrappedTokenBridge.registerToken(wrappedToken.target, originalTokenChainId, originalToken.target)).to.be.revertedWith("WrappedTokenBridge: token already registered")
        })

        it("registers tokens", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.target, originalTokenChainId, originalToken.target)

            expect(await wrappedTokenBridge.localToRemote(wrappedToken.target, originalTokenChainId)).to.be.eq(originalToken.target)
            expect(await wrappedTokenBridge.remoteToLocal(originalToken.target, originalTokenChainId)).to.be.eq(wrappedToken.target)
        })
    })

    describe("setWithdrawalFeeBps", () => {
        const withdrawalFeeBps = 10
        it("reverts when fee bps is greater than or equal to 100%", async () => {
            await expect(wrappedTokenBridge.setWithdrawalFeeBps(10000)).to.be.revertedWith("WrappedTokenBridge: invalid withdrawal fee")
        })

        it("reverts when called by non owner", async () => {
            await expect(wrappedTokenBridge.connect(user).setWithdrawalFeeBps(withdrawalFeeBps)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("sets withdrawal fee bps", async () => {
            await wrappedTokenBridge.setWithdrawalFeeBps(withdrawalFeeBps)
            expect(await wrappedTokenBridge.withdrawalFeeBps()).to.be.eq(withdrawalFeeBps)
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

        it("mints wrapped tokens", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.target, originalTokenChainId, originalToken.target)
            await wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload())

            expect(await wrappedToken.totalSupply()).to.be.eq(amount)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(amount)
            expect(await wrappedTokenBridge.totalValueLocked(originalTokenChainId, originalToken.target)).to.be.eq(amount)
        })
    })

    describe("bridge", () => {
        let fee
        beforeEach(async () => {
            fee = (await wrappedTokenBridge.estimateBridgeFee(originalTokenChainId, false, adapterParams)).nativeFee
        })

        it("reverts when token is address zero", async () => {
            await expect(wrappedTokenBridge.connect(user).bridge(ZeroAddress, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("WrappedTokenBridge: invalid token")
        })

        it("reverts when to is address zero", async () => {
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.target, originalTokenChainId, amount, ZeroAddress, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("WrappedTokenBridge: invalid to")
        })

        it("reverts when useCustomAdapterParams is false and non-empty adapterParams are passed", async () => {
            const adapterParamsV1 = AbiCoder.defaultAbiCoder().encode(["uint16", "uint256"], [1, 200000])
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.target, originalTokenChainId, amount, user.address, false, callParams, adapterParamsV1, { value: fee })).to.be.revertedWith("TokenBridgeBase: adapterParams must be empty")
        })

        it("reverts when token is not registered", async () => {
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.target, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("WrappedTokenBridge: token is not supported")
        })

        it("reverts when amount is 0", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.target, originalTokenChainId, originalToken.target)
            await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.target, originalTokenChainId, 0, user.address, false, callParams, adapterParams, { value: fee })).to.be.revertedWith("WrappedTokenBridge: invalid amount")
        })

        it("burns wrapped tokens", async () => {
            await wrappedTokenBridge.registerToken(wrappedToken.target, originalTokenChainId, originalToken.target)

            // Tokens minted
            await wrappedTokenBridge.simulateNonblockingLzReceive(originalTokenChainId, createPayload())

            expect(await wrappedToken.totalSupply()).to.be.eq(amount)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(amount)
            expect(await wrappedTokenBridge.totalValueLocked(originalTokenChainId, originalToken.target)).to.be.eq(amount)

            // Tokens burned
            await wrappedTokenBridge.connect(user).bridge(wrappedToken.target, originalTokenChainId, amount, user.address, false, callParams, adapterParams, { value: fee })

            expect(await wrappedToken.totalSupply()).to.be.eq(0)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(0)
            expect(await wrappedTokenBridge.totalValueLocked(originalTokenChainId, originalToken.target)).to.be.eq(0)
        })
    })

    describe("Upgrades Contract", () => {
        beforeEach(async () => {
            wrappedTokenBridgeV2Factory = await ethers.getContractFactory("WrappedTokenBridgeHarnessUpgradableV2")
        })

        it("reverts when upgraded by non owner", async () => {
            const connectedProxy = wrappedTokenBridgeV2Factory.connect(user)
            await expect(upgrades.upgradeProxy(wrappedTokenBridge, connectedProxy)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("Upgrades the contract", async () => {
            await upgrades.upgradeProxy(wrappedTokenBridge, wrappedTokenBridgeV2Factory)
            const filter = wrappedTokenBridge.filters.Upgraded()
            const logs = await wrappedTokenBridge.queryFilter(filter)
            const event = logs[0]
            expect(event).to.exist
        })
    })
})
