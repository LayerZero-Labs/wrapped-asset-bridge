task("deployBridges", "deploys OriginalTokenBridge to multiple networks and WrappedTokenBridge to a wrapped token chain", require("./deployBridges"))
	.addParam("originalNetworks", "comma separated list of networks where OriginalTokenBridge contract is deployed")
	.addParam("wrappedNetwork", "name of the network where WrappedTokenBridge is deployed")	
// npx hardhat deployBridges --original-networks "goerli,bsc-testnet,mumbai" --wrapped-network "coredao-testnet"
// npx hardhat deployBridges --original-networks "ethereum,bsc,polygon" --wrapped-network "coredao"

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
 // npx hardhat registerTokens --original-networks "goerli,bsc-testnet,mumbai" --wrapped-network "coredao-testnet" --tokens "WETH,USDC"

task("lockAndMint", "bridges original token to wrapped network", require("./lockAndMint"))
	.addParam("amount", "amount to bridge")
	.addParam("token", "token address")
	.addParam("decimals", "token decimals")
// npx hardhat lockAndMint --amount "1" --token "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" --decimals 6 --network "bsc"

task("burnAndUnlock", "bridges wrapped token to original network", require("./burnAndUnlock"))
	.addParam("originalNetwork", "name of the network where OriginalTokenBridge is deployed")
	.addParam("amount", "amount to bridge")
	.addParam("token", "token address")
	.addParam("decimals", "token decimals")
// npx hardhat burnAndUnlock --amount "1" --original-network "bsc" --token "0xa4151B2B3e269645181dCcF2D426cE75fcbDeca9" --decimals 6 --network "coredao"

task("lockAndMintETH", "bridges original token to wrapped network", require("./lockAndMintETH"))
	.addParam("amount", "amount to bridge")
// npx hardhat lockAndMintETH --amount "0.001" --network "goerli"

task("burnAndUnlockETH", "bridges wrapped token to original network", require("./burnAndUnlockETH"))
	.addParam("originalNetwork", "name of the network where OriginalTokenBridge is deployed")
	.addParam("amount", "amount to bridge")
// npx hardhat burnAndUnlockETH --amount "0.001" --original-network "goerli" --network "coredao-testnet"

task("transferOwnership", "transfers bridges ownership", require("./transferOwnership"))
	.addParam("originalNetworks", "comma separated list of networks where original tokens are deployed")
	.addParam("wrappedNetwork", "name of the network where wrapped tokens are deployed")
	.addParam("newOwner", "new owner")
// npx hardhat transferOwnership --new-owner "0x1b2B4F723e1579db0981d826017E3eaeb77Bb493" --original-networks "goerli,bsc-testnet,mumbai" --wrapped-network "coredao-testnet"

task("verifyContract", "verifies a deployed contract", require("./verifyContract"))
	.addParam("contract", "contract name")
// npx hardhat verifyContract --contract "OriginalTokenBridge" --network "ethereum"