# Contracts

- `DcaVault.sol`: ERC-4626 vault with permissionless scheduled tranche execution.
- `DcaVaultFactory.sol`: permissionless registry/factory using a fixed swap adapter.
- `interfaces/ISwapAdapter.sol`: boundary for a reviewed, DEX-specific adapter.
- `script/DeployFactory.s.sol`: Foundry deployment script.
- `test/DcaVault.t.sol`: factory, deposit, scheduling, execution, valuation, and unwind tests.

```bash
forge build --root contracts
forge test --root contracts --offline
```

This hackathon implementation is unaudited. See the root README for the explicit MVP limitations.
