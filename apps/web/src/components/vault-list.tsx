"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import {
  dcaVaultAbi,
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
  const { data: owner } = useReadContract({
    address: vaultFactoryAddress,
    abi: vaultFactoryAbi,
    functionName: "owner",
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
  const vaults = (vaultResults ?? [])
    .map((result) => result.result as Address | undefined)
    .filter((vault): vault is Address => Boolean(vault));

  const isAdmin = Boolean(
    account && owner && account.toLowerCase() === owner.toLowerCase(),
  );

  if (!vaultFactoryAddress) {
    return <p className="empty-state">The protocol has not been deployed yet.</p>;
  }

  return (
    <>
      <div className="dashboard-toolbar">
        <div className="filter-tabs">
          {(["all", "created", "invested"] as const).map((value) => (
            <button
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All vaults" : value === "created" ? "Created by me" : "My investments"}
            </button>
          ))}
        </div>
        {isAdmin && <span className="role-badge admin">Protocol admin</span>}
      </div>

      {isLoading ? (
        <p className="empty-state">Loading vaults…</p>
      ) : vaults.length === 0 ? (
        <p className="empty-state">No strategies yet. Create the first one.</p>
      ) : (
        <div className="vault-grid">
          {vaults.map((vault) => (
            <VaultCard account={account} filter={filter} key={vault} vault={vault} />
          ))}
        </div>
      )}
    </>
  );
}

function VaultCard({
  account,
  filter,
  vault,
}: {
  account?: Address;
  filter: Filter;
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
  const assetToken = tokenDetails(asset);
  const targetToken = tokenDetails(target);
  const isCreator = Boolean(
    account && creator && account.toLowerCase() === creator.toLowerCase(),
  );
  const isInvestor = Boolean(userShares && userShares > 0n);

  if (filter === "created" && !isCreator) return null;
  if (filter === "invested" && !isInvestor) return null;

  const decimals = assetToken?.decimals ?? 18;
  const assets = Number(formatUnits(totalAssets ?? 0n, decimals));
  const shares = Number(formatUnits(totalSupply ?? 0n, decimals));
  const sharePrice = shares > 0 ? assets / shares : 1;

  return (
    <Link className="vault-card" href={`/vaults/${vault}`}>
      <div className="vault-card-topline">
        <span className="strategy-pill">DCA</span>
        <div className="role-badges">
          {isCreator && <span className="role-badge">Creator</span>}
          {isInvestor && <span className="role-badge investor">Investor</span>}
        </div>
      </div>
      <h2>{name ?? "Loading strategy…"}</h2>
      <p className="vault-symbol">{symbol ?? "—"}</p>
      <div className="pair-line">
        <strong>{assetToken?.symbol ?? "Asset"}</strong>
        <span>→</span>
        <strong>{targetToken?.symbol ?? "Target"}</strong>
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
    </Link>
  );
}
