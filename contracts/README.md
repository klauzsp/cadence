# Contracts

- `VaultFactory.sol`: primary protocol registry and permissionless vault-creation entry point.
- `interfaces/IStrategyFactory.sol`: common interface for strategy-specific deployers.
- `oracles/ChainlinkOracleRegistry.sol`: USD price registry, stale-feed checks, and token allowlist.
- `strategies/dca/DcaStrategyFactory.sol`: decodes DCA configuration and deploys DCA vaults.
- `strategies/dca/DcaVault.sol`: ERC-4626 vault with permissionless scheduled tranche execution.
- `interfaces/ISwapAdapter.sol`: boundary for a reviewed, DEX-specific adapter.
- `script/DeployProtocol.s.sol`: deploys the primary factory, DCA strategy factory, and registration.
- `script/DeployDemoProtocol.s.sol`: deploys faucet tokens, Chainlink relay feeds, a deterministic adapter, and the complete testnet demo.
- `demo/`: clearly marked test-only tokens, relayed feeds, and swap infrastructure.
- `test/VaultFactory.t.sol`: registry, allowlist, oracle, slippage, deposit, scheduling, valuation, and unwind tests.

Each strategy version has a stable ID, such as `keccak256("DCA_V1")`. The owner curates which strategy factories are registered; anyone can create a vault from a registered strategy. Adding Rebalance requires a new `IStrategyFactory`, not a new primary factory.

DCA vaults support only tokens configured in `ChainlinkOracleRegistry`. Disabling a token prevents new vaults while preserving oracle pricing for existing vaults. The deployment script configures USDC, WMON, and WETH from environment-provided token and Chainlink feed addresses. As of 2026-08-08, Chainlink's historical Monad testnet ETH/USD and USDC/USD proxies have no bytecode and no MON/USD feed is listed, so do not broadcast the deployment until active feed addresses are independently verified.

```bash
forge build --root contracts
forge test --root contracts --offline
```

This hackathon implementation is unaudited. See the root README for the explicit MVP limitations.
