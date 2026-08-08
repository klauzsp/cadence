# Deployment

The web app and keeper have different runtime requirements:

- Deploy `apps/web` to Vercel.
- Deploy the keeper as an always-on Railway worker from the same repository.

The keeper is intentionally a worker rather than a web API. It polls the factory, relays newer Chainlink prices, and submits due strategy transactions every five seconds. It does not need a public domain, database, or HTTP server.

## 1. Push the repository

Commit and push the repository to GitHub yourself. Local environment files are ignored by Git and must not be committed.

## 2. Deploy the frontend to Vercel

1. In Vercel, select **Add New → Project** and import the GitHub repository.
2. Set **Root Directory** to `apps/web`.
3. Leave the detected framework as **Next.js**.
4. Add the following Production, Preview, and Development environment variables by copying their existing values from `apps/web/.env.local`:

```text
NEXT_PUBLIC_MONAD_RPC_URL
NEXT_PUBLIC_MONAD_EXPLORER_URL
NEXT_PUBLIC_REOWN_PROJECT_ID
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS
NEXT_PUBLIC_NATIVE_DEPOSIT_ROUTER_ADDRESS
NEXT_PUBLIC_PROTOCOL_DEPLOYMENT_BLOCK
NEXT_PUBLIC_DEMO_MODE
NEXT_PUBLIC_USDC_ADDRESS
NEXT_PUBLIC_WMON_ADDRESS
NEXT_PUBLIC_WETH_ADDRESS
```

5. Deploy. Vercel should install with pnpm and run the web app's `build` script automatically.

All frontend variables are public by design. Never add `KEEPER_PRIVATE_KEY` to Vercel or prefix it with `NEXT_PUBLIC_`.

## 3. Deploy the keeper to Railway

1. In Railway, create a project and select **Deploy from GitHub repo** using this repository.
2. Keep the service root at the repository root so pnpm can use the workspace lockfile.
3. Railway will read `/railway.toml`, compile `apps/keeper` and start the worker.
4. Add these service variables, copying the deployed values from `apps/keeper/.env.local`:

```text
MONAD_RPC_URL
MONAD_MAINNET_RPC_URL
KEEPER_PRIVATE_KEY
VAULT_FACTORY_ADDRESS
TESTNET_MON_USD_FEED
TESTNET_ETH_USD_FEED
TESTNET_USDC_USD_FEED
POLL_INTERVAL_MS=5000
```

5. Deploy and inspect the service logs. A healthy start includes a line beginning with `Keeper 0x... relaying Chainlink prices and watching factory 0x...`.

Do not generate a Railway domain: the worker does not receive requests. Set only one keeper replica to avoid duplicate transaction races and unnecessary gas spending.

Use a dedicated keeper key with only a small amount of testnet MON. The key pays only for oracle relay updates and eligible strategy executions; deposits cannot be taken from it by the keeper code.

## 4. Smoke test

1. Open the Vercel URL and connect a wallet on Monad testnet.
2. Create a DCA vault with a five-second frequency.
3. Deposit a small amount of MON through the native deposit flow.
4. Watch Railway logs for `Executing ...` followed by `Executed ... in block ...`.
5. Refresh the vault dashboard and confirm the execution appears in Recent transactions with a Monad explorer link.

The worker polls every five seconds, but execution time also depends on transaction inclusion and receipt confirmation.
