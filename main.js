const config = require("./config.json");
const networkId = config.networkId;
const networkRPC = config.networkRPC;
const networkName = config.networkName;
const privateKey = config.privateKey;
const harvestThreshold = config.harvestThreshold;
const liquidityProvideThreshold = config.liquidityProvideThreshold;
const tradeThreshold = config.tradeThreshold;
const slipTolerance = config.slipTolerance;
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3');
const provider = new HDWalletProvider(privateKey, networkRPC, 0, 2);
const web3 = new Web3(provider);
const user_address = web3.utils.toChecksumAddress(config.userAddress);
const referralAddress = web3.utils.toChecksumAddress(config.referralAddress);
const FirebirdLPPairAddress = web3.utils.toChecksumAddress(config.firebirdLPPairAddress);
const wrappedETHAddress = web3.utils.toChecksumAddress( config.wrappedETHTokenAddress );
const FirebirdRouterAddress = web3.utils.toChecksumAddress(config.firebirdRouterAddress);
const HopeTokenAddress = web3.utils.toChecksumAddress(config.hopeTokenAddress);
const HOPEChefAddress = web3.utils.toChecksumAddress(config.hopeChefAddress);
const ValueToHopeLockerAddress = web3.utils.toChecksumAddress(config.valueToHopeLockerAddress);
const fs = require('fs');
const { ethers } = require("ethers");

const getCreate2Address = require('@ethersproject/address').getCreate2Address;
const keccak256 = require('@ethersproject/solidity').keccak256;
const pack = require('@ethersproject/solidity').pack;

const { Percent, ChainId, WETH, Route, Trade, Token, TokenAmount, TradeType } = require ('./firebird-matic-sdk/dist');
const FirebirdFetcher = require ('./firebird-matic-sdk/dist').Fetcher;
const SushiSwapRoute = require('./sushiswap-sdk/dist').Route;
const SushiFetcher = require('./sushiswap-sdk/dist').Fetcher;
const SushiSwapTrade = require('./sushiswap-sdk/dist').Trade;

const BigNumber = require('bignumber.js');
const providers = require('@ethersproject/providers');

const ValueToHopeLockerABI = require('./abis/ValueToHopeLocker.json') //Claim HOPE
const HOPEChefABI = require('./abis/HOPEChef.json'); //Harvest pool, Deposit/Withdrawl HOPE FLP
const FirebirdLPABI = require('./abis/FirebirdLP.json'); //FLP
const FirebirdRouterABI = require('./abis/FireBirdRouter.json'); //Firebird Router
const HOPETokenABI = require('./abis/HOPEToken.json'); //HOPE token
const wrappedETHABI = require('./abis/wrappedETHABI.json');
const coinPriceUrl = `https://api.firebird.finance/api/coin-stat/hope`
const coinPriceUrlTwo = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`

var localProvider = new providers.JsonRpcProvider(networkRPC);
var request = require("request-promise");
var Promise = require("bluebird");
var lastCoinPrice = 0;
var lastCoinPriceTwo = 0;
var coinName = "HOPE";

function getFirebirdSwapOutputPrice( amountIn, path ) {
	const firebirdRouterContract = new web3.eth.Contract(
		FirebirdRouterABI,
		FirebirdRouterAddress
	);
		
	return firebirdRouterContract.methods.getAmountsOut( BigNumber( amountIn ), path ).call();
}

function getFirebirdPairReservesData( tokenA, tokenB ) {
	return FirebirdFetcher.fetchPairData( tokenA, tokenB, localProvider)
		.then( (firebirdPair) => {
			return firebirdPair;
		}).catch(err => {
			console.log("err", err)
			throw err;
		})
}


function getSushiPairReservesData( tokenOne, tokenTwo ) {
	return SushiFetcher.fetchPairData( tokenOne, tokenTwo, localProvider)
	.then( (sushiPair) => {
			return sushiPair;
		})
}


function refreshStatus() {
	console.log("Note: This bot only compounds pool 1 (HOPE/WETH) and harvests rewards from ALL active pools")
	console.log("-".repeat(45));
	
	//depositWithRef, withdraw, and harvestAllRewards
	const HOPEChefContract = new web3.eth.Contract(
		HOPEChefABI,
		HOPEChefAddress
	);
	
	//balanceOf()
	const HOPETokenContract = new web3.eth.Contract(
		HOPETokenABI,
		HopeTokenAddress
	)
	
	const wrappedETHContract = new web3.eth.Contract(
		wrappedETHABI,
		wrappedETHAddress
	)
	
	//claimUnlocked() & canUnlockAmount()
	const ValueToHopeLockerContract = new web3.eth.Contract(
		ValueToHopeLockerABI,
		ValueToHopeLockerAddress
	);

	const activePools = config.activePools;
	
	//Fetch the latest price of the HOPE token
	return request.get({ url: coinPriceUrl, json: true })
		.then( priceData => {
			var price = priceData.data.polygon.price;
			//console.log("HOPE", price)
			lastCoinPrice = price;
			//Fetch the latest price of the HOPE token
			return request.get({ url: coinPriceUrlTwo, json: true })
		})
		.then( priceData => {
			var price = priceData['ethereum'].usd;
			//console.log("ethereum", price)
			lastCoinPriceTwo = price;
			return lastCoinPriceTwo;
		})
		.then( () => {
			//Harvest any vested HOPE rewards from the ValueToHopeLockerContract
			return ValueToHopeLockerContract.methods.canUnlockAmount( user_address ).call()
				.then( claimableHOPE => {
					var CLAIMABLE_HOPE = BigNumber(claimableHOPE).dividedBy(1e18).toFixed(3);
					var CLAIMABLE_HOPE_USD = parseFloat(parseFloat(BigNumber(claimableHOPE).dividedBy(1e18).toFixed(3)) * lastCoinPrice).toFixed(3);
					CLAIMABLE_HOPE_USD = parseFloat( CLAIMABLE_HOPE_USD )
					console.log(`[Farmer] Locker has ${CLAIMABLE_HOPE} HOPE claimable ($${ CLAIMABLE_HOPE_USD })`)
					if(CLAIMABLE_HOPE >= harvestThreshold) {
						console.log("[Harvester] Harvesting HOPE from Locker Contract...")
						return harvestHOPELocker( ValueToHopeLockerContract )
					} else {
						return Promise.try(() => true)
					}
				})
		})
		.then( () => {
			//Harvest all active farming pools
			return Promise.each(activePools, function( poolId ){
				return HOPEChefContract.methods.pendingReward( poolId, user_address ).call()
				.then( claimableHOPE => {
					var CLAIMABLE_HOPE = BigNumber(claimableHOPE).dividedBy(1e18).toFixed(3);
					var CLAIMABLE_HOPE_USD = parseFloat(parseFloat(BigNumber(claimableHOPE).dividedBy(1e18).toFixed(3)) * lastCoinPrice).toFixed(3);
					CLAIMABLE_HOPE_USD = parseFloat( CLAIMABLE_HOPE_USD )
					console.log(`[Farmer] Pool ${poolId} has ${CLAIMABLE_HOPE} HOPE claimable ($${ CLAIMABLE_HOPE_USD })`)
					if(CLAIMABLE_HOPE >= harvestThreshold) {
						console.log(`[Harvester] Harvesting HOPE from pool ${poolId}...`)
						return harvestHOPEFarmingPool( poolId, HOPEChefContract )
					} else {
						return Promise.try(() => true)
					}
				})
			})
		})
		.then( () => {
			//Check how much HOPE we have from harvests
			//See if we can trade away half our balance.
			return HOPETokenContract.methods.balanceOf( user_address ).call()
				.then( balanceData => {
					var overrideBalance = BigNumber(balanceData).toFixed();
					var HOPEWalletBalanceUSD = BigNumber(overrideBalance).dividedBy(1e18).multipliedBy( lastCoinPrice ).toFixed(3);
					//console.log(`${BigNumber(overrideBalance).dividedBy(1e18).toFixed(3)} HOPE ($${HOPEWalletBalanceUSD})`)
					if(overrideBalance != 0) {
						var newBalanceData = BigNumber(overrideBalance).dividedBy( 2 )
						var newHOPEWalletBalanceUSD = BigNumber(newBalanceData).dividedBy(1e18).multipliedBy( lastCoinPrice ).toFixed(3);
						//console.log(`${BigNumber(newBalanceData).dividedBy(1e18).toFixed(3)} HOPE ($${newHOPEWalletBalanceUSD} - ${BigNumber(newBalanceData).dividedBy(1e18).toFixed(3)}) (${BigNumber(newBalanceData).dividedBy(1e18).toFixed(3)}>=${tradeThreshold})`)
						if(BigNumber(newBalanceData).dividedBy(1e18).toFixed(3) >= tradeThreshold) {
							return createFirebirdSwapTrade( newBalanceData )
						}
					}
					
					return Promise.try(() => true);
				})
		})
		.then(() => {
			//Pause for 5 seconds to let matic catchup
			//with its constant chain reorgs and lagging RPCs
			return Promise.delay(5000)
		})
		.then( () => {
			//Check how much HOPE AND WETH we have
			//See if we can add both as liquidity to compound rewards
			return Promise.all([HOPETokenContract.methods.balanceOf( user_address ).call(), wrappedETHContract.methods.balanceOf( user_address ).call()])
				.then( balanceData => {
					var hopeBal = balanceData[0]
					var wethBal = balanceData[1]
					var HOPEWalletBalanceUSD = BigNumber(hopeBal).dividedBy(1e18).multipliedBy( lastCoinPrice ).toFixed(3);
					var wethWalletBalanceUSD = BigNumber(wethBal).dividedBy(1e18).multipliedBy( lastCoinPriceTwo ).toFixed(3);
					console.log("-".repeat(45))
					console.log(`[Trader] Determining if we should trade...`)
					console.log(`[Trader] ${BigNumber(hopeBal).dividedBy(1e18).toFixed(3)} HOPE ($${HOPEWalletBalanceUSD})`)
					console.log(`[Trader] ${BigNumber(wethBal).dividedBy(1e18).toFixed(3)} WETH ($${wethWalletBalanceUSD})`)
					console.log("-".repeat(45));
					if(hopeBal != 0 && wethBal != 0) {
						if(parseFloat(BigNumber(hopeBal).dividedBy(1e18).toFixed(3)) >= liquidityProvideThreshold) {
							return createFirebirdAddLiquidity( hopeBal, wethBal );
						}
					}
					
					return Promise.try(() => true);
				})
		})
		.then( () => {
			return Promise.delay(1000)
				.then(() => {
						const firebirdLPContract = new web3.eth.Contract(
							FirebirdLPABI,
							FirebirdLPPairAddress
						);
							
						return firebirdLPContract.methods.balanceOf(user_address).call();
				})
				.then( (lpBal) => {
					var lpBalance = BigNumber( lpBal ).dividedBy(1e18).toFixed()
					console.log("[Farmer] LP Token Balance: ", lpBalance + " FLP (HOPE/WETH)")
					if(lpBalance > 0) {
						return stakeInHOPEChef( lpBal, HOPEChefContract );
					}
				})
		})
}

function stakeInHOPEChef( lpBalance, HOPEChefContract ) {
	const tx = HOPEChefContract.methods.depositWithRef( 1, lpBalance, referralAddress );
	return tx.estimateGas({from: user_address})
		.then(gas => {
			return web3.eth.getGasPrice()
				.then(gasPrice => {
					const data = tx.encodeABI();
					return web3.eth.getTransactionCount(user_address)
						.then(nonce => {
							const txData = {
								from: user_address,
								to: HOPEChefAddress,
								data: data,
								gas,
								gasPrice: BigNumber(gasPrice).plus(100000000),
								nonce, 
								chainId: networkId
							};


							return web3.eth.sendTransaction(txData)
								.then( receipt => {
									console.log("[Farmer] Success!", `${receipt.transactionHash} - ${receipt.status}`)
								})
						})
				})
		}).catch(err => {
			console.log("[Farmer] Error!")
			console.error(err)
			throw err;
		})

}

function harvestHOPEFarmingPool( poolId, HOPEChefContract ) {
	const tx = HOPEChefContract.methods.withdraw( poolId, 0 );
	return tx.estimateGas({from: user_address})
		.then(gas => {
			return web3.eth.getGasPrice()
				.then(gasPrice => {
					const data = tx.encodeABI();
					return web3.eth.getTransactionCount(user_address)
						.then(nonce => {
							const txData = {
								from: user_address,
								to: HOPEChefAddress,
								data: data,
								gas,
								gasPrice: BigNumber(gasPrice).plus(100000000),
								nonce, 
								chainId: networkId
							};


							return web3.eth.sendTransaction(txData)
								.then( (receipt) => {	
									console.log(`[Harvester] Success!`, `${receipt.transactionHash} - ${receipt.status}`);
								})
						})
				})
		}).catch(err => {
			console.log("[Harvester] Error!")
			console.error(err)
			throw err;
		})
}

function createFirebirdAddLiquidity( amountADesired, amountBDesired ) {
	//console.log(`createFirebirdAddLiquidity( ${amountADesired}, ${amountBDesired} )`)
	var hopeToken = new Token(networkId, HopeTokenAddress, 18, 'HOPE', 'Firebird.Finance (HOPE)');
	var wrappedETH = new Token(networkId, wrappedETHAddress, 18, 'WETH', 'Wrapped Ethereum');
	return getFirebirdPairReservesData( hopeToken, wrappedETH )
		.then( firebirdPair => {
			var firebirdAddLiquidityTransaction = {
				pair: firebirdPair.liquidityToken.address,
				tokenA: hopeToken.address,
				tokenB: wrappedETH.address,
				amountADesired: BigNumber(0),
				amountBDesired: BigNumber(amountBDesired),
				amountAMin: BigNumber(0),
				amountBMin: BigNumber(0),
				to: user_address,
				deadline: null
			};
			
			var slippageTolerance = new Percent('50', '10000') // 0.50%
			var firebirdRoute = new Route([firebirdPair], wrappedETH);
			var firebirdTrade = new Trade(firebirdRoute, new TokenAmount(wrappedETH, firebirdAddLiquidityTransaction.amountBDesired), TradeType.EXACT_INPUT);
			
			//console.log("firebirdTrade.outputAmount.raw", BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).plus( BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).multipliedBy(0.01).toFixed(0) ).toFixed(0))
			firebirdAddLiquidityTransaction.amountADesired = BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).plus( BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).multipliedBy(0.01).toFixed(0) )
			
			//console.log("firebirdTrade.outputAmount.raw.toString()", firebirdTrade.outputAmount.raw.toString())
			//console.log("firebirdTrade.inputAmount.raw.toString()", firebirdTrade.inputAmount.raw.toString())
			firebirdAddLiquidityTransaction.amountAMin = firebirdTrade.minimumAmountOut(slippageTolerance).raw.toString();
			firebirdAddLiquidityTransaction.amountBMin = firebirdTrade.maximumAmountIn(slippageTolerance).raw.toString();
			
			
			
			var testOne = BigNumber(firebirdAddLiquidityTransaction.amountADesired).dividedBy(1e18).toFixed();
			var testTwo = BigNumber(amountADesired).dividedBy(1e18).toFixed()

			if(testOne >= testTwo) {
				//throw new Error('LOW_HOPE_BALANCE')
				//Try going the other way
				firebirdRoute = new Route([firebirdPair], hopeToken);
				firebirdTrade = new Trade(firebirdRoute, new TokenAmount(hopeToken, amountADesired), TradeType.EXACT_INPUT);
				//console.log("firebirdTrade.outputAmount.raw", BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).plus( BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).multipliedBy(0.01).toFixed(0) ).toFixed(0))
				//console.log("firebirdTrade.inputAmount.raw", BigNumber( `${firebirdTrade.inputAmount.raw.toString()}` ).plus( BigNumber( `${firebirdTrade.inputAmount.raw.toString()}` ).multipliedBy(0.01).toFixed(0) ).toFixed(0))
				
				firebirdAddLiquidityTransaction.amountADesired = BigNumber( `${firebirdTrade.inputAmount.raw.toString()}` ).toFixed(0)
				firebirdAddLiquidityTransaction.amountBDesired = BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).plus( BigNumber( `${firebirdTrade.outputAmount.raw.toString()}` ).multipliedBy(0.01).toFixed(0) )
				
				
				firebirdAddLiquidityTransaction.amountAMin = firebirdTrade.maximumAmountIn(slippageTolerance).raw.toString();
				firebirdAddLiquidityTransaction.amountBMin = firebirdTrade.minimumAmountOut(slippageTolerance).raw.toString();

				//var priceInUSD = parseFloat( parseFloat(firebirdAddLiquidityTransaction.amountBDesired) / 1e18 ).toFixed(2);
				//priceInUSD = parseFloat( lastCoinPrice ) * priceInUSD;
				
				console.log(`[Liquidity Provider][BEST] ${BigNumber(firebirdAddLiquidityTransaction.amountADesired).dividedBy(1e18)} HOPE + ${BigNumber(firebirdAddLiquidityTransaction.amountBDesired).dividedBy(1e18)} WETH`)
				console.log(`[Liquidity Provider][WORST] ${BigNumber(firebirdAddLiquidityTransaction.amountAMin).dividedBy(1e18)} HOPE + ${BigNumber(firebirdAddLiquidityTransaction.amountBMin).dividedBy(1e18)} WETH`)
				return sendFirebirdAddLiquidity( firebirdAddLiquidityTransaction )			

				
			} else {
				firebirdAddLiquidityTransaction.amountAMin = firebirdTrade.minimumAmountOut(slippageTolerance).raw.toString();
				firebirdAddLiquidityTransaction.amountBMin = firebirdTrade.maximumAmountIn(slippageTolerance).raw.toString();

				//var priceInUSD = parseFloat( parseFloat(firebirdAddLiquidityTransaction.amountBDesired) / 1e18 ).toFixed(2);
				//priceInUSD = parseFloat( lastCoinPrice ) * priceInUSD;
				
				console.log(`[Liquidity Provider][BEST] ${BigNumber(firebirdAddLiquidityTransaction.amountADesired).dividedBy(1e18)} HOPE + ${BigNumber(firebirdAddLiquidityTransaction.amountBDesired).dividedBy(1e18)} WETH`)
				console.log(`[Liquidity Provider][WORST] ${BigNumber(firebirdAddLiquidityTransaction.amountAMin).dividedBy(1e18)} HOPE + ${BigNumber(firebirdAddLiquidityTransaction.amountBMin).dividedBy(1e18)} WETH`)
				return sendFirebirdAddLiquidity( firebirdAddLiquidityTransaction )			
			}
		})
}

function sendFirebirdAddLiquidity( firebirdAddLiquidityTransaction ) {
	const firebirdRouterContract = new web3.eth.Contract(
		FirebirdRouterABI,
		FirebirdRouterAddress
	);

	//sell HOPE for WMATIC (filling in HOPE form)
	//swapExactTokensForETH: tokenIn, amountIn, amountOutMin, path, to, deadline
	//0xd78c475133731cd54dadcb430f7aae4f03c1e660, 0, 0, [0x5e9cd0861f927adeccfeb2c0124879b277dd66ac], config.user_address, 0
	
	///sell HOPE for WETH
	///swapTokensForExactTokens: tokenIn, tokenOut, amountOutMin, amountInMax, path, to, deadline
	///0xd78c475133731cd54dadcb430f7aae4f03c1e660 (HOPE), 0x7ceb23fd6bc0add59e62ac25578270cff1b9f619 (WETH), 0, 0, [0x5e9cd0861f927adeccfeb2c0124879b277dd66ac (HOPE/WMATIC), c4e595acdd7d12fec385e5da5d43160e8a0bac0e (WMATIC/WETH)], config.user_address, 0 
	
	//sell HOPE for WETH (exact)
	//swapExactTokensForTokens: amountIn, amountOutMin, path, to, deadline
	//0xd78c475133731cd54dadcb430f7aae4f03c1e660 (HOPE), 0xc2132d05d31c914a87c6611c10748aeb04b58e8f ((PoS) Tether USD (USDT)), [0xdd600f769a6bfe5dac39f5da23c18433e6d92cba(HOPE/WETH), 0xc2755915a85c6f6c1c0f3a86ac8c058f11caa9c9 (WETH/USDT)], config.user_address, 0
	
	//sell WMATIC for HOPE
	//swapExactETHForTokens: tokenOut, amountOutMin, path, to, deadline
	//0xd78c475133731cd54dadcb430f7aae4f03c1e660 (HOPE), 0, [], config.user_address, 0
	//		firebirdRouterContract.methods.getAmountsOut( BigNumber( amountIn ), path ).call();
	
	return web3.eth.getBlockNumber()
		.then( blockNumber => {
			return web3.eth.getBlock(blockNumber);
		})
		.then( blockData => {
			
			if(blockData == null) {
				console.log("blockData", blockData)
				throw new Error("null response")
			}
			
			firebirdAddLiquidityTransaction.deadline = blockData.timestamp + 1200;
			//console.log("firebirdAddLiquidityTransaction.tokenOut", firebirdAddLiquidityTransaction.tokenOut.address)
			const tx = firebirdRouterContract.methods.addLiquidity(
				firebirdAddLiquidityTransaction.pair,
				firebirdAddLiquidityTransaction.tokenA,
				firebirdAddLiquidityTransaction.tokenB,
				firebirdAddLiquidityTransaction.amountADesired,
				firebirdAddLiquidityTransaction.amountBDesired,
				firebirdAddLiquidityTransaction.amountAMin,
				firebirdAddLiquidityTransaction.amountBMin,
				firebirdAddLiquidityTransaction.to,
				blockData.timestamp + 1200
			);

			return tx.estimateGas({from: user_address})
				.then(gas => {
					//console.log("gasPrice",gas)
					return web3.eth.getGasPrice()
						.then(gasPrice => {
							//console.log("gasPrice",BigNumber(gasPrice).plus(1))
							const data = tx.encodeABI();
							return web3.eth.getTransactionCount(user_address)
								.then(nonce => {
									//console.log("nonce", nonce)
									const txData = {
										from: user_address,
										to: FirebirdRouterAddress,
										data: data,
										gas,
										gasPrice: BigNumber(gasPrice).plus(100000000),
										nonce, 
										chainId: networkId
									};


									return web3.eth.sendTransaction(txData)
										.then( (receipt) => {	
											console.log(`[Trader] Success!`, `${receipt.transactionHash} - ${receipt.status}`);
										})
								})
						})
				}).catch(err => {
					console.log("[Trader] Error!")
					console.error(err)
					throw err;
				})
			})

}

function createFirebirdSwapTrade( amountInMax ) {
	//console.log("createFirebirdSwapTrade", amountInMax)
	var wmatic = new Token( networkId, '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', 18, 'WMATIC', 'WMATIC' )
	var hopeToken = new Token(networkId, HopeTokenAddress, 18, 'HOPE', 'Firebird.Finance (HOPE)');
	var wrappedETH = new Token(networkId, wrappedETHAddress, 18, 'WETH', 'Wrapped Ethereum');
	return Promise.all([getFirebirdPairReservesData( hopeToken, wmatic ), getSushiPairReservesData( wmatic, wrappedETH )])
		.then( pairData => {
			if(pairData.length != 2) {
				throw new Error("Pair lookup failed!")
			}
			var firebirdPair = pairData[0];
			var sushiSwapPair = pairData[1];
			var firebirdSwapTransaction = {
				tokenIn: hopeToken,
				tokenOut: wrappedETH,
				amountOut: null,
				amountInMax: BigNumber(amountInMax).toFixed(0),
				path: [
					firebirdPair.liquidityToken.address,
					sushiSwapPair.liquidityToken.address
				],
				to: user_address,
				deadline: null
			};
			
			var slippageTolerance = new Percent(slipTolerance, '10000'); // 3.0%
			
			var firebirdRoute = new Route([firebirdPair, sushiSwapPair], hopeToken, wrappedETH);
			//var sushiSwapRoute = new SushiSwapRoute([sushiSwapPair], wmatic);
			
			var firebirdTrade = new Trade(firebirdRoute, new TokenAmount(hopeToken, BigNumber(firebirdSwapTransaction.amountInMax).toFixed(0)), TradeType.EXACT_INPUT);
			firebirdSwapTransaction.amountOut = firebirdTrade.minimumAmountOut(slippageTolerance).raw.toString();
			//firebirdSwapTransaction.amountOutMax = firebirdTrade.minimumAmountOut(slippageTolerance).raw.toString();
			
			//var sushiSwapTrade = new SushiSwapTrade(sushiSwapRoute, new TokenAmount(wmatic, BigNumber(firebirdSwapTransaction.amountOutMax).toFixed(0)), TradeType.EXACT_OUTPUT);
			//firebirdSwapTransaction.amountOut = sushiSwapTrade.maximumAmountIn(slippageTolerance).raw.toString();
			
			var priceInUSD = BigNumber(firebirdSwapTransaction.amountOut).dividedBy(1e18).multipliedBy( lastCoinPriceTwo ).toFixed(0)
			
			console.log(`[Trader] ${BigNumber(firebirdSwapTransaction.amountInMax).dividedBy(1e18)} HOPE for ${BigNumber(firebirdSwapTransaction.amountOut).dividedBy(1e18)} WETH ($${ priceInUSD })`)
			
			return sendFirebirdSwapTrade( firebirdSwapTransaction )			
		})
}

function sendFirebirdSwapTrade( firebirdSwapTransaction ) {
	const firebirdRouterContract = new web3.eth.Contract(
		FirebirdRouterABI,
		FirebirdRouterAddress
	);

	//sell HOPE for WMATIC (filling in HOPE form)
	//swapExactTokensForETH: tokenIn, amountIn, amountOutMin, path, to, deadline
	//0xd78c475133731cd54dadcb430f7aae4f03c1e660, 0, 0, [0x5e9cd0861f927adeccfeb2c0124879b277dd66ac], config.user_address, 0
	
	//sell HOPE for WETH
	//swapTokensForExactTokens: tokenIn, tokenOut, amountOutMin, amountInMax, path, to, deadline
	//0xd78c475133731cd54dadcb430f7aae4f03c1e660 (HOPE), 0x7ceb23fd6bc0add59e62ac25578270cff1b9f619 (WETH), 0, 0, [0x5e9cd0861f927adeccfeb2c0124879b277dd66ac (HOPE/WMATIC), c4e595acdd7d12fec385e5da5d43160e8a0bac0e (WMATIC/WETH)], config.user_address, 0 
	
	//sell HOPE for WETH (exact)
	//swapExactTokensForTokens: amountIn, amountOutMin, path, to, deadline
	//0xd78c475133731cd54dadcb430f7aae4f03c1e660 (HOPE), 0xc2132d05d31c914a87c6611c10748aeb04b58e8f ((PoS) Tether USD (USDT)), [0xdd600f769a6bfe5dac39f5da23c18433e6d92cba(HOPE/WETH), 0xc2755915a85c6f6c1c0f3a86ac8c058f11caa9c9 (WETH/USDT)], config.user_address, 0
	
	//sell WMATIC for HOPE
	//swapExactETHForTokens: tokenOut, amountOutMin, path, to, deadline
	//0xd78c475133731cd54dadcb430f7aae4f03c1e660 (HOPE), 0, [], config.user_address, 0
	//		firebirdRouterContract.methods.getAmountsOut( BigNumber( amountIn ), path ).call();
	
	return web3.eth.getBlockNumber()
		.then( blockNumber => {
			return web3.eth.getBlock(blockNumber);
		})
		.then( blockData => {
			firebirdSwapTransaction.deadline = blockData.timestamp + 1200;
			//console.log("firebirdSwapTransaction.tokenOut", firebirdSwapTransaction.tokenOut.address)
			const tx = firebirdRouterContract.methods.swapTokensForExactTokens(
				firebirdSwapTransaction.tokenIn.address,
				firebirdSwapTransaction.tokenOut.address,
				firebirdSwapTransaction.amountOut,
				firebirdSwapTransaction.amountInMax,
				firebirdSwapTransaction.path,
				firebirdSwapTransaction.to,
				firebirdSwapTransaction.deadline
			);
			/*
			console.log({
				0: firebirdSwapTransaction.tokenIn.address,
				1: firebirdSwapTransaction.tokenOut.address,
				2: firebirdSwapTransaction.amountOut,
				3: firebirdSwapTransaction.amountInMax,
				4: firebirdSwapTransaction.path,
				5: firebirdSwapTransaction.to,
				6: firebirdSwapTransaction.deadline
			})
			*/
			return tx.estimateGas({from: user_address})
				.then(gas => {
					//console.log("gasPrice",gas)
					return web3.eth.getGasPrice()
						.then(gasPrice => {
							//console.log("gasPrice",BigNumber(gasPrice).plus(1))
							const data = tx.encodeABI();
							return web3.eth.getTransactionCount(user_address)
								.then(nonce => {
									//console.log("nonce", nonce)
									const txData = {
										from: user_address,
										to: FirebirdRouterAddress,
										data: data,
										gas,
										gasPrice: BigNumber(gasPrice).plus(100000000),
										nonce, 
										chainId: networkId
									};


									return web3.eth.sendTransaction(txData)
										.then( (receipt) => {	
											console.log(`[Trader] Success!`, `${receipt.transactionHash} - ${receipt.status}`);
										})
								})
						})
				}).catch(err => {
					console.log("[Trader] Error!")
					console.error(err)
					throw err;
				})
			})
}

function harvestHOPELocker( ValueToHopeLockerContract ) {
	const tx = ValueToHopeLockerContract.methods.claimUnlocked();
	return tx.estimateGas({from: user_address})
		.then(gas => {
			return web3.eth.getGasPrice()
				.then(gasPrice => {
					const data = tx.encodeABI();
					return web3.eth.getTransactionCount(user_address)
						.then(nonce => {
							const txData = {
								from: user_address,
								to: ValueToHopeLockerAddress,
								data: data,
								gas,
								gasPrice: BigNumber(gasPrice).plus(100000000),
								nonce, 
								chainId: networkId
							};


							return web3.eth.sendTransaction(txData)
								.then( (receipt) => {
									console.log(`[Harvester] Success!`, `${receipt.transactionHash} - ${receipt.status}`);
								})
						})
				})
		}).catch(err => {
			console.log("[Harvester] Error!")
			console.error(err)
			throw err;
		})

}


/*
	For you readers out there
	Firebird's factory code has some special ways
	of generating addresses using that getCreate2Address function
	It uses the following parameters:
		token0
		token1
		pairWeight
		swapFee
	
		getCreate2Address(
			'0x5De74546d3B86C8Df7FEEc30253865e1149818C8',
			keccak256(
				['bytes'],
				[
					pack(
						['address', 'address', 'uint32', 'uint32'], [tokens[0].address, tokens[1].address, '50', '20']
					)
				]
			),
			INIT_CODE_HASH
		)
*/
/*
var tokens = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks
console.log("tokens", tokens)
var INIT_CODE_HASH = "0x585665f39ba6ff2e62371f7788ded6b903667db133ab8153a17136b5033ab330"
var addrOne = getCreate2Address( '0x5De74546d3B86C8Df7FEEc30253865e1149818C8', keccak256(['bytes'], [ pack(['address', 'address', 'uint32', 'uint32'], [tokens[0].address, tokens[1].address, '50', '20']) ]), INIT_CODE_HASH )
console.log("addrOne---" +  addrOne + "---")
var firebirdFactoryAddress = "";

return ethers.getContractAt("Token", firebirdFactoryAddress)
	.then( (data) => {
		console.log("data",data)
		return process.exit(0)
	})
*/

web3.eth.accounts.wallet.add(privateKey);

var intervalCheck = setInterval(refreshStatus, 60000)

refreshStatus()
