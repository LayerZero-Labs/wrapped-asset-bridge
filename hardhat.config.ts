import { HardhatUserConfig } from "hardhat/config"

import * as dotenv from "dotenv"
dotenv.config()

import "@matterlabs/hardhat-zksync-solc"
import "@matterlabs/hardhat-zksync-verify"
import "@nomiclabs/hardhat-waffle"
import "@openzeppelin/hardhat-upgrades"
import "hardhat-contract-sizer"
import "hardhat-deploy"
import "hardhat-deploy-ethers"
import "hardhat-gas-reporter"
import "solidity-coverage"
import "./tasks/index"

// Libraries
import assert from "assert"

// @dev Put this in .env
const ALCHEMY_ID = process.env.ALCHEMY_ID
assert.ok(ALCHEMY_ID, "no Alchemy ID in process.env")
const INFURA_ID = process.env.INFURA_ID
assert.ok(INFURA_ID, "no Infura ID in process.env")
const DEPLOYER_PK = process.env.DEPLOYER_PK
assert.ok(INFURA_ID, "no Deployer PK in process.env")

const config: HardhatUserConfig = {
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },

    networks: {
        hardhat: {
            // Standard config
            // timeout: 150000,
            forking: {
                url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
                blockNumber: 18000000,
            },
        },

        // Local
        zksyncLocal: {
            url: "http://localhost:3050",
            zksync: true,
            accounts: [
                "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110", //0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
                "0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3", //0xa61464658AfeAf65CccaaFD3a512b69A83B77618
            ],
        },

        // Prod
        arbitrum: {
            url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}`,
            chainId: 42161,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        avalanche: {
            url: "https://api.avax.network/ext/bc/C/rpc",
            chainId: 43114,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        base: {
            url: `https://mainnet.base.org`,
            chainId: 8453,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        bsc: {
            url: "https://bsc-dataseed.binance.org/",
            chainId: 56,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        fantom: {
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
            chainId: 250,
            url: `https://rpcapi.fantom.network/`,
        },
        gnosis: {
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
            chainId: 100,
            url: `https://gnosis-mainnet.public.blastapi.io`,
        },
        linea: {
            url: `https://linea-mainnet.infura.io/v3/${INFURA_ID}`,
            chainId: 59144,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        mainnet: {
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
            chainId: 1,
            url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
        },
        optimism: {
            url: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}`,
            chainId: 10,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        polygon: {
            url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}`,
            chainId: 137,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        polygonzk: {
            url: "https://zkevm-rpc.com",
            chainId: 1101,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        zksync: {
            zksync: true,
            url: "https://mainnet.era.zksync.io",
            chainId: 324,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
            verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
        },

        // Staging
        arbgoerli: {
            url: "https://goerli-rollup.arbitrum.io/rpc",
            chainId: 421613,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        arbsepolia: {
            url: `https://sepolia-rollup.arbitrum.io/rpc`,
            chainId: 421614,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        basesepolia: {
            url: `https://sepolia.base.org`,
            chainId: 84532,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        baseGoerli: {
            url: "https://goerli.base.org",
            chainId: 84531,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        gelopcelestiatestnet: {
            url: `https://rpc.op-celestia-testnet.gelato.digital`,
            chainId: 123420111,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        geloptestnet: {
            url: `https://rpc.op-testnet.gelato.digital`,
            chainId: 42069,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        goerli: {
            url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_ID}`,
            chainId: 5,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        mumbai: {
            url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_ID}`,
            chainId: 80001,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        ogoerli: {
            url: `https://opt-goerli.g.alchemy.com/v2/${ALCHEMY_ID}`,
            chainId: 420,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        osepolia: {
            url: `https://sepolia.optimism.io`,
            chainId: 11155420,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        sepolia: {
            url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_ID}`,
            chainId: 11155111,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        unreal: {
            url: `https://rpc.unreal.gelato.digital`,
            chainId: 18231,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
        zkatana: {
            url: "https://rpc.zkatana.gelato.digital",
            chainId: 1261120,
            accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
        },
    },

    solidity: {
        compilers: [
            {
                version: "0.8.17",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },

    contractSizer: {
        alphaSort: false,
        runOnCompile: true,
        disambiguatePaths: false,
    },
}

export default config
