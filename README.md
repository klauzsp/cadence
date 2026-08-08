# Cadence

Permissionless ERC-4626 investment strategies on Monad. The one-day hackathon MVP supports DCA vaults: anyone can create a vault with a deposit asset, target token, fixed tranche, and execution interval; anyone can execute a due tranche.

## Structure

```text
apps/web/   Next.js 16, TypeScript, wagmi, viem, RainbowKit
apps/keeper/ TypeScript keeper that executes due DCA vaults
contracts/  Foundry, Solidity, OpenZeppelin ERC-4626
```

`VaultFactory` is the protocol-level entry point. It maps stable strategy IDs to strategy-specific deployers, records every created vault, and keeps vault creation permissionless. The owner curates strategy types so arbitrary malicious implementations cannot present themselves as protocol strategies.

`DCA_V1` is currently the only registered strategy. Its `DcaStrategyFactory` decodes DCA parameters and deploys `DcaVault` instances. The vault talks to `ISwapAdapter`, keeping DEX-specific routing outside both the vault and primary factory. Rebalance can later be added as another strategy factory without changing `VaultFactory`.

`ChainlinkOracleRegistry` provides USD-denominated pricing, stale-round protection, and the token allowlist. The UI offers the verified Monad testnet USDC, WMON, and WETH contracts as fixed dropdown choices. WMON is used instead of native MON because ERC-4626 assets are ERC-20 tokens. Every vault calculates its own minimum swap output from Chainlink and its immutable `maxSlippageBps`; a keeper cannot weaken this protection.

## Monad testnet addresses

The token contracts below come from the Monad Foundation testnet token list and returned the expected symbol and decimals on chain on 2026-08-08.

| Asset | Contract | Decimals |
| --- | --- | ---: |
| USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | 6 |
| WMON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` | 18 |
| WETH | `0x45477f4709771331db81944A5E20eF95Bc7BA2D7` | 18 |

Chainlink's historical Monad testnet reference-data endpoint contains these proxy addresses, but neither currently has bytecode on Monad testnet. They are recorded for investigation only and must not be used for deployment.

| Feed | Historical proxy | Current status |
| --- | --- | --- |
| ETH/USD | `0x0c76859E85727683Eeba0C70Bc2e0F5781337818` | No contract code |
| USDC/USD | `0x70BB0758a38ae43418ffcEd9A25273dd4e804D15` | No contract code |
| MON/USD | Not listed | Unavailable |

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
pnpm keeper:check
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
export USDC_ADDRESS="0x..."
export WMON_ADDRESS="0x..."
export WETH_ADDRESS="0x..."
export USDC_USD_FEED="0x..."
export MON_USD_FEED="0x..."
export ETH_USD_FEED="0x..."
export ORACLE_MAX_STALENESS="86400"
forge script contracts/script/DeployProtocol.s.sol:DeployProtocol \
  --root contracts \
  --rpc-url "$MONAD_RPC_URL" \
  --broadcast
```

Do not copy mainnet addresses into a testnet deployment. Chainlink announced Data Feeds on Monad testnet in May 2025, and its historical reference-data endpoint lists ETH/USD and USDC/USD proxies. Those historical proxies currently have no bytecode on chain, and the endpoint contains no MON/USD feed. The deployment therefore continues to require explicit feed addresses and must not be broadcast until all three addresses are independently verified as live after the latest testnet re-genesis.

4. Set the deployed factory in `apps/web/.env.local`:

```text
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=0x...
```

5. Restart `pnpm dev`.

## Keeper

The keeper is not trusted with pricing or slippage. It only discovers due DCA vaults and calls `executeDca()`; each vault reads Chainlink and calculates its own minimum output.

```bash
cp apps/keeper/.env.example apps/keeper/.env.local
```

Set a funded testnet keeper key and the deployed primary factory:

```text
MONAD_RPC_URL=https://monad-testnet.g.alchemy.com/v2/...
KEEPER_PRIVATE_KEY=0x...
VAULT_FACTORY_ADDRESS=0x...
POLL_INTERVAL_MS=15000
```

Then run:

```bash
pnpm keeper
```

The worker simulates every due execution, estimates its gas, applies a 10% buffer, submits, and waits for the receipt. Keep the keeper key in `.env.local` and fund it only with the MON needed for gas.

## MVP boundaries

- Execution is permissionless but not incentivized yet; a keeper or user must call `executeDca`.
- Chainlink pricing and stale-round validation protect valuation and swap slippage, but deployment feed addresses and staleness thresholds must be reviewed carefully.
- A withdrawal may unwind the entire target position to satisfy ERC-4626 liquidity. Oracle slippage protection is enforced, but a production version should add exact-output routing to avoid unnecessary position sales.
- The contracts have unit tests, but they are unaudited and should only be used on testnet.

Natural next strategies are Rebalance and scheduled ERC-4626-to-ERC-4626 allocation, both behind separate vault implementations while reusing the factory/UI patterns.
