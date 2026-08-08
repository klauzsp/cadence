"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import {
  dcaVaultAbi,
  rebalanceStrategyId,
  tokenDetails,
  vaultFactoryAbi,
  vaultFactoryAddress,
} from "@/lib/contracts";

type Filter = "all" | "created" | "invested";

export function VaultList() {
  const { address: account } = useAccount();
  const [filter, setFilter] = useState<Filter>("all");
  const { data: count, isLoading } = useReadContract({
    address: vaultFactoryAddress,
    abi: vaultFactoryAbi,
    functionName: "vaultCount",
    query: { enabled: Boolean(vaultFactoryAddress) },
  });
  const vaultContracts = useMemo(
    () =>
      Array.from({ length: Number(count ?? 0n) }, (_, index) => ({
        address: vaultFactoryAddress as Address,
        abi: vaultFactoryAbi,
        functionName: "vaultAt" as const,
        args: [BigInt(index)] as const,
      })),
    [count],
  );
  const { data: vaultResults } = useReadContracts({
    contracts: vaultContracts,
    query: { enabled: Boolean(vaultFactoryAddress && vaultContracts.length) },
  });
  const vaults = useMemo(
    () =>
      (vaultResults ?? [])
        .map((result) => result.result as Address | undefined)
        .filter((vault): vault is Address => Boolean(vault)),
    [vaultResults],
  );

  const rankingContracts = useMemo(
    () =>
      vaults.flatMap((vault) => [
        { address: vault, abi: dcaVaultAbi, functionName: "asset" as const },
        { address: vault, abi: dcaVaultAbi, functionName: "totalAssets" as const },
      ]),
    [vaults],
  );
  const { data: rankingResults, isLoading: isRanking } = useReadContracts({
    contracts: rankingContracts,
    query: { enabled: rankingContracts.length > 0 },
  });

  const rankedVaults = useMemo(
    () =>
      vaults
        .map((vault, index) => {
          const asset = rankingResults?.[index * 2].result as Address | undefined;
          const totalAssets = (rankingResults?.[index * 2 + 1].result as bigint | undefined) ?? 0n;
          const tvl = Number(formatUnits(totalAssets, tokenDetails(asset)?.decimals ?? 18));
          return { vault, tvl };
        })
        .sort((a, b) => b.tvl - a.tvl),
    [rankingResults, vaults],
  );

  if (!vaultFactoryAddress) {
    return <p className="empty-state">The protocol has not been deployed yet.</p>;
  }

  return (
    <>
      <div className="dashboard-toolbar">
        <div className="filter-tabs">
          {(["all", "created", "invested"] as const).map((value) => (
            <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>
              {value === "all" ? "All vaults" : value === "created" ? "Created by me" : "My investments"}
            </button>
          ))}
        </div>
      </div>

      {isLoading || isRanking ? (
        <p className="empty-state">Ranking vaults…</p>
      ) : rankedVaults.length === 0 ? (
        <p className="empty-state">No strategies yet. Create the first one.</p>
      ) : (
        <div className="vault-grid">
          {rankedVaults.map(({ vault }, index) => (
            <VaultCard account={account} filter={filter} key={vault} rank={index + 1} vault={vault} />
          ))}
        </div>
      )}
    </>
  );
}

function VaultCard({
  account,
  filter,
  rank,
  vault,
}: {
  account?: Address;
  filter: Filter;
  rank: number;
  vault: Address;
}) {
  const { data } = useReadContracts({
    contracts: [
      { address: vault, abi: dcaVaultAbi, functionName: "name" },
      { address: vault, abi: dcaVaultAbi, functionName: "symbol" },
      { address: vault, abi: dcaVaultAbi, functionName: "asset" },
      { address: vault, abi: dcaVaultAbi, functionName: "targetToken" },
      { address: vault, abi: dcaVaultAbi, functionName: "totalAssets" },
      { address: vault, abi: dcaVaultAbi, functionName: "totalSupply" },
      { address: vault, abi: dcaVaultAbi, functionName: "executionCount" },
      {
        address: vault,
        abi: dcaVaultAbi,
        functionName: "balanceOf",
        args: [account ?? "0x0000000000000000000000000000000000000000"],
      },
      {
        address: vaultFactoryAddress as Address,
        abi: vaultFactoryAbi,
        functionName: "vaultCreator",
        args: [vault],
      },
      {
        address: vaultFactoryAddress as Address,
        abi: vaultFactoryAbi,
        functionName: "vaultStrategy",
        args: [vault],
      },
    ],
  });

  const name = data?.[0].result as string | undefined;
  const symbol = data?.[1].result as string | undefined;
  const asset = data?.[2].result as Address | undefined;
  const target = data?.[3].result as Address | undefined;
  const totalAssets = data?.[4].result as bigint | undefined;
  const totalSupply = data?.[5].result as bigint | undefined;
  const executions = data?.[6].result as bigint | undefined;
  const userShares = data?.[7].result as bigint | undefined;
  const creator = data?.[8].result as Address | undefined;
  const strategyId = data?.[9].result as `0x${string}` | undefined;
  const isRebalance = strategyId === rebalanceStrategyId;
  const assetToken = tokenDetails(asset);
  const targetToken = tokenDetails(target);
  const isCreator = Boolean(account && creator && account.toLowerCase() === creator.toLowerCase());
  const isInvestor = Boolean(userShares && userShares > 0n);

  if (filter === "created" && !isCreator) return null;
  if (filter === "invested" && !isInvestor) return null;

  const decimals = assetToken?.decimals ?? 18;
  const assets = Number(formatUnits(totalAssets ?? 0n, decimals));
  const shares = Number(formatUnits(totalSupply ?? 0n, decimals));
  const sharePrice = shares > 0 ? assets / shares : 1;
  const rankLabel = rank === 1 ? "Champion" : rank <= 3 ? "Podium" : "Rank";

  return (
    <Link className={`vault-card leaderboard-row rank-${Math.min(rank, 4)}`} href={`/vaults/${vault}`}>
      <div className="vault-ranking">
        <span className="rank-badge">#{rank}</span>
        <small>{rankLabel}</small>
      </div>
      <div className="vault-overview">
        <div className="vault-card-topline">
          <span className="strategy-pill">{isRebalance ? "Rebalance" : "DCA"}</span>
        </div>
        <h2>{name ?? "Loading strategy…"}</h2>
        <div className="vault-row-meta">
          <span>{symbol ?? "—"}</span>
          <div className="pair-line">
            <strong>{assetToken?.symbol ?? "Asset"}</strong>
            <span>→</span>
            <strong>{targetToken?.symbol ?? "Target"}</strong>
          </div>
        </div>
      </div>
      <div className="card-metrics">
        <div>
          <span>TVL</span>
          <strong>{assets.toLocaleString(undefined, { maximumFractionDigits: 4 })} {assetToken?.symbol}</strong>
        </div>
        <div>
          <span>Share price</span>
          <strong>{sharePrice.toFixed(4)} {assetToken?.symbol}</strong>
        </div>
        <div>
          <span>Executions</span>
          <strong>{executions?.toString() ?? "0"}</strong>
        </div>
      </div>
      <span className="vault-row-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
