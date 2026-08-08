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
  useBalance,
  useBlock,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWalletClient,
} from "wagmi";
import {
  dcaVaultAbi,
  addressExplorerUrl,
  erc20Abi,
  isDemoMode,
  nativeDepositRouterAbi,
  nativeDepositRouterAddress,
  protocolDeploymentBlock,
  rebalanceStrategyId,
  rebalanceVaultAbi,
  tokenDetails,
  transactionExplorerUrl,
  vaultFactoryAbi,
  vaultFactoryAddress,
} from "@/lib/contracts";

type Action =
  | "approve"
  | "deposit"
  | "nativeDeposit"
  | "withdraw"
  | "execute"
  | "faucet";
type Execution = {
  transactionHash: Hex;
  blockNumber: bigint;
  executor?: Address;
  assetsIn?: bigint;
  targetTokensOut?: bigint;
  nextExecution?: bigint;
  tokenIn?: Address;
  tokenOut?: Address;
  secondaryAllocationBps?: bigint;
};

const activityPollIntervalMs = 5_000;
const activityLookbackBlocks = 120n;
const activityChunkSize = 10n;

export function VaultDashboard({ vault }: { vault: Address }) {
  const { address: account, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address: account,
    query: { enabled: Boolean(account) },
  });
  const { data: latestBlock } = useBlock({ watch: true });
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pendingAction, setPendingAction] = useState<Action>();
  const [transactionHash, setTransactionHash] = useState<Hex>();
  const [actionError, setActionError] = useState<string>();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string>();

  const { data: strategyId } = useReadContract({
    address: vaultFactoryAddress,
    abi: vaultFactoryAbi,
    functionName: "vaultStrategy",
    args: [vault],
    query: { enabled: Boolean(vaultFactoryAddress) },
  });
  const isRebalance = strategyId === rebalanceStrategyId;

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

  const { data: rebalanceData } = useReadContracts({
    contracts: [
      {
        address: vault,
        abi: rebalanceVaultAbi,
        functionName: "targetAllocationBps",
      },
      { address: vault, abi: rebalanceVaultAbi, functionName: "thresholdBps" },
      { address: vault, abi: rebalanceVaultAbi, functionName: "interval" },
      {
        address: vault,
        abi: rebalanceVaultAbi,
        functionName: "maxSlippageBps",
      },
      { address: vault, abi: rebalanceVaultAbi, functionName: "nextExecution" },
      {
        address: vault,
        abi: rebalanceVaultAbi,
        functionName: "executionCount",
      },
      {
        address: vault,
        abi: rebalanceVaultAbi,
        functionName: "totalRebalanced",
      },
      {
        address: vault,
        abi: rebalanceVaultAbi,
        functionName: "currentAllocationBps",
      },
      {
        address: vault,
        abi: rebalanceVaultAbi,
        functionName: "needsRebalance",
      },
    ],
    query: { enabled: isRebalance },
  });
  const targetAllocationBps = rebalanceData?.[0].result as number | undefined;
  const thresholdBps = rebalanceData?.[1].result as number | undefined;
  const rebalanceInterval = rebalanceData?.[2].result as bigint | undefined;
  const rebalanceSlippageBps = rebalanceData?.[3].result as number | undefined;
  const rebalanceNextExecution = rebalanceData?.[4].result as
    | bigint
    | undefined;
  const rebalanceExecutionCount = rebalanceData?.[5].result as
    | bigint
    | undefined;
  const totalRebalanced = rebalanceData?.[6].result as bigint | undefined;
  const currentAllocationBps = rebalanceData?.[7].result as bigint | undefined;
  const needsRebalanceResult = rebalanceData?.[8].result as
    | readonly [boolean, bigint]
    | undefined;
  const displayedInterval = isRebalance ? rebalanceInterval : interval;
  const displayedSlippageBps = isRebalance
    ? rebalanceSlippageBps
    : maxSlippageBps;
  const displayedNextExecution = isRebalance
    ? rebalanceNextExecution
    : nextExecution;
  const displayedExecutionCount = isRebalance
    ? rebalanceExecutionCount
    : executionCount;
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
  const acceptsNative = Boolean(assetToken?.acceptsNative);
  const depositSourceBalance = acceptsNative
    ? nativeBalance?.value
    : userAssetBalance;
  const hasDepositBalance = depositUnits <= (depositSourceBalance ?? 0n);

  const numericAssets = Number(formatUnits(totalAssets ?? 0n, assetDecimals));
  const numericSupply = Number(formatUnits(totalSupply ?? 0n, assetDecimals));
  const sharePrice = numericSupply > 0 ? numericAssets / numericSupply : 1;
  const strategyReturn = (sharePrice - 1) * 100;
  const userShareAmount = Number(formatUnits(userShares ?? 0n, assetDecimals));
  const userPositionValue = userShareAmount * sharePrice;
  const ownershipPercent =
    totalSupply && totalSupply > 0n
      ? Number(((userShares ?? 0n) * 1_000_000n) / totalSupply) / 10_000
      : 0;
  const investedValue =
    (totalAssets ?? 0n) > (idleAssets ?? 0n)
      ? (totalAssets ?? 0n) - (idleAssets ?? 0n)
      : 0n;
  const investedPercent =
    totalAssets && totalAssets > 0n
      ? Number((investedValue * 10_000n) / totalAssets) / 100
      : 0;
  const due =
    displayedNextExecution !== undefined &&
    latestBlock !== undefined &&
    latestBlock.timestamp >= displayedNextExecution;
  const rebalanceNeeded = needsRebalanceResult?.[0] ?? false;
  const isCreator = sameAddress(account, creator);
  const isAdmin = sameAddress(account, protocolOwner);
  const isInvestor = Boolean(userShares && userShares > 0n);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    let isLoading = false;
    let isInitialLoad = true;
    let nextBlock: bigint | undefined;

    async function loadExecutions() {
      if (isLoading) return;
      isLoading = true;

      try {
        const latestBlockNumber = await publicClient!.getBlockNumber();
        const lookbackStart =
          latestBlockNumber > activityLookbackBlocks
            ? latestBlockNumber - activityLookbackBlocks
            : 0n;
        const firstBlock =
          protocolDeploymentBlock > lookbackStart
            ? protocolDeploymentBlock
            : lookbackStart;
        let fromBlock = nextBlock ?? firstBlock;
        const loadedExecutions: Execution[] = [];

        while (fromBlock <= latestBlockNumber) {
          const chunkEnd = fromBlock + activityChunkSize - 1n;
          const toBlock =
            chunkEnd < latestBlockNumber ? chunkEnd : latestBlockNumber;

          if (isRebalance) {
            const logs = await publicClient!.getContractEvents({
              address: vault,
              abi: rebalanceVaultAbi,
              eventName: "Rebalanced",
              fromBlock,
              toBlock,
            });
            loadedExecutions.push(
              ...logs.map((log) => ({
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
                executor: log.args.executor,
                assetsIn: log.args.amountIn,
                targetTokensOut: log.args.amountOut,
                tokenIn: log.args.tokenIn,
                tokenOut: log.args.tokenOut,
                secondaryAllocationBps: log.args.secondaryAllocationBps,
                nextExecution: log.args.nextExecution,
              })),
            );
          } else {
            const logs = await publicClient!.getContractEvents({
              address: vault,
              abi: dcaVaultAbi,
              eventName: "DcaExecuted",
              fromBlock,
              toBlock,
            });
            loadedExecutions.push(
              ...logs.map((log) => ({
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
                executor: log.args.executor,
                assetsIn: log.args.assetsIn,
                targetTokensOut: log.args.targetTokensOut,
                nextExecution: log.args.nextExecution,
              })),
            );
          }

          fromBlock = toBlock + 1n;
        }

        nextBlock = latestBlockNumber + 1n;
        if (cancelled) return;
        setActivityError(undefined);
        setExecutions((current) => {
          const existingExecutions = isInitialLoad ? [] : current;
          const byTransaction = new Map(
            existingExecutions.map((execution) => [
              execution.transactionHash,
              execution,
            ]),
          );
          for (const execution of loadedExecutions) {
            byTransaction.set(execution.transactionHash, execution);
          }
          return [...byTransaction.values()]
            .sort((left, right) => Number(right.blockNumber - left.blockNumber))
            .slice(0, 10);
        });
        isInitialLoad = false;
      } catch {
        if (!cancelled)
          setActivityError(
            "Live activity is temporarily unavailable. Retrying…",
          );
      } finally {
        isLoading = false;
        if (!cancelled) setIsActivityLoading(false);
      }
    }

    void loadExecutions();
    const poller = window.setInterval(
      () => void loadExecutions(),
      activityPollIntervalMs,
    );

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [isRebalance, publicClient, vault]);

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
        hash = await walletClient.writeContract({
          ...request,
          gas: addGasBuffer(estimate),
        });
      } else if (action === "deposit") {
        const { request } = await publicClient.simulateContract({
          account,
          address: vault,
          abi: dcaVaultAbi,
          functionName: "deposit",
          args: [depositUnits, account],
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({
          ...request,
          gas: addGasBuffer(estimate),
        });
      } else if (action === "nativeDeposit") {
        if (!nativeDepositRouterAddress)
          throw new Error("Native Monad deposits are not configured");
        const { request } = await publicClient.simulateContract({
          account,
          address: nativeDepositRouterAddress,
          abi: nativeDepositRouterAbi,
          functionName: "deposit",
          args: [vault, account],
          value: depositUnits,
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({
          ...request,
          gas: addGasBuffer(estimate),
        });
      } else if (action === "withdraw") {
        const { request } = await publicClient.simulateContract({
          account,
          address: vault,
          abi: dcaVaultAbi,
          functionName: "withdraw",
          args: [withdrawUnits, account, account],
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({
          ...request,
          gas: addGasBuffer(estimate),
        });
      } else if (action === "execute") {
        if (isRebalance) {
          const { request } = await publicClient.simulateContract({
            account,
            address: vault,
            abi: rebalanceVaultAbi,
            functionName: "rebalance",
          });
          const estimate = await publicClient.estimateContractGas(request);
          hash = await walletClient.writeContract({
            ...request,
            gas: addGasBuffer(estimate),
          });
        } else {
          const { request } = await publicClient.simulateContract({
            account,
            address: vault,
            abi: dcaVaultAbi,
            functionName: "executeDca",
          });
          const estimate = await publicClient.estimateContractGas(request);
          hash = await walletClient.writeContract({
            ...request,
            gas: addGasBuffer(estimate),
          });
        }
      } else {
        const { request } = await publicClient.simulateContract({
          account,
          address: asset,
          abi: erc20Abi,
          functionName: "faucet",
        });
        const estimate = await publicClient.estimateContractGas(request);
        hash = await walletClient.writeContract({
          ...request,
          gas: addGasBuffer(estimate),
        });
      }

      setTransactionHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([
        refetchCore(),
        refetchPosition(),
        refetchNativeBalance(),
      ]);
      if (action === "deposit" || action === "nativeDeposit")
        setDepositAmount("");
      if (action === "withdraw") setWithdrawAmount("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Transaction failed",
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <>
      <section className="vault-title-section">
        <div>
          <p className="eyebrow">
            {isRebalance ? "Rebalance" : "DCA"} strategy · {symbol ?? "—"}
          </p>
          <h1>{name ?? "Loading vault…"}</h1>
          <a
            className="explorer-link"
            href={addressExplorerUrl(vault)}
            rel="noreferrer"
            target="_blank"
          >
            View vault contract ↗
          </a>
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

      <section className="metric-grid">
        <Metric
          label="TVL"
          value={`${formatAmount(totalAssets, assetDecimals)} ${assetToken?.symbol ?? ""}`}
        />
        <Metric
          label="Share price"
          value={`${sharePrice.toFixed(4)} ${assetToken?.symbol ?? ""}`}
        />
        <Metric
          label="Strategy return"
          value={`${strategyReturn >= 0 ? "+" : ""}${strategyReturn.toFixed(2)}%`}
        />
        <Metric
          label="Your position"
          value={`${userPositionValue.toFixed(4)} ${assetToken?.symbol ?? ""}`}
        />
        <Metric
          label="Your vault ownership"
          value={
            isConnected ? `${ownershipPercent.toFixed(2)}%` : "Connect wallet"
          }
        />
        <Metric
          label={isRebalance ? "Target allocation" : "Invested allocation"}
          value={
            isRebalance
              ? `${((targetAllocationBps ?? 0) / 100).toFixed(1)}%`
              : `${investedPercent.toFixed(1)}%`
          }
        />
      </section>
      <p className="metric-explanation">
        Return is measured in {assetToken?.symbol ?? "the deposit asset"} and
        includes execution spread plus price movement of the held{" "}
        {targetToken?.symbol ?? "target token"}.
      </p>

      <section className="vault-layout">
        <div className="panel">
          <h2>Fund your position</h2>
          <p className="balance-line">
            Wallet balance: {formatAmount(depositSourceBalance, assetDecimals)}{" "}
            {assetToken?.symbol}
          </p>
          {isDemoMode && assetToken?.isTestToken && (
            <button
              className="secondary-button"
              disabled={!isConnected || Boolean(pendingAction)}
              onClick={() => runAction("faucet")}
            >
              {pendingAction === "faucet"
                ? "Requesting…"
                : `Get demo ${assetToken?.symbol ?? "tokens"}`}
            </button>
          )}
          <label>
            Deposit amount
            <input
              inputMode="decimal"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              placeholder="100"
            />
          </label>
          {depositUnits > 0n && !hasDepositBalance && (
            <p className="form-error">
              Insufficient {assetToken?.symbol ?? "token"} balance.
              {isDemoMode &&
                assetToken?.isTestToken &&
                ` Use “Get demo ${assetToken?.symbol ?? "tokens"}” first.`}
            </p>
          )}
          {acceptsNative ? (
            <button
              className="primary-button full"
              disabled={
                !isConnected ||
                depositUnits === 0n ||
                !hasDepositBalance ||
                Boolean(pendingAction)
              }
              onClick={() => runAction("nativeDeposit")}
            >
              {pendingAction === "nativeDeposit"
                ? "Wrapping and depositing…"
                : "Deposit Monad"}
            </button>
          ) : (
            <div className="action-row">
              <button
                className="secondary-button"
                disabled={
                  !isConnected || depositUnits === 0n || Boolean(pendingAction)
                }
                onClick={() => runAction("approve")}
              >
                {pendingAction === "approve" ? "Approving…" : "1. Approve"}
              </button>
              <button
                className="primary-button"
                disabled={
                  !isConnected ||
                  depositUnits === 0n ||
                  !hasDepositBalance ||
                  (allowance ?? 0n) < depositUnits ||
                  Boolean(pendingAction)
                }
                onClick={() => runAction("deposit")}
              >
                {pendingAction === "deposit" ? "Depositing…" : "2. Deposit"}
              </button>
            </div>
          )}

          <div className="panel-divider" />
          <label>
            Withdraw assets
            <input
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="50"
            />
          </label>
          <button
            className="secondary-button full"
            disabled={
              !isInvestor || withdrawUnits === 0n || Boolean(pendingAction)
            }
            onClick={() => runAction("withdraw")}
          >
            {pendingAction === "withdraw" ? "Withdrawing…" : "Withdraw"}
          </button>
          {acceptsNative && (
            <p className="form-note">
              Withdrawals return wrapped Monad, which can be unwrapped 1:1 to
              Monad.
            </p>
          )}
          {actionError && <p className="form-error">{actionError}</p>}
          {transactionHash && (
            <p className="form-success">
              Transaction confirmed:{" "}
              <a
                href={transactionExplorerUrl(transactionHash)}
                rel="noreferrer"
                target="_blank"
              >
                {shortAddress(transactionHash)} ↗
              </a>
            </p>
          )}
        </div>

        <div className="panel">
          <h2>Execution status</h2>
          <dl className="detail-list">
            <div>
              <dt>Executions</dt>
              <dd>{displayedExecutionCount?.toString() ?? "0"}</dd>
            </div>
            {isRebalance ? (
              <>
                <div>
                  <dt>Current target allocation</dt>
                  <dd>
                    {(Number(currentAllocationBps ?? 0n) / 100).toFixed(2)}%
                  </dd>
                </div>
                <div>
                  <dt>Target allocation</dt>
                  <dd>{((targetAllocationBps ?? 0) / 100).toFixed(2)}%</dd>
                </div>
                <div>
                  <dt>Allowed drift</dt>
                  <dd>±{((thresholdBps ?? 0) / 100).toFixed(2)}%</dd>
                </div>
                <div>
                  <dt>Rebalance status</dt>
                  <dd>{rebalanceNeeded ? "Outside band" : "Inside band"}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Tranche</dt>
                <dd>
                  {formatAmount(amountPerSwap, assetDecimals)}{" "}
                  {assetToken?.symbol}
                </dd>
              </div>
            )}
            <div>
              <dt>{isRebalance ? "Minimum interval" : "Frequency"}</dt>
              <dd>{formatInterval(displayedInterval)}</dd>
            </div>
            <div>
              <dt>Max slippage</dt>
              <dd>{((displayedSlippageBps ?? 0) / 100).toFixed(2)}%</dd>
            </div>
            <div>
              <dt>Next execution</dt>
              <dd>
                {displayedNextExecution
                  ? new Date(
                      Number(displayedNextExecution) * 1000,
                    ).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Idle assets</dt>
              <dd>
                {formatAmount(idleAssets, assetDecimals)} {assetToken?.symbol}
              </dd>
            </div>
            <div>
              <dt>Target balance</dt>
              <dd>
                {formatAmount(targetBalance, targetDecimals)}{" "}
                {targetToken?.symbol}
              </dd>
            </div>
            {isRebalance ? (
              <div>
                <dt>Total rebalanced</dt>
                <dd>
                  {formatAmount(totalRebalanced, assetDecimals)}{" "}
                  {assetToken?.symbol}
                </dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>Total invested</dt>
                  <dd>
                    {formatAmount(totalAssetsInvested, assetDecimals)}{" "}
                    {assetToken?.symbol}
                  </dd>
                </div>
                <div>
                  <dt>Total acquired</dt>
                  <dd>
                    {formatAmount(totalTargetAcquired, targetDecimals)}{" "}
                    {targetToken?.symbol}
                  </dd>
                </div>
              </>
            )}
          </dl>
          <button
            className="primary-button full"
            disabled={
              !isConnected ||
              !due ||
              (isRebalance ? !rebalanceNeeded : !idleAssets) ||
              Boolean(pendingAction)
            }
            onClick={() => runAction("execute")}
          >
            {pendingAction === "execute"
              ? "Executing…"
              : !due
                ? "Waiting for schedule"
                : isRebalance
                  ? rebalanceNeeded
                    ? "Rebalance now"
                    : "Allocation inside band"
                  : "Execute DCA now"}
          </button>
          <p className="form-note">
            Anyone may execute when eligible. The keeper does this
            automatically.
          </p>
        </div>
      </section>

      <section className="activity-section">
        <div className="activity-heading">
          <div>
            <p className="eyebrow">Onchain activity</p>
            <h2>Recent {isRebalance ? "rebalances" : "executions"}</h2>
          </div>
        </div>
        {activityError && <p className="form-error">{activityError}</p>}
        {isActivityLoading ? (
          <p className="empty-state compact">Loading onchain activity…</p>
        ) : executions.length === 0 ? (
          <p className="empty-state compact">
            No {isRebalance ? "rebalances" : "DCA swaps"} have executed yet. The
            keeper backend may not currently be live.
          </p>
        ) : (
          <div className="activity-list">
            {executions.slice(0, 10).map((execution) => (
              <article key={execution.transactionHash}>
                <div>
                  <strong>
                    {formatAmount(
                      execution.assetsIn,
                      tokenDetails(execution.tokenIn)?.decimals ??
                        assetDecimals,
                    )}{" "}
                    {tokenDetails(execution.tokenIn)?.symbol ??
                      assetToken?.symbol}{" "}
                    {isRebalance ? "swapped" : "invested"}
                  </strong>
                  <span>by {shortAddress(execution.executor)}</span>
                </div>
                <div>
                  <strong>
                    {formatAmount(
                      execution.targetTokensOut,
                      tokenDetails(execution.tokenOut)?.decimals ??
                        targetDecimals,
                    )}{" "}
                    {tokenDetails(execution.tokenOut)?.symbol ??
                      targetToken?.symbol}{" "}
                    acquired
                  </strong>
                  <span>
                    block {execution.blockNumber.toString()} ·{" "}
                    <a
                      href={transactionExplorerUrl(execution.transactionHash)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      view transaction ↗
                    </a>
                  </span>
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
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatAmount(value: bigint | undefined, decimals: number) {
  return Number(formatUnits(value ?? 0n, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
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
