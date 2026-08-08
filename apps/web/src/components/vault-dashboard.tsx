"use client";

import { useEffect, useState } from "react";
import {
  formatUnits,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useBlock,
  usePublicClient,
  useReadContracts,
  useWalletClient,
} from "wagmi";
import {
  dcaVaultAbi,
  erc20Abi,
  isDemoMode,
  protocolDeploymentBlock,
  tokenDetails,
  vaultFactoryAbi,
  vaultFactoryAddress,
} from "@/lib/contracts";

type Action = "approve" | "deposit" | "withdraw" | "execute" | "faucet";
type Execution = {
  transactionHash: Hex;
  blockNumber: bigint;
  executor?: Address;
  assetsIn?: bigint;
  targetTokensOut?: bigint;
  nextExecution?: bigint;
};

export function VaultDashboard({ vault }: { vault: Address }) {
  const { address: account, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { data: latestBlock } = useBlock({ watch: true });
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pendingAction, setPendingAction] = useState<Action>();
  const [transactionHash, setTransactionHash] = useState<Hex>();
  const [actionError, setActionError] = useState<string>();
  const [executions, setExecutions] = useState<Execution[]>([]);

  const { data: coreData, refetch: refetchCore } = useReadContracts({
    contracts: [
      { address: vault, abi: dcaVaultAbi, functionName: "name" },
      { address: vault, abi: dcaVaultAbi, functionName: "symbol" },
      { address: vault, abi: dcaVaultAbi, functionName: "asset" },
      { address: vault, abi: dcaVaultAbi, functionName: "targetToken" },
      { address: vault, abi: dcaVaultAbi, functionName: "amountPerSwap" },
      { address: vault, abi: dcaVaultAbi, functionName: "interval" },
      { address: vault, abi: dcaVaultAbi, functionName: "maxSlippageBps" },
      { address: vault, abi: dcaVaultAbi, functionName: "nextExecution" },
      { address: vault, abi: dcaVaultAbi, functionName: "executionCount" },
      { address: vault, abi: dcaVaultAbi, functionName: "totalAssetsInvested" },
      { address: vault, abi: dcaVaultAbi, functionName: "totalTargetAcquired" },
      { address: vault, abi: dcaVaultAbi, functionName: "totalAssets" },
      { address: vault, abi: dcaVaultAbi, functionName: "totalSupply" },
      {
        address: vaultFactoryAddress as Address,
        abi: vaultFactoryAbi,
        functionName: "vaultCreator",
        args: [vault],
      },
      {
        address: vaultFactoryAddress as Address,
        abi: vaultFactoryAbi,
        functionName: "owner",
      },
    ],
    query: { enabled: Boolean(vaultFactoryAddress) },
  });

  const name = coreData?.[0].result as string | undefined;
  const symbol = coreData?.[1].result as string | undefined;
  const asset = coreData?.[2].result as Address | undefined;
  const target = coreData?.[3].result as Address | undefined;
  const amountPerSwap = coreData?.[4].result as bigint | undefined;
  const interval = coreData?.[5].result as bigint | undefined;
  const maxSlippageBps = coreData?.[6].result as number | undefined;
  const nextExecution = coreData?.[7].result as bigint | undefined;
  const executionCount = coreData?.[8].result as bigint | undefined;
  const totalAssetsInvested = coreData?.[9].result as bigint | undefined;
  const totalTargetAcquired = coreData?.[10].result as bigint | undefined;
  const totalAssets = coreData?.[11].result as bigint | undefined;
  const totalSupply = coreData?.[12].result as bigint | undefined;
  const creator = coreData?.[13].result as Address | undefined;
  const protocolOwner = coreData?.[14].result as Address | undefined;
  const assetToken = tokenDetails(asset);
  const targetToken = tokenDetails(target);
  const assetDecimals = assetToken?.decimals ?? 18;
  const targetDecimals = targetToken?.decimals ?? 18;

  const { data: positionData, refetch: refetchPosition } = useReadContracts({
    contracts: [
      {
        address: vault,
        abi: dcaVaultAbi,
        functionName: "balanceOf",
        args: [account ?? zeroAddress],
      },
      {
        address: asset as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account ?? zeroAddress],
      },
      {
        address: asset as Address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account ?? zeroAddress, vault],
      },
      {
        address: asset as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [vault],
      },
      {
        address: target as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [vault],
      },
    ],
    query: { enabled: Boolean(asset && target) },
  });

  const userShares = positionData?.[0].result as bigint | undefined;
  const userAssetBalance = positionData?.[1].result as bigint | undefined;
  const allowance = positionData?.[2].result as bigint | undefined;
  const idleAssets = positionData?.[3].result as bigint | undefined;
  const targetBalance = positionData?.[4].result as bigint | undefined;
  const depositUnits = parseAmount(depositAmount, assetDecimals);
  const withdrawUnits = parseAmount(withdrawAmount, assetDecimals);

  const numericAssets = Number(formatUnits(totalAssets ?? 0n, assetDecimals));
  const numericSupply = Number(formatUnits(totalSupply ?? 0n, assetDecimals));
  const sharePrice = numericSupply > 0 ? numericAssets / numericSupply : 1;
  const strategyReturn = (sharePrice - 1) * 100;
  const userShareAmount = Number(formatUnits(userShares ?? 0n, assetDecimals));
  const userPositionValue = userShareAmount * sharePrice;
  const investedValue = (totalAssets ?? 0n) > (idleAssets ?? 0n)
    ? (totalAssets ?? 0n) - (idleAssets ?? 0n)
    : 0n;
  const investedPercent = totalAssets && totalAssets > 0n
    ? Number((investedValue * 10_000n) / totalAssets) / 100
    : 0;
  const due = nextExecution !== undefined && latestBlock !== undefined && latestBlock.timestamp >= nextExecution;
  const isCreator = sameAddress(account, creator);
  const isAdmin = sameAddress(account, protocolOwner);
  const isInvestor = Boolean(userShares && userShares > 0n);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    async function loadExecutions() {
      const logs = await publicClient!.getContractEvents({
        address: vault,
        abi: dcaVaultAbi,
        eventName: "DcaExecuted",
        fromBlock: protocolDeploymentBlock,
        toBlock: "latest",
      });
      if (cancelled) return;
      setExecutions(
        logs
          .map((log) => ({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            executor: log.args.executor,
            assetsIn: log.args.assetsIn,
            targetTokensOut: log.args.targetTokensOut,
            nextExecution: log.args.nextExecution,
          }))
          .reverse(),
      );
    }

    loadExecutions().catch(() => setExecutions([]));
    return () => {
      cancelled = true;
    };
  }, [publicClient, transactionHash, vault]);

  async function runAction(action: Action) {
    if (!account || !publicClient || !walletClient || !asset) return;
    setPendingAction(action);
    setActionError(undefined);
    setTransactionHash(undefined);

    try {
      let hash: Hex;
      if (action === "approve") {
        const { request } = await publicClient.simulateContract({
          account,
          address: asset,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, depositUnits],
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({ ...request, gas: addGasBuffer(estimate) });
      } else if (action === "deposit") {
        const { request } = await publicClient.simulateContract({
          account,
          address: vault,
          abi: dcaVaultAbi,
          functionName: "deposit",
          args: [depositUnits, account],
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({ ...request, gas: addGasBuffer(estimate) });
      } else if (action === "withdraw") {
        const { request } = await publicClient.simulateContract({
          account,
          address: vault,
          abi: dcaVaultAbi,
          functionName: "withdraw",
          args: [withdrawUnits, account, account],
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({ ...request, gas: addGasBuffer(estimate) });
      } else if (action === "execute") {
        const { request } = await publicClient.simulateContract({
          account,
          address: vault,
          abi: dcaVaultAbi,
          functionName: "executeDca",
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({ ...request, gas: addGasBuffer(estimate) });
      } else {
        const { request } = await publicClient.simulateContract({
          account,
          address: asset,
          abi: erc20Abi,
          functionName: "faucet",
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({ ...request, gas: addGasBuffer(estimate) });
      }

      setTransactionHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([refetchCore(), refetchPosition()]);
      if (action === "deposit") setDepositAmount("");
      if (action === "withdraw") setWithdrawAmount("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Transaction failed");
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <>
      <section className="vault-title-section">
        <div>
          <p className="eyebrow">DCA strategy · {symbol ?? "—"}</p>
          <h1>{name ?? "Loading vault…"}</h1>
          <div className="pair-line large">
            <strong>{assetToken?.symbol ?? "Asset"}</strong>
            <span>→</span>
            <strong>{targetToken?.symbol ?? "Target"}</strong>
          </div>
        </div>
        <div className="role-badges">
          {isAdmin && <span className="role-badge admin">Protocol admin</span>}
          {isCreator && <span className="role-badge">Creator</span>}
          {isInvestor && <span className="role-badge investor">Investor</span>}
        </div>
      </section>

      {isDemoMode && (
        <div className="demo-banner">
          Demo mode: prices are relayed from Chainlink on Monad mainnet. Tokens and swaps are test-only.
        </div>
      )}

      <section className="metric-grid">
        <Metric label="TVL" value={`${formatAmount(totalAssets, assetDecimals)} ${assetToken?.symbol ?? ""}`} />
        <Metric label="Share price" value={`${sharePrice.toFixed(4)} ${assetToken?.symbol ?? ""}`} />
        <Metric label="Strategy return" value={`${strategyReturn >= 0 ? "+" : ""}${strategyReturn.toFixed(2)}%`} />
        <Metric label="Your position" value={`${userPositionValue.toFixed(4)} ${assetToken?.symbol ?? ""}`} />
        <Metric label="Invested allocation" value={`${investedPercent.toFixed(1)}%`} />
        <Metric label="Executions" value={executionCount?.toString() ?? "0"} />
      </section>

      <section className="vault-layout">
        <div className="panel">
          <p className="eyebrow">Investor actions</p>
          <h2>Fund your position</h2>
          <p className="balance-line">
            Wallet balance: {formatAmount(userAssetBalance, assetDecimals)} {assetToken?.symbol}
          </p>
          {isDemoMode && (
            <button className="secondary-button" disabled={!isConnected || Boolean(pendingAction)} onClick={() => runAction("faucet")}>
              {pendingAction === "faucet" ? "Requesting…" : `Get demo ${assetToken?.symbol ?? "tokens"}`}
            </button>
          )}
          <label>
            Deposit amount
            <input inputMode="decimal" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="100" />
          </label>
          <div className="action-row">
            <button className="secondary-button" disabled={!isConnected || depositUnits === 0n || Boolean(pendingAction)} onClick={() => runAction("approve")}>
              {pendingAction === "approve" ? "Approving…" : "1. Approve"}
            </button>
            <button className="primary-button" disabled={!isConnected || depositUnits === 0n || (allowance ?? 0n) < depositUnits || Boolean(pendingAction)} onClick={() => runAction("deposit")}>
              {pendingAction === "deposit" ? "Depositing…" : "2. Deposit"}
            </button>
          </div>

          <div className="panel-divider" />
          <label>
            Withdraw assets
            <input inputMode="decimal" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="50" />
          </label>
          <button className="secondary-button full" disabled={!isInvestor || withdrawUnits === 0n || Boolean(pendingAction)} onClick={() => runAction("withdraw")}>
            {pendingAction === "withdraw" ? "Withdrawing…" : "Withdraw"}
          </button>
          {actionError && <p className="form-error">{actionError}</p>}
          {transactionHash && <p className="form-success">Transaction confirmed: {shortAddress(transactionHash)}</p>}
        </div>

        <div className="panel">
          <p className="eyebrow">Automation</p>
          <h2>Execution status</h2>
          <dl className="detail-list">
            <div><dt>Tranche</dt><dd>{formatAmount(amountPerSwap, assetDecimals)} {assetToken?.symbol}</dd></div>
            <div><dt>Frequency</dt><dd>{formatInterval(interval)}</dd></div>
            <div><dt>Max slippage</dt><dd>{((maxSlippageBps ?? 0) / 100).toFixed(2)}%</dd></div>
            <div><dt>Next execution</dt><dd>{nextExecution ? new Date(Number(nextExecution) * 1000).toLocaleString() : "—"}</dd></div>
            <div><dt>Idle assets</dt><dd>{formatAmount(idleAssets, assetDecimals)} {assetToken?.symbol}</dd></div>
            <div><dt>Target balance</dt><dd>{formatAmount(targetBalance, targetDecimals)} {targetToken?.symbol}</dd></div>
            <div><dt>Total invested</dt><dd>{formatAmount(totalAssetsInvested, assetDecimals)} {assetToken?.symbol}</dd></div>
            <div><dt>Total acquired</dt><dd>{formatAmount(totalTargetAcquired, targetDecimals)} {targetToken?.symbol}</dd></div>
          </dl>
          <button className="primary-button full" disabled={!isConnected || !due || !idleAssets || Boolean(pendingAction)} onClick={() => runAction("execute")}>
            {pendingAction === "execute" ? "Executing…" : due ? "Execute DCA now" : "Waiting for schedule"}
          </button>
          <p className="form-note">Anyone may execute a due tranche. The keeper does this automatically.</p>
        </div>
      </section>

      <section className="activity-section">
        <p className="eyebrow">Onchain activity</p>
        <h2>Recent executions</h2>
        {executions.length === 0 ? (
          <p className="empty-state compact">No DCA swaps have executed yet.</p>
        ) : (
          <div className="activity-list">
            {executions.slice(0, 10).map((execution) => (
              <article key={execution.transactionHash}>
                <div>
                  <strong>{formatAmount(execution.assetsIn, assetDecimals)} {assetToken?.symbol} invested</strong>
                  <span>by {shortAddress(execution.executor)}</span>
                </div>
                <div>
                  <strong>{formatAmount(execution.targetTokensOut, targetDecimals)} {targetToken?.symbol} acquired</strong>
                  <span>block {execution.blockNumber.toString()}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

function formatAmount(value: bigint | undefined, decimals: number) {
  return Number(formatUnits(value ?? 0n, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatInterval(value?: bigint) {
  if (!value) return "—";
  if (value % 86_400n === 0n) return `Every ${value / 86_400n} day(s)`;
  if (value % 3_600n === 0n) return `Every ${value / 3_600n} hour(s)`;
  return `${value} seconds`;
}

function sameAddress(left?: Address, right?: Address) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function shortAddress(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
}

function addGasBuffer(estimate: bigint) {
  return estimate + estimate / 10n;
}

function parseAmount(value: string, decimals: number) {
  try {
    return parseUnits(value || "0", decimals);
  } catch {
    return 0n;
  }
}
