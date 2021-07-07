import JSBI from 'jsbi';
export declare type BigintIsh = JSBI | bigint | string;
export declare enum ChainId {
    MAINNET = 1,
    ROPSTEN = 3,
    RINKEBY = 4,
    GÖRLI = 5,
    KOVAN = 42,
    MATIC = 137,
    MATIC_TESTNET = 80001,
    FANTOM = 250,
    FANTOM_TESTNET = 4002,
    XDAI = 100,
    BSC = 56,
    BSC_TESTNET = 97,
    ARBITRUM = 42161,
    ARBITRUM_TESTNET = 79377087078960,
    MOONBEAM_TESTNET = 1287,
    AVALANCHE = 43114,
    AVALANCHE_TESTNET = 43113,
    HECO = 128,
    HECO_TESTNET = 256,
    HARMONY = 1666600000,
    HARMONY_TESTNET = 1666700000,
    OKEX = 66,
    OKEX_TESTNET = 65
}
export declare enum TradeType {
    EXACT_INPUT = 0,
    EXACT_OUTPUT = 1
}
export declare enum Rounding {
    ROUND_DOWN = 0,
    ROUND_HALF_UP = 1,
    ROUND_UP = 2
}
export declare const INIT_CODE_HASH: string;
export declare const FACTORY_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const ROUTER_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const SUSHI_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const MASTERCHEF_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const BAR_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const MAKER_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const TIMELOCK_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const BENTOBOX_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const KASHI_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const SUSHISWAP_SWAPPER_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const SUSHISWAP_MULTISWAPPER_ADDRESS: {
    [chainId in ChainId]: string;
};
export declare const SUSHISWAP_MULTI_EXACT_SWAPPER_ADDRESS: {
    1: string;
    3: string;
    4: string;
    5: string;
    42: string;
    250: string;
    4002: string;
    137: string;
    80001: string;
    100: string;
    56: string;
    97: string;
    42161: string;
    79377087078960: string;
    1287: string;
    43114: string;
    43113: string;
    128: string;
    256: string;
    1666600000: string;
    1666700000: string;
    66: string;
    65: string;
};
export declare const PEGGED_ORACLE_ADDRESS = "0x6cbfbB38498Df0E1e7A4506593cDB02db9001564";
export declare const SUSHISWAP_TWAP_0_ORACLE_ADDRESS = "0x66F03B0d30838A3fee971928627ea6F59B236065";
export declare const SUSHISWAP_TWAP_1_ORACLE_ADDRESS = "0x0D51b575591F8f74a2763Ade75D3CDCf6789266f";
export declare const CHAINLINK_ORACLE_ADDRESS = "0x00632CFe43d8F9f8E6cD0d39Ffa3D4fa7ec73CFB";
export declare const BORING_HELPER_ADDRESS: {
    1: string;
    3: string;
    4: string;
    5: string;
    42: string;
    250: string;
    4002: string;
    137: string;
    80001: string;
    100: string;
    56: string;
    97: string;
    42161: string;
    79377087078960: string;
    1287: string;
    43114: string;
    43113: string;
    128: string;
    256: string;
    1666600000: string;
    1666700000: string;
    66: string;
    65: string;
};
export declare const MINIMUM_LIQUIDITY: JSBI;
export declare const ZERO: JSBI;
export declare const ONE: JSBI;
export declare const TWO: JSBI;
export declare const THREE: JSBI;
export declare const FIVE: JSBI;
export declare const TEN: JSBI;
export declare const _100: JSBI;
export declare const _997: JSBI;
export declare const _1000: JSBI;
export declare enum SolidityType {
    uint8 = "uint8",
    uint256 = "uint256"
}
export declare const SOLIDITY_TYPE_MAXIMA: {
    uint8: JSBI;
    uint256: JSBI;
};
