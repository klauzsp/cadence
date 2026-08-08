"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  BaseError,
  decodeEventLog,
  encodeAbiParameters,
  isAddress,
  parseUnits,
  type Address,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { monadTestnet } from "wagmi/chains";
import {
  dcaConfigParameters,
  dcaStrategyId,
  rebalanceConfigParameters,
  rebalanceStrategyId,
  transactionExplorerUrl,
  isDemoMode,
  supportedTokens,
  tokenDetails,
  vaultFactoryAbi,
  vaultFactoryAddress,
} from "@/lib/contracts";

const frequencies = [
  { label: "Every 5 seconds (demo)", seconds: 5 },
  { label: "Every minute", seconds: 60 },
  { label: "Every hour", seconds: 3_600 },
  { label: "Every day", seconds: 86_400 },
  { label: "Every week", seconds: 604_800 },
];
const maxSlippageBps = 100;

export function CreateStrategyForm() {
  const { address: account, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { isPending: isSwitchingChain, switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [strategy, setStrategy] = useState<"dca" | "rebalance">("dca");
  const [asset, setAsset] = useState<Address>(supportedTokens[0].address);
  const [target, setTarget] = useState<Address>(supportedTokens[2].address);
  const [amount, setAmount] = useState(isDemoMode ? "100" : "");
  const [frequency, setFrequency] = useState(
    frequencies[isDemoMode ? 0 : 2].seconds,
  );
  const [targetAllocation, setTargetAllocation] = useState("50");
  const [threshold, setThreshold] = useState("5");
  const [name, setName] = useState("My DCA Strategy");
  const [symbol, setSymbol] = useState("DCA");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [createdVault, setCreatedVault] = useState<Address>();
  const [createdTransaction, setCreatedTransaction] = useState<`0x${string}`>();

  const decimals = tokenDetails(asset)?.decimals;

  const canSubmit = useMemo(
    () =>
      isConnected &&
      chainId === monadTestnet.id &&
      Boolean(vaultFactoryAddress) &&
      isAddress(asset) &&
      isAddress(target) &&
      asset.toLowerCase() !== target.toLowerCase() &&
      (strategy === "rebalance" || Number(amount) > 0) &&
      (strategy === "dca" ||
        (Number(targetAllocation) > 0 &&
          Number(targetAllocation) < 100 &&
          Number(threshold) > 0 &&
          Number(threshold) < Number(targetAllocation) &&
          Number(targetAllocation) + Number(threshold) < 100)) &&
      decimals !== undefined &&
      name.length > 0 &&
      symbol.length > 0,
    [
      amount,
      asset,
      chainId,
      decimals,
      isConnected,
      name,
      strategy,
      symbol,
      target,
      targetAllocation,
      threshold,
    ],
  );

  const submitHint = !isConnected
    ? "Connect your wallet above to create a strategy."
    : chainId !== monadTestnet.id
      ? "Switch your wallet to Monad testnet."
      : asset.toLowerCase() === target.toLowerCase()
        ? "Deposit and target tokens must be different."
        : strategy === "dca" &&
            (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
          ? "Enter an amount greater than zero."
          : strategy === "rebalance" &&
              (!Number.isFinite(Number(targetAllocation)) ||
                !Number.isFinite(Number(threshold)) ||
                Number(targetAllocation) <= 0 ||
                Number(targetAllocation) >= 100 ||
                Number(threshold) <= 0 ||
                Number(threshold) >= Number(targetAllocation) ||
                Number(targetAllocation) + Number(threshold) >= 100)
            ? "Choose a valid target and drift band that stay between 0% and 100%."
            : !name.trim() || !symbol.trim()
              ? "Enter a vault name and share symbol."
              : undefined;

  function selectStrategy(nextStrategy: "dca" | "rebalance") {
    setStrategy(nextStrategy);
    setName(
      nextStrategy === "dca" ? "My DCA Strategy" : "My Balanced Strategy",
    );
    setSymbol(nextStrategy === "dca" ? "DCA" : "BAL");
  }

  async function createStrategy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !canSubmit ||
      !vaultFactoryAddress ||
      decimals === undefined ||
      !account ||
      !publicClient ||
      !walletClient
    )
      return;

    setIsPending(true);
    setError(undefined);
    setCreatedVault(undefined);
    setCreatedTransaction(undefined);

    const initData =
      strategy === "dca"
        ? encodeAbiParameters(dcaConfigParameters, [
            asset as Address,
            target as Address,
            parseUnits(amount, decimals),
            BigInt(frequency),
            maxSlippageBps,
            name,
            symbol,
          ])
        : encodeAbiParameters(rebalanceConfigParameters, [
            asset as Address,
            target as Address,
            Math.round(Number(targetAllocation) * 100),
            Math.round(Number(threshold) * 100),
            BigInt(frequency),
            maxSlippageBps,
            name,
            symbol,
          ]);

    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: vaultFactoryAddress,
        abi: vaultFactoryAbi,
        functionName: "createVault",
        args: [
          strategy === "dca" ? dcaStrategyId : rebalanceStrategyId,
          initData,
        ],
      });
      const estimate = await publicClient.estimateContractGas(request);
      const hash = await walletClient.writeContract({
        ...request,
        gas: estimate + estimate / 10n,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setCreatedTransaction(hash);

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: vaultFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "VaultCreated") {
            setCreatedVault(decoded.args.vault);
            break;
          }
        } catch {
          // The transaction also contains constructor events from the new vault.
        }
      }
    } catch (caught) {
      setError(
        caught instanceof BaseError
          ? caught.shortMessage
          : caught instanceof Error
            ? caught.message
            : "Strategy creation failed",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="strategy-form" onSubmit={createStrategy}>
      <div className="form-heading">
        <div>
          <p className="eyebrow">New vault</p>
          <h2>Build your strategy</h2>
        </div>
      </div>

      <fieldset className="strategy-choice">
        <legend>Strategy type</legend>
        <div className="strategy-toggle">
          <button
            aria-pressed={strategy === "dca"}
            onClick={() => selectStrategy("dca")}
            type="button"
          >
            <span>DCA</span>
            Fixed purchases
          </button>
          <button
            aria-pressed={strategy === "rebalance"}
            onClick={() => selectStrategy("rebalance")}
            type="button"
          >
            <span>Rebalance</span>
            Allocation band
          </button>
        </div>
      </fieldset>

      <div className="field-row metadata-row">
        <label>
          Vault name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Share symbol
          <input
            maxLength={10}
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
          />
        </label>
      </div>

      <div className="field-row">
        <label>
          Deposit token
          <select
            value={asset}
            onChange={(event) => {
              const nextAsset = event.target.value as Address;
              setAsset(nextAsset);
              setAmount(
                tokenDetails(nextAsset)?.acceptsNative
                  ? "0.01"
                  : tokenDetails(nextAsset)?.decimals === 6
                    ? "100"
                    : "0.01",
              );
            }}
          >
            {supportedTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target token
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value as Address)}
          >
            {supportedTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`field-row parameter-grid ${strategy}`}>
        {strategy === "dca" ? (
          <label>
            Amount per swap
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="100"
            />
          </label>
        ) : (
          <div className="allocation-inputs">
            <label>
              Target %
              <input
                inputMode="decimal"
                value={targetAllocation}
                onChange={(event) => setTargetAllocation(event.target.value)}
              />
            </label>
            <label>
              Drift %
              <input
                inputMode="decimal"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </label>
          </div>
        )}
        <label>
          {strategy === "dca" ? "Frequency" : "Minimum interval"}
          <select
            value={frequency}
            onChange={(event) => setFrequency(Number(event.target.value))}
          >
            {frequencies.map((option) => (
              <option key={option.seconds} value={option.seconds}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!vaultFactoryAddress && (
        <p className="form-note">
          Deploy the protocol, then set{" "}
          <code>NEXT_PUBLIC_VAULT_FACTORY_ADDRESS</code>.
        </p>
      )}

      {submitHint && <p className="form-note">{submitHint}</p>}
      {error && <p className="form-error">{error}</p>}
      {createdVault && (
        <p className="form-success">
          Strategy created.{" "}
          <Link href={`/vaults/${createdVault}`}>Open dashboard</Link>
          {createdTransaction && (
            <>
              {" "}
              ·{" "}
              <a
                href={transactionExplorerUrl(createdTransaction)}
                rel="noreferrer"
                target="_blank"
              >
                View transaction ↗
              </a>
            </>
          )}
        </p>
      )}

      <button
        className="submit-button"
        disabled={
          isPending ||
          isSwitchingChain ||
          (isConnected && chainId === monadTestnet.id && !canSubmit)
        }
        onClick={
          !isConnected
            ? openConnectModal
            : chainId !== monadTestnet.id
              ? () => switchChain({ chainId: monadTestnet.id })
              : undefined
        }
        type={isConnected && chainId === monadTestnet.id ? "submit" : "button"}
      >
        {!isConnected
          ? "Connect wallet and create"
          : chainId !== monadTestnet.id
            ? isSwitchingChain
              ? "Switching network…"
              : "Switch to Monad testnet"
            : isPending
              ? "Confirm in wallet…"
              : strategy === "dca"
                ? "Create DCA strategy"
                : "Create rebalance strategy"}
      </button>
    </form>
  );
}
