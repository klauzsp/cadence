import { isAddress, keccak256, parseAbi, toBytes, type Address } from "viem";

function publicAddress(name: string, fallback?: Address): Address | undefined {
  const configured = process.env[name];
  const value = configured && configured.length > 0 ? configured : fallback;
  return value && isAddress(value) ? value : undefined;
}

export const vaultFactoryAddress = publicAddress("NEXT_PUBLIC_VAULT_FACTORY_ADDRESS");
export const protocolDeploymentBlock = BigInt(
  process.env.NEXT_PUBLIC_PROTOCOL_DEPLOYMENT_BLOCK ?? "0",
);
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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

const tokenDefinitions = [
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    fallback: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    env: "NEXT_PUBLIC_USDC_ADDRESS",
  },
  {
    symbol: "WMON",
    name: "Wrapped MON",
    decimals: 18,
    fallback: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541",
    env: "NEXT_PUBLIC_WMON_ADDRESS",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    fallback: "0x45477f4709771331db81944A5E20eF95Bc7BA2D7",
    env: "NEXT_PUBLIC_WETH_ADDRESS",
  },
] as const;

export const supportedTokens = tokenDefinitions.map((token) => ({
  symbol: token.symbol,
  name: token.name,
  decimals: token.decimals,
  address: publicAddress(token.env, token.fallback as Address) as Address,
}));

export function tokenDetails(address?: Address) {
  return supportedTokens.find(
    (token) => token.address.toLowerCase() === address?.toLowerCase(),
  );
}

export const vaultFactoryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
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
  {
    type: "function",
    name: "vaultCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "vaultAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "vaultCreator",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "VaultCreated",
    inputs: [
      { indexed: true, name: "creator", type: "address" },
      { indexed: true, name: "vault", type: "address" },
      { indexed: true, name: "strategyId", type: "bytes32" },
    ],
  },
] as const;

export const dcaVaultAbi = parseAbi([
  "function asset() view returns (address)",
  "function targetToken() view returns (address)",
  "function amountPerSwap() view returns (uint256)",
  "function interval() view returns (uint256)",
  "function maxSlippageBps() view returns (uint16)",
  "function nextExecution() view returns (uint256)",
  "function executionCount() view returns (uint256)",
  "function totalAssetsInvested() view returns (uint256)",
  "function totalTargetAcquired() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function executeDca() returns (uint256 targetTokensOut)",
  "event DcaExecuted(address indexed executor, uint256 assetsIn, uint256 targetTokensOut, uint256 nextExecution)",
]);

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;
