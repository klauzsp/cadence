export const vaultFactoryAbi = [
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
    name: "vaultStrategy",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const dcaVaultAbi = [
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "nextExecution",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "executeDca",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "targetTokensOut", type: "uint256" }],
  },
] as const;

export const rebalanceVaultAbi = [
  {
    type: "function",
    name: "nextExecution",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "needsRebalance",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "needed", type: "bool" },
      { name: "allocationBps", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "rebalance",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const chainlinkFeedAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export const demoFeedAbi = [
  ...chainlinkFeedAbi,
  {
    type: "function",
    name: "updateAnswer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "newAnswer", type: "int256" },
      { name: "sourceUpdatedAt", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
