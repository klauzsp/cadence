import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { dcaVaultAbi, erc20Abi, vaultFactoryAbi } from "./abis.js";

const rpcUrl = requiredEnv("MONAD_RPC_URL");
const privateKey = requiredEnv("KEEPER_PRIVATE_KEY") as Hex;
const factoryAddress = requiredAddress("VAULT_FACTORY_ADDRESS");
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? "15000");
const dcaStrategyId = keccak256(toBytes("DCA_V1"));

if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("KEEPER_PRIVATE_KEY must be a 32-byte 0x-prefixed private key");
}
if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 1_000) {
  throw new Error("POLL_INTERVAL_MS must be at least 1000");
}

const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: monadTestnet, transport });
const walletClient = createWalletClient({ account, chain: monadTestnet, transport });
let running = true;

process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

console.log(`Keeper ${account.address} watching factory ${factoryAddress}`);

while (running) {
  try {
    await processDueVaults();
  } catch (error) {
    console.error("Keeper poll failed", error);
  }

  if (running) await delay(pollIntervalMs);
}

async function processDueVaults() {
  const [block, vaultCount] = await Promise.all([
    publicClient.getBlock({ blockTag: "latest" }),
    publicClient.readContract({
      address: factoryAddress,
      abi: vaultFactoryAbi,
      functionName: "vaultCount",
    }),
  ]);

  for (let index = 0n; index < vaultCount; index++) {
    const vault = await publicClient.readContract({
      address: factoryAddress,
      abi: vaultFactoryAbi,
      functionName: "vaultAt",
      args: [index],
    });
    const strategyId = await publicClient.readContract({
      address: factoryAddress,
      abi: vaultFactoryAbi,
      functionName: "vaultStrategy",
      args: [vault],
    });
    if (strategyId !== dcaStrategyId) continue;

    await executeIfDue(vault, block.timestamp);
  }
}

async function executeIfDue(vault: Address, blockTimestamp: bigint) {
  const [nextExecution, asset] = await Promise.all([
    publicClient.readContract({ address: vault, abi: dcaVaultAbi, functionName: "nextExecution" }),
    publicClient.readContract({ address: vault, abi: dcaVaultAbi, functionName: "asset" }),
  ]);
  if (blockTimestamp < nextExecution) return;

  const idleAssets = await publicClient.readContract({
    address: asset,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [vault],
  });
  if (idleAssets === 0n) return;

  try {
    await publicClient.simulateContract({
      account,
      address: vault,
      abi: dcaVaultAbi,
      functionName: "executeDca",
    });
    const estimatedGas = await publicClient.estimateContractGas({
      account,
      address: vault,
      abi: dcaVaultAbi,
      functionName: "executeDca",
    });
    const gas = estimatedGas + estimatedGas / 10n;
    const hash = await walletClient.writeContract({
      account,
      chain: monadTestnet,
      address: vault,
      abi: dcaVaultAbi,
      functionName: "executeDca",
      gas,
    });
    console.log(`Executing ${vault}: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Executed ${vault} in block ${receipt.blockNumber}`);
  } catch (error) {
    // Another keeper may have won the race, or the oracle/DEX may be temporarily unavailable.
    console.warn(`Skipped ${vault}`, error);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requiredAddress(name: string): Address {
  const value = requiredEnv(name);
  if (!isAddress(value)) throw new Error(`${name} must be a valid address`);
  return value;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
