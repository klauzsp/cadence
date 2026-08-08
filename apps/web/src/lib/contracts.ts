import { keccak256, toBytes, type Address } from "viem";

export const vaultFactoryAddress = process.env
  .NEXT_PUBLIC_VAULT_FACTORY_ADDRESS as Address | undefined;

export const dcaStrategyId = keccak256(toBytes("DCA_V1"));

export const dcaConfigParameters = [
  { name: "asset", type: "address" },
  { name: "targetToken", type: "address" },
  { name: "amountPerSwap", type: "uint256" },
  { name: "interval", type: "uint256" },
  { name: "maxSlippageBps", type: "uint16" },
  { name: "name", type: "string" },
  { name: "symbol", type: "string" },
] as const;

// Monad Foundation testnet token list, verified on chain on 2026-08-08.
export const supportedTokens = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
  },
  {
    symbol: "WMON",
    name: "Wrapped MON",
    address: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x45477f4709771331db81944A5E20eF95Bc7BA2D7",
  },
] as const satisfies readonly { symbol: string; name: string; address: Address }[];

export const vaultFactoryAbi = [
  {
    type: "function",
    name: "createVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategyId", type: "bytes32" },
      { name: "initData", type: "bytes" },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
] as const;

export const erc20MetadataAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
