const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants } = require("ethers")

describe("End to End", function () {
    const ethereumChainId = 0
    const polygonChainId = 1
    const wrappedTokenChainId = 2
    const ethereumAmount = utils.parseEther("10")
    const polygonAmount = utils.parseEther("5")
    const name = "TEST"
    const symbol = "TEST"
    const sharedDecimals = 6
    const wethSharedDecimals = 18

    let owner, user
    let ethereumERC20, weth, polygonERC20, wmatic, wrappedToken
    let ethereumBridge, polygonBridge, wrappedTokenBridge
    let callParams, adapterParams
    let ethereumAmountSD, polygonAmountSD

    beforeEach(async () => {
        [owner, user] = await ethers.getSigners()

        const endpointFactory = await ethers.getContractFactory("LZEndpointMock")
        const ethereumEndpoint = await endpointFactory.deploy(ethereumChainId)
        const polygonEndpoint = await endpointFactory.deploy(polygonChainId)
        const wrappedTokenEndpoint = await endpointFactory.deploy(wrappedTokenChainId)

        const wethFactory = await ethers.getContractFactory("WETH9")
        weth = await wethFactory.deploy()
        wmatic = await wethFactory.deploy()

        const originalTokenBridgeFactory = await ethers.getContractFactory("OriginalTokenBridge")
        ethereumBridge = await originalTokenBridgeFactory.deploy(ethereumEndpoint.address, wrappedTokenChainId, weth.address)
        polygonBridge = await originalTokenBridgeFactory.deploy(polygonEndpoint.address, wrappedTokenChainId, wmatic.address)

        const wrappedTokenBridgeFactory = await ethers.getContractFactory("WrappedTokenBridge")
        wrappedTokenBridge = await wrappedTokenBridgeFactory.deploy(wrappedTokenEndpoint.address)

        const ERC20Factory = await ethers.getContractFactory("MintableERC20Mock")
        ethereumERC20 = await ERC20Factory.deploy(name, symbol)
        polygonERC20 = await ERC20Factory.deploy(name, symbol)

        const wrappedERC20Factory = await ethers.getContractFactory("WrappedERC20")
        wrappedToken = await wrappedERC20Factory.deploy(wrappedTokenBridge.address, name, symbol, sharedDecimals)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await ethereumEndpoint.setDestLzEndpoint(wrappedTokenBridge.address, wrappedTokenEndpoint.address)
        await polygonEndpoint.setDestLzEndpoint(wrappedTokenBridge.address, wrappedTokenEndpoint.address)
        await wrappedTokenEndpoint.setDestLzEndpoint(ethereumBridge.address, ethereumEndpoint.address)
        await wrappedTokenEndpoint.setDestLzEndpoint(polygonBridge.address, polygonEndpoint.address)

        await ethereumBridge.setTrustedRemoteAddress(wrappedTokenChainId, wrappedTokenBridge.address)
        await polygonBridge.setTrustedRemoteAddress(wrappedTokenChainId, wrappedTokenBridge.address)
        await wrappedTokenBridge.setTrustedRemoteAddress(ethereumChainId, ethereumBridge.address)
        await wrappedTokenBridge.setTrustedRemoteAddress(polygonChainId, polygonBridge.address)

        await ethereumERC20.mint(user.address, ethereumAmount)
        await polygonERC20.mint(user.address, polygonAmount)

        callParams = { refundAddress: user.address, zroPaymentAddress: constants.AddressZero }
        adapterParams = "0x"
    })

    describe("bridge 10 ERC20 tokens from Ethereum", function () {
        beforeEach(async () => {
            await ethereumBridge.registerToken(ethereumERC20.address, sharedDecimals)
            await wrappedTokenBridge.registerToken(wrappedToken.address, ethereumChainId, ethereumERC20.address)

            await ethereumERC20.connect(user).approve(ethereumBridge.address, ethereumAmount)
            const fee = await ethereumBridge.estimateBridgeFee(false, adapterParams)
            await ethereumBridge.connect(user).bridge(ethereumERC20.address, ethereumAmount, user.address, callParams, adapterParams, { value: fee.nativeFee })

            const LDtoSD = await ethereumBridge.LDtoSDConversionRate(ethereumERC20.address)
            ethereumAmountSD = ethereumAmount.div(LDtoSD)
        })

        it("locks original tokens", async () => {
            expect(await ethereumBridge.totalValueLockedSD(ethereumERC20.address)).to.be.eq(ethereumAmountSD)
            expect(await ethereumERC20.balanceOf(ethereumBridge.address)).to.be.eq(ethereumAmount)
        })

        it("mints wrapped tokens", async () => {
            expect(await wrappedToken.totalSupply()).to.be.eq(ethereumAmountSD)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(ethereumAmountSD)
            expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, ethereumERC20.address)).to.be.eq(ethereumAmountSD)
        })

        describe("bridge 5 ERC20 tokens from Polygon", function () {
            beforeEach(async () => {
                await polygonBridge.registerToken(polygonERC20.address, sharedDecimals)
                await wrappedTokenBridge.registerToken(wrappedToken.address, polygonChainId, polygonERC20.address)

                await polygonERC20.connect(user).approve(polygonBridge.address, polygonAmount)
                const fee = await polygonBridge.estimateBridgeFee(false, adapterParams)
                await polygonBridge.connect(user).bridge(polygonERC20.address, polygonAmount, user.address, callParams, adapterParams, { value: fee.nativeFee })

                const LDtoSD = await ethereumBridge.LDtoSDConversionRate(ethereumERC20.address)
                polygonAmountSD = polygonAmount.div(LDtoSD)
            })

            it("locks original tokens", async () => {
                expect(await polygonBridge.totalValueLockedSD(polygonERC20.address)).to.be.eq(polygonAmountSD)
                expect(await polygonERC20.balanceOf(polygonBridge.address)).to.be.eq(polygonAmount)
            })

            it("mints wrapped tokens", async () => {
                const totalAmountSD = ethereumAmountSD.add(polygonAmountSD)
                expect(await wrappedToken.totalSupply()).to.be.eq(totalAmountSD)
                expect(await wrappedToken.balanceOf(user.address)).to.be.eq(totalAmountSD)
                expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, ethereumERC20.address)).to.be.eq(ethereumAmountSD)
                expect(await wrappedTokenBridge.totalValueLocked(polygonChainId, polygonERC20.address)).to.be.eq(polygonAmountSD)
            })

            it("reverts when trying to bridge 6 wrapped tokens to Polygon", async () => {
                const amount = polygonAmountSD.add(utils.parseUnits("1", sharedDecimals))
                const fee = await wrappedTokenBridge.estimateBridgeFee(polygonChainId, false, adapterParams)

                it("reverts when called by non owner", async () => {
                    await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.address, polygonChainId, amount, user.address, false, callParams, adapterParams, { value: fee.nativeFee })).to.be.revertedWith("WrappedTokenBridge: insufficient liquidity on the destination")
                })
            })

            describe("bridge 10 wrapped ERC20 tokens to Ethereum", function () {
                beforeEach(async () => {
                    const fee = await wrappedTokenBridge.estimateBridgeFee(ethereumChainId, false, adapterParams)
                    await wrappedTokenBridge.connect(user).bridge(wrappedToken.address, ethereumChainId, ethereumAmountSD, user.address, false, callParams, adapterParams, { value: fee.nativeFee })
                })

                it("burns wrapped tokens", async () => {
                    expect(await wrappedToken.totalSupply()).to.be.eq(polygonAmountSD)
                    expect(await wrappedToken.balanceOf(user.address)).to.be.eq(polygonAmountSD)
                    expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, ethereumERC20.address)).to.be.eq(0)
                })

                it("unlocks original tokens", async () => {
                    expect(await ethereumBridge.totalValueLockedSD(ethereumERC20.address)).to.be.eq(0)
                    expect(await ethereumERC20.balanceOf(ethereumBridge.address)).to.be.eq(0)
                    expect(await ethereumERC20.balanceOf(user.address)).to.be.eq(ethereumAmount)
                })

                describe("bridge 5 wrapped ERC20 tokens to Polygon", function () {
                    beforeEach(async () => {
                        const fee = await wrappedTokenBridge.estimateBridgeFee(polygonChainId, false, adapterParams)
                        await wrappedTokenBridge.connect(user).bridge(wrappedToken.address, polygonChainId, polygonAmountSD, user.address, false, callParams, adapterParams, { value: fee.nativeFee })
                    })

                    it("burns wrapped tokens", async () => {
                        expect(await wrappedToken.totalSupply()).to.be.eq(0)
                        expect(await wrappedToken.balanceOf(user.address)).to.be.eq(0)
                        expect(await wrappedTokenBridge.totalValueLocked(polygonChainId, polygonERC20.address)).to.be.eq(0)
                    })

                    it("unlocks original tokens", async () => {
                        expect(await polygonBridge.totalValueLockedSD(polygonERC20.address)).to.be.eq(0)
                        expect(await polygonERC20.balanceOf(polygonBridge.address)).to.be.eq(0)
                        expect(await polygonERC20.balanceOf(user.address)).to.be.eq(polygonAmount)
                    })
                })
            })
        })
    })

    describe("bridge ETH from Ethereum", function () {
        beforeEach(async () => {
            await ethereumBridge.registerToken(weth.address, wethSharedDecimals)
            await wrappedTokenBridge.registerToken(wrappedToken.address, ethereumChainId, weth.address)

            const fee = await ethereumBridge.estimateBridgeFee(false, adapterParams)
            await ethereumBridge.connect(user).bridgeETH(ethereumAmount, user.address, callParams, adapterParams, { value: ethereumAmount.add(fee.nativeFee) })
        })

        it("locks WETH", async () => {
            expect(await ethereumBridge.totalValueLockedSD(weth.address)).to.be.eq(ethereumAmount)
            expect(await weth.balanceOf(ethereumBridge.address)).to.be.eq(ethereumAmount)
        })

        it("mints wrapped tokens", async () => {
            expect(await wrappedToken.totalSupply()).to.be.eq(ethereumAmount)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(ethereumAmount)
            expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, weth.address)).to.be.eq(ethereumAmount)
        })

        describe("bridge wrapped WETH token to Ethereum and collects fees", function () {
            let recipientBalanceBefore
            let withdrawalFee
            const unwrapWeth = true
            const toNumber = (bigNumber) => parseFloat(utils.formatEther(bigNumber.toString()))

            beforeEach(async () => {
                const withdrawalFeeBps = 20 // 0.2%
                const totalBps = await wrappedTokenBridge.TOTAL_BPS() // 100%
                withdrawalFee = ethereumAmount.mul(withdrawalFeeBps).div(totalBps)
                await wrappedTokenBridge.setWithdrawalFeeBps(withdrawalFeeBps)

                recipientBalanceBefore = toNumber(await ethers.provider.getBalance(user.address))
                const fee = await wrappedTokenBridge.estimateBridgeFee(ethereumChainId, false, adapterParams)
                await wrappedTokenBridge.connect(user).bridge(wrappedToken.address, ethereumChainId, ethereumAmount, user.address, unwrapWeth, callParams, adapterParams, { value: fee.nativeFee })
            })

            it("burns wrapped tokens", async () => {
                expect(await wrappedToken.totalSupply()).to.be.eq(0)
                expect(await wrappedToken.balanceOf(user.address)).to.be.eq(0)
                expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, weth.address)).to.be.eq(0)
            })

            it("unlocks ETH", async () => {
                expect(await ethereumBridge.totalValueLockedSD(weth.address)).to.be.eq(0)
                expect(await weth.balanceOf(ethereumBridge.address)).to.be.eq(withdrawalFee)
                expect(await weth.balanceOf(user.address)).to.be.eq(0)
                expect(toNumber(await ethers.provider.getBalance(user.address))).to.be.gt(recipientBalanceBefore)
            })
        })
    })
})