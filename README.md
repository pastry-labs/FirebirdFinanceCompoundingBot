# Firebird 🐦 Finance 💸 Compounding 🚜 Bot 🤖
https://firebird.finance

Just a general purpose farm-then-compound-reward bot for pool 1 (HOPE/WETH).

This script assumes you already have token spending approvals for HOPE and WETH on Firebird Swap V1 & LP token approval for farms

Firebird Pool 1 (HOPE/WETH): https://app.firebird.finance/farm/0xE9a8b6ea3e7431E6BefCa51258CB472Df2Dd21d4/1

## Installation

Use the package manager [npm](https://www.npmjs.com/get-npm) to install this bot's dependencies using the following command.

```bash
 npm install
```

## Usage

Modify the [config.json](../main/config.json) with your wallet address and private key.
Optionally, change the harvestThreshold based on how often you want to dump rewards.
slipTolerance is set to 1.0% and thresholds are in quantity of HOPE tokens
```json
"privateKey": "NOT_YOUR_MNEMONIC_PHRASE",
"userAddress": "YOUR_WALLET_ADDRESS",
"harvestThreshold": 2,
"liquidityProvideThreshold": 2,
"tradeThreshold": 2,
"slipTolerance": "100",
```

**I would advise using a seperate wallet for bot this unless you trust me with your funds ❤️🎂**

Start the farming script
```bash
 npm start
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT LICENSE](../master/LICENSE)
