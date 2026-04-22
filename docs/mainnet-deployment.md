# Mainnet Deployment Guide

Step-by-step guide for deploying Fund-My-Cause contracts to Stellar mainnet.

---

## Mainnet RPC Endpoints & Network Passphrase

| Parameter | Value |
|---|---|
| RPC URL | `https://soroban-mainnet.stellar.org` |
| Horizon URL | `https://horizon.stellar.org` |
| Network Passphrase | `Public Global Stellar Network ; September 2015` |
| Network Name | `public` |

> **Testnet reference:** RPC `https://soroban-testnet.stellar.org` · Passphrase `Test SDF Network ; September 2015`

---

## Security Checklist

Complete every item before deploying to mainnet.

- [ ] Contract code has been reviewed (internal or third-party audit)
- [ ] All tests pass: `cargo test --workspace`
- [ ] Contract has been deployed and fully tested on testnet
- [ ] Deployer secret key is stored in a hardware wallet or encrypted secrets manager — **never in plaintext or committed to git**
- [ ] `.env.mainnet` is listed in `.gitignore`
- [ ] `Cargo.lock` is committed and matches the audited build
- [ ] WASM hash has been recorded for on-chain verification (see [Contract Verification](#contract-verification))
- [ ] Deployer account holds sufficient XLM (see [Fee Estimation](#fee-estimation--funding-requirements))
- [ ] Campaign parameters (goal, deadline, min contribution) have been double-checked
- [ ] Platform fee address and basis points are correct (if applicable)

---

## Deployment Steps

### 1. Set environment variables

```bash
export DEPLOYER_SECRET="<your-secret-key>"          # never commit this
export CREATOR="<creator-public-key>"
export TOKEN="CAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"  # native XLM
export GOAL="10000000000"                            # stroops (1000 XLM)
export DEADLINE=$(date -d "+30 days" +%s)
export MIN_CONTRIBUTION="1000000"                    # stroops (0.1 XLM)
export TITLE="My Campaign"
export DESCRIPTION="A great cause"
```

### 2. Build optimized WASM

```bash
cargo build --release --target wasm32-unknown-unknown \
  --manifest-path contracts/crowdfund/Cargo.toml

cargo build --release --target wasm32-unknown-unknown \
  --manifest-path contracts/registry/Cargo.toml
```

Record the WASM hashes before deploying:

```bash
sha256sum target/wasm32-unknown-unknown/release/crowdfund.wasm
sha256sum target/wasm32-unknown-unknown/release/registry.wasm
```

### 3. Deploy contracts

```bash
# Deploy registry
REGISTRY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/registry.wasm \
  --network public \
  --source "$DEPLOYER_SECRET")
echo "Registry ID: $REGISTRY_ID"

# Deploy crowdfund
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm \
  --network public \
  --source "$DEPLOYER_SECRET")
echo "Contract ID: $CONTRACT_ID"
```

### 4. Initialize the campaign

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network public \
  --source "$DEPLOYER_SECRET" \
  -- initialize \
  --creator "$CREATOR" \
  --token "$TOKEN" \
  --goal "$GOAL" \
  --deadline "$DEADLINE" \
  --min_contribution "$MIN_CONTRIBUTION" \
  --title "$TITLE" \
  --description "$DESCRIPTION" \
  --social_links null \
  --platform_config null
```

### 5. Register in registry

```bash
stellar contract invoke \
  --id "$REGISTRY_ID" \
  --network public \
  --source "$DEPLOYER_SECRET" \
  -- register \
  --campaign_id "$CONTRACT_ID"
```

### 6. Configure frontend

Create `apps/interface/.env.local`:

```bash
NEXT_PUBLIC_CROWDFUND_CONTRACT_ID=<CONTRACT_ID>
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<REGISTRY_ID>
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-mainnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

---

## Contract Verification

Verify the deployed WASM matches your local build using [Stellar Expert](https://stellar.expert/explorer/public).

1. Open `https://stellar.expert/explorer/public/contract/<CONTRACT_ID>`
2. Go to the **Code** tab and copy the on-chain WASM hash
3. Compare it against your local hash:
   ```bash
   sha256sum target/wasm32-unknown-unknown/release/crowdfund.wasm
   ```
4. The hashes must match exactly. A mismatch means the deployed bytecode differs from your source.
5. Verify the **initialized** event appears in the **Events** tab with the correct parameters.
6. Repeat steps 1–5 for the registry contract.

---

## Fee Estimation & Funding Requirements

Stellar fees are paid in XLM (1 XLM = 10,000,000 stroops).

| Operation | Estimated Cost |
|---|---|
| Contract deployment (crowdfund) | ~2–4 XLM |
| Contract deployment (registry) | ~1–2 XLM |
| `initialize()` invocation | ~0.1–0.5 XLM |
| `register()` invocation | ~0.1 XLM |
| Base account reserve | 1 XLM |
| **Recommended minimum balance** | **10 XLM** |

> Fees vary with network load. Check current base fee: `stellar network status --network public`

Fund your deployer account before starting:

```bash
# Verify balance
stellar account info <DEPLOYER_PUBLIC_KEY> --network public
```

---

## Rollback Procedures

Soroban contracts are immutable once deployed. There is no in-place upgrade path. Rollback means deploying a fixed contract and migrating.

### If deployment or initialization fails

1. Note the error from the Stellar CLI output.
2. Common causes:
   - Insufficient XLM balance → fund the account and retry
   - Invalid parameter type → fix the argument and retry
   - Deadline in the past → recalculate `$DEADLINE` and retry
3. A failed `deploy` does not consume the WASM slot — retry freely.
4. A failed `initialize` leaves the contract uninitialized — you can retry `initialize` on the same contract ID.

### If a critical bug is found post-deployment

1. **Stop promoting the contract** — update the frontend to show a maintenance notice immediately.
2. Deploy a patched contract version following steps 2–5 above.
3. Update `apps/interface/.env.local` with the new `CONTRACT_ID`.
4. Redeploy the frontend.
5. Notify contributors: because the refund model is pull-based (`refund_single`), contributors can still claim refunds from the old contract independently.
6. If funds are at risk, contact [Stellar Discord](https://discord.gg/stellar) for incident support.

### Checklist after rollback

- [ ] New contract deployed and verified on Stellar Expert
- [ ] Frontend updated with new contract ID
- [ ] Old contract ID documented and marked deprecated
- [ ] Contributors notified with instructions for the old contract
