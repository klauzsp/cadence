import { isAddress, keccak256, parseAbi, toBytes, type Address } from "viem";

function publicAddress(configured?: string, fallback?: Address): Address | undefined {
  const value = configured && configured.length > 0 ? configured : fallback;
  return value && isAddress(value) ? value : undefined;
}

export const vaultFactoryAddress = publicAddress(
  process.env.NEXT_PUBLIC_VAULT_FACTORY_ADDRESS,
);
export const nativeDepositRouterAddress = publicAddress(
  process.env.NEXT_PUBLIC_NATIVE_DEPOSIT_ROUTER_ADDRESS,
);
export const protocolDeploymentBlock = BigInt(
  process.env.NEXT_PUBLIC_PROTOCOL_DEPLOYMENT_BLOCK ?? "0",
);
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const explorerBaseUrl = (
  process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL ?? "https://testnet.monadscan.com"
).replace(/\/$/, "");

export function transactionExplorerUrl(hash: string) {
  return `${explorerBaseUrl}/tx/${hash}`;
}

export function addressExplorerUrl(address: string) {
  return `${explorerBaseUrl}/address/${address}`;
}

export const dcaStrategyId = keccak256(toBytes("DCA_V1"));
export const rebalanceStrategyId = keccak256(toBytes("REBALANCE_V1"));

export const dcaConfigParameters = [
  { name: "asset", type: "address" },
  { name: "targetToken", type: "address" },
  { name: "amountPerSwap", type: "uint256" },
  { name: "interval", type: "uint256" },
  { name: "maxSlippageBps", type: "uint16" },
  { name: "name", type: "string" },
  { name: "symbol", type: "string" },
] as const;

export const rebalanceConfigParameters = [
  { name: "asset", type: "address" },
  { name: "targetToken", type: "address" },
  { name: "targetAllocationBps", type: "uint16" },
  { name: "thresholdBps", type: "uint16" },
  { name: "interval", type: "uint256" },
  { name: "maxSlippageBps", type: "uint16" },
  { name: "name", type: "string" },
  { name: "symbol", type: "string" },
] as const;

const tokenDefinitions = [
  {
    symbol: "tUSDC",
    name: "Test USDC",
    decimals: 6,
    isTestToken: true,
    acceptsNative: false,
    fallback: "0x37F8f050Bb677e588c60F4614D24CAe2d9a0B324",
    configured: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  },
  {
    symbol: "MON",
    name: "Monad",
    decimals: 18,
    isTestToken: false,
    acceptsNative: true,
    fallback: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541",
    configured: process.env.NEXT_PUBLIC_WMON_ADDRESS,
  },
  {
    symbol: "tWETH",
    name: "Test Wrapped Ether",
    decimals: 18,
    isTestToken: true,
    acceptsNative: false,
    fallback: "0x9cF74BaFaabAeB901C7d88b195d72F6D497487e9",
    configured: process.env.NEXT_PUBLIC_WETH_ADDRESS,
  },
] as const;

export const supportedTokens = tokenDefinitions.map((token) => ({
  symbol: token.symbol,
  name: token.name,
  decimals: token.decimals,
  isTestToken: token.isTestToken,
  acceptsNative: token.acceptsNative,
  address: publicAddress(token.configured, token.fallback as Address) as Address,
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
    type: "function",
    name: "vaultStrategy",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ type: "bytes32" }],
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
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
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

export const rebalanceVaultAbi = parseAbi([
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error AllocationWithinThreshold(uint256 currentAllocationBps)",
  "function asset() view returns (address)",
  "function targetToken() view returns (address)",
  "function targetAllocationBps() view returns (uint16)",
  "function thresholdBps() view returns (uint16)",
  "function interval() view returns (uint256)",
  "function maxSlippageBps() view returns (uint16)",
  "function nextExecution() view returns (uint256)",
  "function executionCount() view returns (uint256)",
  "function totalRebalanced() view returns (uint256)",
  "function currentAllocationBps() view returns (uint256)",
  "function needsRebalance() view returns (bool needed, uint256 allocationBps)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function rebalance() returns (uint256 amountOut)",
  "event Rebalanced(address indexed executor, address indexed tokenIn, uint256 amountIn, address indexed tokenOut, uint256 amountOut, uint256 secondaryAllocationBps, uint256 nextExecution)",
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

export const nativeDepositRouterAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const;
