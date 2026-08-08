import type { Address } from "viem";

export const dcaFactoryAddress = process.env
  .NEXT_PUBLIC_DCA_FACTORY_ADDRESS as Address | undefined;

export const dcaFactoryAbi = [
  {
    type: "function",
    name: "createVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "targetToken", type: "address" },
      { name: "amountPerSwap", type: "uint256" },
      { name: "interval", type: "uint256" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
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
