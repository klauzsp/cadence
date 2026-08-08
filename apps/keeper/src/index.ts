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
import { monad, monadTestnet } from "viem/chains";
import {
  chainlinkFeedAbi,
  dcaVaultAbi,
  demoFeedAbi,
  erc20Abi,
  rebalanceVaultAbi,
  vaultFactoryAbi,
} from "./abis.js";

const rpcUrl = requiredEnv("MONAD_RPC_URL");
const privateKey = requiredEnv("KEEPER_PRIVATE_KEY") as Hex;
const factoryAddress = requiredAddress("VAULT_FACTORY_ADDRESS");
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? "5000");
const dcaStrategyId = keccak256(toBytes("DCA_V1"));
const rebalanceStrategyId = keccak256(toBytes("REBALANCE_V1"));
const mainnetClient = createPublicClient({
  chain: monad,
  transport: http(process.env.MONAD_MAINNET_RPC_URL ?? "https://rpc.monad.xyz"),
});
const priceFeeds = [
  {
    symbol: "MON/USD",
    source: addressEnv("SOURCE_MON_USD_FEED", "0xBcD78f76005B7515837af6b50c7C52BCf73822fb"),
    destination: requiredAddress("TESTNET_MON_USD_FEED"),
  },
  {
    symbol: "ETH/USD",
    source: addressEnv("SOURCE_ETH_USD_FEED", "0x1B1414782B859871781bA3E4B0979b9ca57A0A04"),
    destination: requiredAddress("TESTNET_ETH_USD_FEED"),
  },
  {
    symbol: "USDC/USD",
    source: addressEnv("SOURCE_USDC_USD_FEED", "0xf5F15f188AbCB0d165D1Edb7f37F7d6fA2fCebec"),
    destination: requiredAddress("TESTNET_USDC_USD_FEED"),
  },
] as const;

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

console.log(`Keeper ${account.address} relaying Chainlink prices and watching factory ${factoryAddress}`);

while (running) {
  const cycleStartedAt = Date.now();

  try {
    await relayPrices();
  } catch (error) {
    console.error("Price relay failed", error);
  }

  try {
    await processDueVaults();
  } catch (error) {
    console.error("Vault poll failed", error);
  }

  if (running) {
    const remainingDelay = Math.max(0, pollIntervalMs - (Date.now() - cycleStartedAt));
    await delay(remainingDelay);
  }
}

async function relayPrices() {
  for (const feed of priceFeeds) {
    const [sourceRound, destinationRound] = await Promise.all([
      mainnetClient.readContract({
        address: feed.source,
        abi: chainlinkFeedAbi,
        functionName: "latestRoundData",
      }),
      publicClient.readContract({
        address: feed.destination,
        abi: demoFeedAbi,
        functionName: "latestRoundData",
      }),
    ]);

    const [, answer, , sourceUpdatedAt] = sourceRound;
    const [, , , destinationUpdatedAt] = destinationRound;
    if (answer <= 0n || sourceUpdatedAt <= destinationUpdatedAt) continue;

    const { request } = await publicClient.simulateContract({
      account,
      address: feed.destination,
      abi: demoFeedAbi,
      functionName: "updateAnswer",
      args: [answer, sourceUpdatedAt],
    });
    const estimatedGas = await publicClient.estimateContractGas(request);
    const hash = await walletClient.writeContract({
      ...request,
      gas: estimatedGas + estimatedGas / 10n,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Relayed ${feed.symbol}: ${answer} (${hash})`);
  }
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
    if (strategyId === dcaStrategyId) {
      await executeDcaIfDue(vault, block.timestamp);
    } else if (strategyId === rebalanceStrategyId) {
      await executeRebalanceIfDue(vault, block.timestamp);
    }
  }
}

async function executeDcaIfDue(vault: Address, blockTimestamp: bigint) {
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

async function executeRebalanceIfDue(vault: Address, blockTimestamp: bigint) {
  const [nextExecution, rebalanceStatus] = await Promise.all([
    publicClient.readContract({ address: vault, abi: rebalanceVaultAbi, functionName: "nextExecution" }),
    publicClient.readContract({ address: vault, abi: rebalanceVaultAbi, functionName: "needsRebalance" }),
  ]);
  if (blockTimestamp < nextExecution || !rebalanceStatus[0]) return;

  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: vault,
      abi: rebalanceVaultAbi,
      functionName: "rebalance",
    });
    const estimatedGas = await publicClient.estimateContractGas(request);
    const hash = await walletClient.writeContract({
      ...request,
      gas: estimatedGas + estimatedGas / 10n,
    });
    console.log(`Rebalancing ${vault}: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Rebalanced ${vault} in block ${receipt.blockNumber}`);
  } catch (error) {
    // Another keeper may have won the race, or the oracle/DEX may be temporarily unavailable.
    console.warn(`Skipped rebalance ${vault}`, error);
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

function addressEnv(name: string, fallback: Address): Address {
  const value = process.env[name] ?? fallback;
  if (!isAddress(value)) throw new Error(`${name} must be a valid address`);
  return value;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
