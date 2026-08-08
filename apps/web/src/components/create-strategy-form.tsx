"use client";

import { useMemo, useState, type FormEvent } from "react";
import { encodeAbiParameters, isAddress, parseUnits, type Address } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  dcaConfigParameters,
  dcaStrategyId,
  erc20MetadataAbi,
  supportedTokens,
  vaultFactoryAbi,
  vaultFactoryAddress,
} from "@/lib/contracts";

const frequencies = [
  { label: "Every hour", seconds: 3_600 },
  { label: "Every day", seconds: 86_400 },
  { label: "Every week", seconds: 604_800 },
];

export function CreateStrategyForm() {
  const { isConnected } = useAccount();
  const [asset, setAsset] = useState<Address>(supportedTokens[0].address);
  const [target, setTarget] = useState<Address>(supportedTokens[2].address);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState(frequencies[1].seconds);
  const [maxSlippage, setMaxSlippage] = useState("1");
  const [name, setName] = useState("My DCA Strategy");
  const [symbol, setSymbol] = useState("DCA");

  const assetAddress = isAddress(asset) ? asset : undefined;
  const { data: decimals } = useReadContract({
    address: assetAddress,
    abi: erc20MetadataAbi,
    functionName: "decimals",
    query: { enabled: Boolean(assetAddress) },
  });

  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const canSubmit = useMemo(
    () =>
      isConnected &&
      Boolean(vaultFactoryAddress) &&
      isAddress(asset) &&
      isAddress(target) &&
      asset.toLowerCase() !== target.toLowerCase() &&
      Number(amount) > 0 &&
      Number(maxSlippage) >= 0 &&
      Number(maxSlippage) <= 10 &&
      decimals !== undefined &&
      name.length > 0 &&
      symbol.length > 0,
    [amount, asset, decimals, isConnected, maxSlippage, name, symbol, target],
  );

  function createStrategy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !vaultFactoryAddress || decimals === undefined) return;

    const initData = encodeAbiParameters(dcaConfigParameters, [
      asset as Address,
      target as Address,
      parseUnits(amount, decimals),
      BigInt(frequency),
      Math.round(Number(maxSlippage) * 100),
      name,
      symbol,
    ]);

    writeContract({
      address: vaultFactoryAddress,
      abi: vaultFactoryAbi,
      functionName: "createVault",
      args: [dcaStrategyId, initData],
    });
  }

  return (
    <form className="strategy-form" onSubmit={createStrategy}>
      <div className="form-heading">
        <div>
          <p className="eyebrow">New vault</p>
          <h2>Build your DCA</h2>
        </div>
        <span className="strategy-pill">ERC-4626</span>
      </div>

      <label>
        Vault name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <div className="field-row">
        <label>
          Deposit token
          <select
            value={asset}
            onChange={(event) => setAsset(event.target.value as Address)}
          >
            {supportedTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol} — {token.name}
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
                {token.symbol} — {token.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-row compact-row">
        <label>
          Amount per swap
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="100"
          />
        </label>
        <label>
          Frequency
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
        <label>
          Max slippage
          <input
            inputMode="decimal"
            value={maxSlippage}
            onChange={(event) => setMaxSlippage(event.target.value)}
            placeholder="1"
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

      {!vaultFactoryAddress && (
        <p className="form-note">
          Deploy the protocol, then set <code>NEXT_PUBLIC_VAULT_FACTORY_ADDRESS</code>.
        </p>
      )}
      <p className="form-note">Supported assets: USDC, wrapped MON, and wrapped ETH.</p>
      {error && <p className="form-error">{error.message}</p>}
      {isSuccess && <p className="form-success">Strategy created on Monad testnet.</p>}

      <button className="submit-button" disabled={!canSubmit || isPending || isConfirming}>
        {!isConnected
          ? "Connect wallet to continue"
          : isPending
            ? "Confirm in wallet…"
            : isConfirming
              ? "Creating strategy…"
              : "Create DCA strategy"}
      </button>
    </form>
  );
}
