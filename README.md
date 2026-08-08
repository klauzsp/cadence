# Cadence

Permissionless ERC-4626 investment strategies on Monad. The one-day hackathon MVP supports DCA vaults: anyone can create a vault with a deposit asset, target token, fixed tranche, and execution interval; anyone can execute a due tranche.

## Structure

```text
apps/web/   Next.js 16, TypeScript, wagmi, viem, RainbowKit
contracts/  Foundry, Solidity, OpenZeppelin ERC-4626
```

The Solidity core is intentionally DEX-agnostic. `DcaVault` talks to `ISwapAdapter`; the factory is deployed with one reviewed adapter, while vault creation stays permissionless. This is the clean seam for adding a Monad DEX after choosing its testnet liquidity venue.

## Run locally

Requirements: Node 22+, pnpm 10+, and Foundry.

```bash
pnpm install
forge install --root contracts --no-git foundry-rs/forge-std
forge install --root contracts --no-git OpenZeppelin/openzeppelin-contracts
pnpm dev
```

The supplied Alchemy testnet RPC and Reown project ID live in the gitignored `apps/web/.env.local`. Copy `apps/web/.env.example` when setting up another machine.

Run all checks:

```bash
pnpm lint
pnpm build
pnpm contracts:test
```

## Deploy

1. Implement and test an `ISwapAdapter` for the chosen Monad testnet DEX. Its `quote` must value `tokenIn` in `tokenOut`, and `swapExactInput` must pull `tokenIn` from the calling vault.
2. Fund the deployer with testnet MON.
3. Keep the private key out of the repository and run:

```bash
export MONAD_RPC_URL="https://monad-testnet.g.alchemy.com/v2/..."
export PRIVATE_KEY="..."
export SWAP_ADAPTER_ADDRESS="0x..."
forge script contracts/script/DeployFactory.s.sol:DeployFactory \
  --root contracts \
  --rpc-url "$MONAD_RPC_URL" \
  --broadcast
```

4. Set the deployed factory in `apps/web/.env.local`:

```text
NEXT_PUBLIC_DCA_FACTORY_ADDRESS=0x...
```

5. Restart `pnpm dev`.

## MVP boundaries

- Execution is permissionless but not incentivized yet; a keeper or user must call `executeDca`.
- Vault valuation depends on the adapter quote. A production adapter must use a manipulation-resistant oracle/TWAP rather than a manipulable spot quote.
- A withdrawal may unwind the entire target position to satisfy ERC-4626 liquidity. A production version should add exact-output routing and explicit withdrawal slippage protection.
- The contracts have unit tests, but they are unaudited and should only be used on testnet.

Natural next strategies are Rebalance and scheduled ERC-4626-to-ERC-4626 allocation, both behind separate vault implementations while reusing the factory/UI patterns.
