# Cadence

Permissionless ERC-4626 investment strategies on Monad. The one-day hackathon MVP supports DCA and threshold-rebalance vaults. Anyone can create and invest in a vault, and anyone can execute an eligible strategy action.

## Structure

```text
apps/web/   Next.js 16, TypeScript, wagmi, viem, RainbowKit
apps/keeper/ TypeScript keeper that executes due strategy actions
contracts/  Foundry, Solidity, OpenZeppelin ERC-4626
```

`VaultFactory` is the protocol-level entry point. It maps stable strategy IDs to strategy-specific deployers, records every created vault, and keeps vault creation permissionless. The owner curates strategy types so arbitrary malicious implementations cannot present themselves as protocol strategies.

`DCA_V1` invests a fixed tranche on a fixed schedule. `REBALANCE_V1` holds a configurable target-token allocation and trades back to its target only when the allocation leaves the configured drift band. Both are separate strategy factories behind the same primary `VaultFactory`. Vaults talk to `ISwapAdapter`, keeping DEX-specific routing outside both the vault and primary factory.

`ChainlinkOracleRegistry` provides USD-denominated pricing, stale-round protection, and the token allowlist. The hybrid hackathon deployment uses official testnet WMON plus clearly labelled tUSDC and tWETH. A `NativeDepositRouter` wraps faucet MON 1:1 and deposits WMON in one transaction, because ERC-4626 assets must be ERC-20 tokens. Every vault calculates its own minimum swap output from Chainlink and its immutable `maxSlippageBps`; a keeper cannot weaken this protection.

The deployed hackathon demo uses a finite-inventory test swap adapter rather than minting output on each trade. It starts with 0.1 official WMON, 1,000,000 tUSDC, and 500 tWETH, values trades at 99.5% of the Chainlink-derived quote, and fails when output inventory is insufficient. Its keeper reads the standard Chainlink MON/USD, ETH/USD, and USDC/USD feeds on Monad mainnet and relays only newer rounds to testnet. Relayed prices expire after two hours, so swaps stop if the relay stops.

The upstream Chainlink proxy addresses used by the keeper are:

| Feed | Monad mainnet Chainlink proxy |
| --- | --- |
| MON/USD | `0xBcD78f76005B7515837af6b50c7C52BCf73822fb` |
| ETH/USD | `0x1B1414782B859871781bA3E4B0979b9ca57A0A04` |
| USDC/USD | `0xf5F15f188AbCB0d165D1Edb7f37F7d6fA2fCebec` |

The relay copies Chainlink's on-chain answer and original `updatedAt` timestamp rather than inventing a fresh timestamp. The oracle rejects non-positive, incomplete, future-dated, and stale rounds.

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

Open `/` to create a strategy, `/vaults` to browse strategies, and `/vaults/<address>` to deposit, withdraw, execute, and inspect metrics. MON deposits use native faucet MON and are wrapped into official WMON automatically. For tUSDC or tWETH deposits, use the in-app test-token faucet before approving. Wallet roles are derived on chain: the factory owner is the protocol admin, `vaultCreator` identifies the creator, and a nonzero share balance identifies an investor.

The supplied Alchemy testnet RPC and Reown project ID live in the gitignored `apps/web/.env.local`. Copy `apps/web/.env.example` when setting up another machine.

Run all checks:

```bash
pnpm lint
pnpm build
pnpm keeper:check
pnpm contracts:test
```

## Deploy

### Current Monad testnet demo

| Contract | Address |
| --- | --- |
| VaultFactory | `0x8947670a7C9147BA258234aE7FdEE6191e95fd1f` |
| DcaStrategyFactory | `0xf96cb71BB6BC01312Afadab939aCCAd6531db9f6` |
| RebalanceStrategyFactory | `0x2284f98F4e1685DFCE6B092bb29fcC28DF91a07d` |
| ChainlinkOracleRegistry | `0x20EE4F01b31b4D2846Da3a436C3013785bDfC9Fd` |
| InventorySwapAdapter | `0x4D7f5029f4154c7B998a69ea521C75E72d3e4C68` |
| NativeDepositRouter | `0x00EA9027E3601608ab1B0A68b5753Fd2A4F2b82F` |
| Test USDC | `0x37F8f050Bb677e588c60F4614D24CAe2d9a0B324` |
| Official WMON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Test WETH | `0x9cF74BaFaabAeB901C7d88b195d72F6D497487e9` |
| USDC/USD relay | `0xFfFf324649aB0D50eBeD4bb83c90fc7C5Cc7dac2` |
| MON/USD relay | `0x910EB659119Eac93001e192f1B2Cc7c038A61CA5` |
| ETH/USD relay | `0x0b406fB7F796B4387cdBa4815bCf7B6Ca46C56d6` |

The replacement factory starts with no vaults so strategies created through the frontend belong to the connected creator. Local ignored env files already point the web app and keeper at this deployment.

### Production-style deployment

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

The keeper is not trusted with slippage. It relays newer standard Chainlink mainnet rounds into the demo feeds, calls `executeDca()` for due DCA vaults, and calls `rebalance()` only for due rebalance vaults outside their allocation band. Each vault reads the on-chain oracle and calculates its own minimum output.

```bash
cp apps/keeper/.env.example apps/keeper/.env.local
```

Set a funded testnet keeper key and the deployed primary factory:

```text
MONAD_RPC_URL=https://monad-testnet.g.alchemy.com/v2/...
KEEPER_PRIVATE_KEY=0x...
VAULT_FACTORY_ADDRESS=0x...
TESTNET_MON_USD_FEED=0x...
TESTNET_ETH_USD_FEED=0x...
TESTNET_USDC_USD_FEED=0x...
POLL_INTERVAL_MS=15000
```

Then run:

```bash
pnpm keeper
```

The worker simulates every due execution, estimates its gas, applies a 10% buffer, submits, and waits for the receipt. Keep the keeper key in `.env.local` and fund it only with the MON needed for gas.

## MVP boundaries

- Execution is permissionless but not incentivized yet; a keeper or user must call `executeDca` or `rebalance`.
- tUSDC, tWETH, relayed feeds, and `InventorySwapAdapter` are testnet-only and centrally administered. MON/WMON is the official testnet asset. The adapter mimics finite DEX liquidity and must never be used with real value.
- Chainlink pricing and stale-round validation protect valuation and swap slippage, but deployment feed addresses and staleness thresholds must be reviewed carefully.
- A withdrawal may unwind the entire target position to satisfy ERC-4626 liquidity. Oracle slippage protection is enforced, but a production version should add exact-output routing to avoid unnecessary position sales.
- The contracts have unit tests, but they are unaudited and should only be used on testnet.

A natural next strategy is scheduled ERC-4626-to-ERC-4626 allocation behind another vault implementation while reusing the factory/UI patterns.
