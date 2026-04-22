# Troubleshooting Guide

Common issues and their solutions for developers and users of Fund-My-Cause.

---

## Wallet Connection Issues

### Freighter not detected / "Freighter connection failed"

**Symptom:** Clicking "Connect Wallet" shows an error or nothing happens.

**Causes & fixes:**
- The Freighter browser extension is not installed → install it from [freighter.app](https://www.freighter.app)
- The extension is installed but disabled → enable it in your browser's extension manager
- You are on a page served over `http://` in production → Freighter requires `https://` or `localhost`
- The extension needs a page refresh after first install → reload the tab

### Freighter is on the wrong network (buttons disabled)

**Symptom:** Contribute / Withdraw buttons are greyed out after connecting.

**Cause:** The `networkMismatch` flag is `true` — Freighter's selected network does not match `NEXT_PUBLIC_NETWORK_PASSPHRASE`.

**Fix:** Open the Freighter extension → click the network name at the top → switch to **Testnet** (or whichever network the app is configured for).

To verify the expected passphrase:
```bash
grep NEXT_PUBLIC_NETWORK_PASSPHRASE apps/interface/.env.local
# Should be: Test SDF Network ; September 2015
```

### LOBSTR / WalletConnect — "No Stellar account returned by LOBSTR"

**Symptom:** The WalletConnect QR modal opens but connection fails with `No Stellar account returned by LOBSTR` or `Could not parse address from LOBSTR session`.

**Causes & fixes:**
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is missing or empty in `.env.local` → get a free project ID at [cloud.walletconnect.com](https://cloud.walletconnect.com) and add it:
  ```bash
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
  ```
- The LOBSTR mobile app rejected or timed out the pairing request → retry and approve within 60 seconds
- The session expired → disconnect and reconnect

### Wallet disconnects on page refresh

**Cause:** Expected behaviour — the app stores the wallet address in `sessionStorage`, which is cleared when the browser tab is closed. On a same-tab refresh the session is restored automatically.

---

## Transaction Failure Scenarios

### "Transaction cancelled" toast

**Cause:** The user clicked "Reject" in the Freighter or LOBSTR signing prompt. No funds were moved.

**Fix:** Retry the action and approve the transaction in the wallet extension.

### "Network error, please try again"

**Cause:** The Soroban RPC or Horizon endpoint was unreachable when submitting the transaction. Matches errors containing `network`, `fetch`, `timeout`, or `connection`.

**Fix:**
- Check RPC status at [status.stellar.org](https://status.stellar.org)
- Verify `NEXT_PUBLIC_RPC_URL` and `NEXT_PUBLIC_HORIZON_URL` in `.env.local` are correct
- Retry after a few seconds

### "Submit failed" / `sendTransaction` returns `ERROR`

**Cause:** The Soroban RPC rejected the transaction envelope (e.g. bad sequence number, insufficient fee, malformed XDR).

**Fix:**
- Reload the page to refresh the account sequence number
- Ensure the account has enough XLM to cover the base fee (minimum ~0.00001 XLM)
- If using a custom RPC, confirm it is a Soroban-capable endpoint

### "Transaction not confirmed after polling"

**Cause:** The transaction was accepted by the RPC (`PENDING`) but did not reach `SUCCESS` or `FAILED` status within 30 seconds (20 polls × 1.5 s).

**Fix:**
- Check the transaction hash on [Stellar Expert](https://stellar.expert/explorer/testnet) to see its actual status
- The transaction may still confirm — wait a moment and refresh the campaign page
- If it failed on-chain, the error details will be visible in the Stellar Expert transaction view

### "This transaction requires a ledger entry restore"

**Cause:** `isSimulationRestore` was returned by the RPC — a contract storage entry has expired and needs to be restored before the transaction can proceed.

**Fix:** Wait a few seconds and retry. The app will attempt the transaction again once the entry is restored. If the issue persists, the contract's TTL may need to be extended by the deployer using `stellar contract extend`.

---

## RPC Endpoint Issues

### Simulation returns `HostError` / blank page on load

**Cause:** `NEXT_PUBLIC_RPC_URL` is pointing to a non-Soroban endpoint (e.g. a plain Horizon URL) or is unreachable.

**Fix:** Ensure the RPC URL is a Soroban RPC endpoint:
```bash
# Testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org

# Verify it responds
curl https://soroban-testnet.stellar.org -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":[]}'
# Expected: {"result":{"status":"healthy",...}}
```

### `getAccount` fails / "Account not found"

**Cause:** The connected wallet address has not been funded on testnet.

**Fix:** Fund the account using Friendbot:
```bash
curl "https://friendbot.stellar.org?addr=<YOUR_ADDRESS>"
```

Or visit [laboratory.stellar.org](https://laboratory.stellar.org/#account-creator?network=test).

### Rate limiting / 429 errors from public RPC

**Cause:** The public Soroban testnet RPC has rate limits. High-traffic local development can hit them.

**Fix:** Run a local RPC node or use a dedicated RPC provider. For testnet development, space out requests or add a short delay between retries.

---

## Contract Invocation Errors

The contract returns typed errors as `ContractError(N)` in simulation diagnostics. The full mapping:

| Code | Name | Triggered by | Fix |
|---|---|---|---|
| 1 | `AlreadyInitialized` | Calling `initialize` on an already-initialized contract | Deploy a new contract instance |
| 2 | `CampaignEnded` | Contributing after the deadline | The campaign is closed; no fix |
| 3 | `CampaignStillActive` | Calling `withdraw` or `refund_single` before the deadline | Wait until the deadline passes |
| 4 | `GoalNotReached` | Calling `withdraw` when `total_raised < goal` | Goal was not met; contributors should call `refund_single` |
| 5 | `GoalReached` | Calling `refund_single` when the goal was met | Goal was met; creator should call `withdraw` |
| 6 | `Overflow` | Contribution would cause `total_raised` to overflow `i128` | Extremely unlikely in practice |
| 7 | `NotActive` | Calling a state-changing function when status ≠ `Active` | Check campaign status before invoking |
| 8 | `InvalidFee` | Platform `fee_bps` > 10,000 during `initialize` | Use a value between 0 and 10,000 (e.g. 250 = 2.5%) |
| 9 | `BelowMinimum` | Contribution amount < `min_contribution` | Increase the contribution amount |
| 10 | `InvalidDeadline` | `deadline` ≤ current ledger timestamp during `initialize` or `extend_deadline` | Use a future Unix timestamp |
| 11 | `CampaignPaused` | Contributing while the campaign is paused | Wait for the creator to unpause |
| 12 | `InvalidGoal` | `goal` ≤ 0 during `initialize` | Use a positive goal value |
| 13 | `TokenNotAccepted` | Contributing with a token not in the accepted-tokens whitelist | Use the campaign's accepted token (check `token` field) |

### Parsing contract errors in the frontend

Simulation error strings look like `HostError: Value(ContractError(N))\n...`. Use the parser in `src/lib/soroban.ts`:

```ts
const match = raw.match(/ContractError\((\d+)\)/);
if (match) {
  const code = Number(match[1]); // map to the table above
}
```

---

## Local Development Issues

### App crashes at startup: "Missing required environment variable"

**Symptom:** `Error: Missing required environment variable: NEXT_PUBLIC_CONTRACT_ID. Copy apps/interface/.env.example to apps/interface/.env.local and fill in the values.`

**Fix:**
```bash
cp apps/interface/.env.example apps/interface/.env.local
# Then edit .env.local and fill in all required values
```

Required variables:

| Variable | Example value |
|---|---|
| `NEXT_PUBLIC_CONTRACT_ID` | `CABC...` (56-char contract address) |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` |

### `cargo build` fails: "can't find crate for `std`"

**Cause:** The `wasm32-unknown-unknown` target is not installed.

**Fix:**
```bash
rustup target add wasm32-unknown-unknown
```

### `deploy.sh` fails: "stellar: command not found"

**Fix:** Install the Stellar CLI (v21.0+):
```bash
# macOS
brew install stellar-cli

# Or via cargo
cargo install --locked stellar-cli --features opt
```

See the [official installation guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) for other platforms.

### `deploy.sh` — wrong argument order

The script expects positional arguments in this exact order:

```bash
./scripts/deploy.sh \
  <CREATOR_ADDRESS> \
  <TOKEN_ADDRESS> \
  <GOAL_IN_STROOPS> \
  <DEADLINE_UNIX_TIMESTAMP> \
  <MIN_CONTRIBUTION_IN_STROOPS> \
  "<TITLE>" \
  "<DESCRIPTION>" \
  <SOCIAL_LINKS_OR_null> \
  [REGISTRY_CONTRACT_ID]
```

Example:
```bash
DEADLINE=$(date -d "+30 days" +%s)
./scripts/deploy.sh \
  GCREATOR... \
  native \
  10000000000 \
  $DEADLINE \
  10000000 \
  "My Campaign" \
  "A great cause" \
  null
```

---

## Docker Issues

### App starts but shows blank page / "Missing required environment variable" in container logs

**Cause:** `NEXT_PUBLIC_*` variables are inlined at **build time** by Next.js. Passing them only at `docker run` time has no effect.

**Fix:** Pass all `NEXT_PUBLIC_*` variables as build arguments:
```bash
docker build \
  --build-arg NEXT_PUBLIC_CONTRACT_ID=CABC... \
  --build-arg NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org \
  --build-arg NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015" \
  --build-arg NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org \
  -f apps/interface/Dockerfile \
  -t fund-my-cause .
```

Or with Docker Compose, set them in `.env.local` before building:
```bash
cp apps/interface/.env.example apps/interface/.env.local
# fill in values, then:
docker compose up --build
```

### Docker Compose build fails: "Cannot find module"

**Cause:** `node_modules` from a previous build are stale or were built for a different architecture.

**Fix:**
```bash
docker compose down --volumes
docker compose build --no-cache
docker compose up
```

### Container exits immediately with code 1

**Fix:** Check the logs:
```bash
docker compose logs interface
# or
docker logs <container_id>
```

The most common cause is a missing environment variable (see above).
