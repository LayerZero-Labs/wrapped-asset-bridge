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

    let owner, user
    let ethereumERC20, weth, polygonERC20, wmatic, wrappedToken
    let ethereumBridge, polygonBridge, wrappedTokenBridge
    let callParams, adapterParams

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
        const originalTokenDecimals = await ethereumERC20.decimals()

        const wrappedERC20Factory = await ethers.getContractFactory("WrappedERC20")
        wrappedToken = await wrappedERC20Factory.deploy(wrappedTokenBridge.address, name, symbol, originalTokenDecimals)

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
            await ethereumBridge.registerToken(ethereumERC20.address)
            await wrappedTokenBridge.registerToken(wrappedToken.address, ethereumChainId, ethereumERC20.address)

            await ethereumERC20.connect(user).approve(ethereumBridge.address, ethereumAmount)
            const fee = await ethereumBridge.estimateBridgeFee(ethereumERC20.address, ethereumAmount, user.address, false, adapterParams)
            await ethereumBridge.connect(user).bridge(ethereumERC20.address, ethereumAmount, user.address, callParams, adapterParams, { value: fee.nativeFee })
        })

        it("locks original tokens", async () => {
            expect(await ethereumBridge.totalValueLocked(ethereumERC20.address)).to.be.eq(ethereumAmount)
            expect(await ethereumERC20.balanceOf(ethereumBridge.address)).to.be.eq(ethereumAmount)
        })

        it("mints wrapped tokens", async () => {
            expect(await wrappedToken.totalSupply()).to.be.eq(ethereumAmount)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(ethereumAmount)
            expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, ethereumERC20.address)).to.be.eq(ethereumAmount)
        })

        describe("bridge 5 ERC20 tokens from Polygon", function () {
            beforeEach(async () => {
                await polygonBridge.registerToken(polygonERC20.address)
                await wrappedTokenBridge.registerToken(wrappedToken.address, polygonChainId, polygonERC20.address)

                await polygonERC20.connect(user).approve(polygonBridge.address, polygonAmount)
                const fee = await polygonBridge.estimateBridgeFee(polygonERC20.address, polygonAmount, user.address, false, adapterParams)
                await polygonBridge.connect(user).bridge(polygonERC20.address, polygonAmount, user.address, callParams, adapterParams, { value: fee.nativeFee })
            })

            it("locks original tokens", async () => {
                expect(await polygonBridge.totalValueLocked(polygonERC20.address)).to.be.eq(polygonAmount)
                expect(await polygonERC20.balanceOf(polygonBridge.address)).to.be.eq(polygonAmount)
            })

            it("mints wrapped tokens", async () => {
                const totalAmount = ethereumAmount.add(polygonAmount)
                expect(await wrappedToken.totalSupply()).to.be.eq(totalAmount)
                expect(await wrappedToken.balanceOf(user.address)).to.be.eq(totalAmount)
                expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, ethereumERC20.address)).to.be.eq(ethereumAmount)
                expect(await wrappedTokenBridge.totalValueLocked(polygonChainId, polygonERC20.address)).to.be.eq(polygonAmount)
            })

            it("reverts when trying to bridge 6 wrapped tokens to Polygon", async () => {
                const amount = polygonAmount.add(utils.parseEther("1"))
                const fee = await wrappedTokenBridge.estimateBridgeFee(wrappedToken.address, polygonChainId, amount, user.address, false, false, adapterParams)

                it("reverts when called by non owner", async () => {
                    await expect(wrappedTokenBridge.connect(user).bridge(wrappedToken.address, polygonChainId, amount, user.address, false, callParams, adapterParams, { value: fee.nativeFee })).to.be.revertedWith("WrappedTokenBridge: insufficient liquidity on the destination")
                })
            })

            describe("bridge 10 wrapped ERC20 tokens to Ethereum", function () {
                beforeEach(async () => {
                    const fee = await wrappedTokenBridge.estimateBridgeFee(wrappedToken.address, ethereumChainId, ethereumAmount, user.address, false, false, adapterParams)
                    await wrappedTokenBridge.connect(user).bridge(wrappedToken.address, ethereumChainId, ethereumAmount, user.address, false, callParams, adapterParams, { value: fee.nativeFee })
                })

                it("burns wrapped tokens", async () => {
                    expect(await wrappedToken.totalSupply()).to.be.eq(polygonAmount)
                    expect(await wrappedToken.balanceOf(user.address)).to.be.eq(polygonAmount)
                    expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, ethereumERC20.address)).to.be.eq(0)
                })

                it("unlocks original tokens", async () => {
                    expect(await ethereumBridge.totalValueLocked(ethereumERC20.address)).to.be.eq(0)
                    expect(await ethereumERC20.balanceOf(ethereumBridge.address)).to.be.eq(0)
                    expect(await ethereumERC20.balanceOf(user.address)).to.be.eq(ethereumAmount)
                })

                describe("bridge 5 wrapped ERC20 tokens to Polygon", function () {
                    beforeEach(async () => {
                        const fee = await wrappedTokenBridge.estimateBridgeFee(wrappedToken.address, polygonChainId, polygonAmount, user.address, false, false, adapterParams)
                        await wrappedTokenBridge.connect(user).bridge(wrappedToken.address, polygonChainId, polygonAmount, user.address, false, callParams, adapterParams, { value: fee.nativeFee })
                    })

                    it("burns wrapped tokens", async () => {
                        expect(await wrappedToken.totalSupply()).to.be.eq(0)
                        expect(await wrappedToken.balanceOf(user.address)).to.be.eq(0)
                        expect(await wrappedTokenBridge.totalValueLocked(polygonChainId, polygonERC20.address)).to.be.eq(0)
                    })

                    it("unlocks original tokens", async () => {
                        expect(await polygonBridge.totalValueLocked(polygonERC20.address)).to.be.eq(0)
                        expect(await polygonERC20.balanceOf(polygonBridge.address)).to.be.eq(0)
                        expect(await polygonERC20.balanceOf(user.address)).to.be.eq(polygonAmount)
                    })
                })
            })
        })
    })

    describe("bridge ETH from Ethereum", function () {
        beforeEach(async () => {
            await ethereumBridge.registerToken(weth.address)
            await wrappedTokenBridge.registerToken(wrappedToken.address, ethereumChainId, weth.address)

            const fee = await ethereumBridge.estimateBridgeETHFee(ethereumAmount, user.address, false, adapterParams)
            await ethereumBridge.connect(user).bridgeETH(ethereumAmount, user.address, callParams, adapterParams, { value: ethereumAmount.add(fee.nativeFee) })
        })

        it("locks WETH", async () => {
            expect(await ethereumBridge.totalValueLocked(weth.address)).to.be.eq(ethereumAmount)
            expect(await weth.balanceOf(ethereumBridge.address)).to.be.eq(ethereumAmount)
        })

        it("mints wrapped tokens", async () => {
            expect(await wrappedToken.totalSupply()).to.be.eq(ethereumAmount)
            expect(await wrappedToken.balanceOf(user.address)).to.be.eq(ethereumAmount)
            expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, weth.address)).to.be.eq(ethereumAmount)
        })

        describe("bridge wrapped WETH token to Ethereum", function () {
            let recipientBalanceBefore
            const unwrap = true
            const toNumber = (bigNumber) => parseFloat(utils.formatEther(bigNumber.toString()))

            beforeEach(async () => {
                recipientBalanceBefore = toNumber(await ethers.provider.getBalance(user.address))
                const fee = await wrappedTokenBridge.estimateBridgeFee(wrappedToken.address, ethereumChainId, ethereumAmount, user.address, unwrap, false, adapterParams)
                await wrappedTokenBridge.connect(user).bridge(wrappedToken.address, ethereumChainId, ethereumAmount, user.address, unwrap, callParams, adapterParams, { value: fee.nativeFee })
            })

            it("burns wrapped tokens", async () => {
                expect(await wrappedToken.totalSupply()).to.be.eq(0)
                expect(await wrappedToken.balanceOf(user.address)).to.be.eq(0)
                expect(await wrappedTokenBridge.totalValueLocked(ethereumChainId, weth.address)).to.be.eq(0)
            })

            it("unlocks ETH", async () => {
                expect(await ethereumBridge.totalValueLocked(weth.address)).to.be.eq(0)
                expect(await weth.balanceOf(ethereumBridge.address)).to.be.eq(0)
                expect(await weth.balanceOf(user.address)).to.be.eq(0)
                expect(toNumber(await ethers.provider.getBalance(user.address))).to.be.gt(recipientBalanceBefore)
            })
        })
    })
})