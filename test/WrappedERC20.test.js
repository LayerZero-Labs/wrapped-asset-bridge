const { expect } = require("chai")
const { ethers } = require("hardhat")
const { parseEther, ZeroAddress } = require("ethers")

describe("WrappedERC20", () => {
    const name = "WTEST"
    const symbol = "WTEST"
    const decimals = 18
    const amount = parseEther("10")

    let owner, bridge
    let wrappedToken
    let wrappedTokenFactory

    beforeEach(async () => {
        ;[owner, bridge] = await ethers.getSigners()

        wrappedTokenFactory = await ethers.getContractFactory("WrappedERC20")
        wrappedToken = await wrappedTokenFactory.deploy(bridge.address, name, symbol, decimals)
    })

    it("reverts when passing address zero in the constructor", async () => {
        await expect(wrappedTokenFactory.deploy(ZeroAddress, name, symbol, decimals)).to.be.revertedWith("WrappedERC20: invalid bridge")
    })

    it("overrides the default ERC20 number of decimals with the one passed in the constructor", async () => {
        const customDecimals = 6
        wrappedToken = await wrappedTokenFactory.deploy(bridge.address, name, symbol, customDecimals)
        expect(await wrappedToken.decimals()).to.be.eq(customDecimals)
    })

    describe("mint", () => {
        it("reverts when called not by the bridge", async () => {
            await expect(wrappedToken.mint(owner.address, amount)).to.be.revertedWith("WrappedERC20: caller is not the bridge")
        })

        it("mints wrapped tokens", async () => {
            await wrappedToken.connect(bridge).mint(owner.address, amount)
            expect(await wrappedToken.totalSupply()).to.be.eq(amount)
            expect(await wrappedToken.balanceOf(owner.address)).to.be.eq(amount)
        })
    })

    describe("burn", () => {
        beforeEach(async () => {
            await wrappedToken.connect(bridge).mint(owner.address, amount)
        })

        it("reverts when called not by the bridge", async () => {
            await expect(wrappedToken.burn(owner.address, amount)).to.be.revertedWith("WrappedERC20: caller is not the bridge")
        })

        it("burns wrapped tokens", async () => {
            await wrappedToken.connect(bridge).burn(owner.address, amount)
            expect(await wrappedToken.totalSupply()).to.be.eq(0)
            expect(await wrappedToken.balanceOf(owner.address)).to.be.eq(0)
        })
    })
})
