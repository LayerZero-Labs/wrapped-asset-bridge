task("deployBridges", "deploys OriginalTokenBridge to multiple networks and WrappedTokenBridge to a wrapped token chain", require("./deployBridges"))
	.addParam("originalNetworks", "comma separated list of networks where OriginalTokenBridge contract is deployed")
	.addParam("wrappedNetwork", "name of the network where WrappedTokenBridge is deployed")	
// npx hardhat deployBridges --original-networks "goerli,bsc-testnet,mumbai" --wrapped-network "coredao-testnet"

task("deployMockTokens", "deploys Mock tokens to multiple networks", require("./deployMockTokens"))
	.addParam("originalNetworks", "comma separated list of networks where mock tokens contract is deployed")
// npx hardhat deployTestTokens --original-networks "goerli,bsc-testnet,mumbai"

task("setTrustedRemote", "calls setTrustedRemoteAddress in OriginalTokenBridge on multiple networks and in WrappedTokenBridge on a wrapped token chain", require("./setTrustedRemote"))
	.addParam("originalNetworks", "comma separated list of networks where OriginalTokenBridge contract is deployed")
	.addParam("wrappedNetwork", "name of the network where WrappedTokenBridge is deployed")
// npx hardhat setTrustedRemote --original-networks "goerli,bsc-testnet,mumbai" --wrapped-network "coredao-testnet"

task("registerToken", "calls registerToken in OriginalTokenBridge and WrappedTokenBridge", require("./registerToken"))
	.addParam("originalNetwork", "name of the network where OriginalTokenBridge is deployed")
	.addParam("wrappedNetwork", "name of the network where WrappedTokenBridge is deployed")
	.addParam("originalToken", "original token address")
	.addParam("wrappedToken", "wrapped token address")
// npx hardhat registerToken --original-network "goerli" --original-token "0xa684B88A25c4AE95368d7595c9241cE364ed56Db" --wrapped-network "coredao-testnet" --wrapped-token "0x631774c0B3FDB9502b3093a22aD91FA83fEc493e"
// npx hardhat registerToken --original-network "bsc-testnet" --original-token "0x33BbFdBA6edFA6E7ac7cA5cbf8100867e0c570CF" --wrapped-network "coredao-testnet" --wrapped-token "0x631774c0B3FDB9502b3093a22aD91FA83fEc493e"
// npx hardhat registerToken --original-network "mumbai" --original-token "0x7612aE2a34E5A363E137De748801FB4c86499152" --wrapped-network "coredao-testnet" --wrapped-token "0x631774c0B3FDB9502b3093a22aD91FA83fEc493e"

task("registerTokens", "calls registerToken in OriginalTokenBridge and WrappedTokenBridge", require("./registerTokens"))
	.addParam("originalNetworks", "comma separated list of networks where original tokens are deployed")
	.addParam("wrappedNetwork", "name of the network where wrapped tokens are deployed")
	.addParam("tokens", "comma separated list of tokens to register")
 // npx hardhat registerTokens--original - networks "goerli,bsc-testnet,mumbai" --wrapped - network "coredao-testnet" --tokens "WETH,USDC"

task("lockAndMintUSDC", "bridges original token to wrapped network", require("./lockAndMintUSDC"))
	.addParam("amount", "amount to bridge")
// npx hardhat lockAndMintUSDC --amount "0.001" --network "bsc-testnet"

task("burnAndUnlockUSDC", "bridges wrapped token to original network", require("./burnAndUnlockUSDC"))
	.addParam("originalNetwork", "name of the network where OriginalTokenBridge is deployed")
	.addParam("amount", "amount to bridge")
// npx hardhat burnAndUnlockUSDC --amount "0.002" --original-network "bsc-testnet" --network "coredao-testnet"

task("lockAndMintETH", "bridges original token to wrapped network", require("./lockAndMintETH"))
	.addParam("amount", "amount to bridge")
// npx hardhat testLockAndMintETH --amount "0.001" --network "goerli"

task("burnAndUnlockETH", "bridges wrapped token to original network", require("./burnAndUnlockETH"))
	.addParam("originalNetwork", "name of the network where OriginalTokenBridge is deployed")
	.addParam("amount", "amount to bridge")
// npx hardhat burnAndUnlockETH --amount "0.001" --original-network "goerli" --network "coredao-testnet"