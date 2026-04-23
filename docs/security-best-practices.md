# Security Best Practices

Security guidance for campaign creators and contributors using Fund-My-Cause.

For reporting vulnerabilities, see [SECURITY.md](../SECURITY.md).

---

## Wallet Security

### Freighter

[Freighter](https://www.freighter.app/) is the primary wallet supported by Fund-My-Cause.

- **Install only from the official source.** Download from [freighter.app](https://www.freighter.app/) or the browser extension stores linked there. Do not install from third-party sites or links shared in chat.
- **Never share your secret key or mnemonic phrase.** Freighter will never ask for it outside of the initial setup flow. No legitimate support channel will ask for it either.
- **Lock your wallet when not in use.** Freighter has an auto-lock setting — enable it.
- **Review every transaction before signing.** Freighter shows the full transaction details. Verify the contract ID, operation type, and amount before approving.
- **Use a dedicated browser profile for DeFi.** Isolating your wallet extension reduces the risk of a malicious extension on the same profile accessing wallet data.
- **Keep the extension updated.** Updates patch security vulnerabilities. Enable auto-updates or check [Freighter's GitHub](https://github.com/stellar/freighter) for releases.

### Lobstr

[Lobstr](https://lobstr.co/) is a popular Stellar wallet that can also be used with Fund-My-Cause via WalletConnect.

- **Use the official app only.** Download from [lobstr.co](https://lobstr.co/), the App Store, or Google Play. Verify the publisher before installing.
- **Enable two-factor authentication (2FA).** Lobstr supports 2FA — turn it on.
- **Back up your recovery phrase offline.** Write it on paper and store it securely. Do not photograph it or store it in cloud services.
- **Verify WalletConnect pairings.** When connecting via WalletConnect, confirm the pairing code matches what is shown in the Fund-My-Cause interface before approving.

### General Wallet Hygiene

- Never enter your seed phrase or private key into any website or form.
- Use a hardware wallet (e.g., Ledger) for large amounts — both Freighter and Lobstr support hardware wallet signing.
- Treat your wallet address as public information, but your secret key as a password that must never leave your device.

---

## Contract Immutability and Trust

Soroban smart contracts deployed on Stellar are **immutable** — once deployed, the contract code cannot be changed. This has important implications:

- **What you see is what you get.** The contract logic governing contributions, withdrawals, and refunds is fixed at deployment. No one — including the campaign creator or the Fund-My-Cause team — can alter the rules after the fact.
- **Upgrades require a new deployment.** If a bug is found, a patched contract must be deployed at a new contract ID. The old contract continues to operate under its original logic. Always verify you are interacting with the current, announced contract ID.
- **The pull-based refund model protects contributors.** Refunds are claimed individually by each contributor via `refund_single`. This means a creator cannot block refunds by inaction — contributors can always claim their own funds if the goal is not met or the campaign is cancelled.
- **Platform fees are set at initialization and cannot change.** The `fee_bps` and platform address are locked in when the campaign is created. Verify these values before contributing.
- **Trust the contract, not the UI.** The frontend is a convenience layer. The contract enforces all rules on-chain. You can interact with the contract directly via Stellar CLI or Stellar Laboratory if you distrust the frontend.

---

## Phishing Prevention

Phishing attacks impersonate legitimate sites to steal wallet credentials or trick users into signing malicious transactions.

- **Always check the URL.** The official Fund-My-Cause interface is served from the domain announced in the project's README and GitHub. Bookmark it — do not navigate to it via links in emails, Discord messages, or social media.
- **Look for HTTPS.** Never interact with a wallet on a plain HTTP page.
- **Be suspicious of urgency.** Phishing messages often create artificial urgency ("campaign ends in 10 minutes — connect now"). Take your time to verify.
- **Do not click wallet connection prompts from unsolicited messages.** Legitimate campaigns do not need to DM you a link to contribute.
- **Verify the site before connecting your wallet.** Once Freighter or Lobstr is connected, the site can request transaction signatures. Only connect to sites you trust.
- **Check what you are signing.** Before approving any transaction in your wallet, confirm:
  - The contract ID matches the verified address (see below).
  - The operation is what you expect (e.g., `invoke_contract`, not `set_options` or `change_trust`).
  - The amount is correct.

---

## Verifying Contract Addresses

Before contributing to a campaign, verify that the contract ID shown in the UI matches the one announced by the campaign creator through trusted channels (their official website, verified social media, or the Fund-My-Cause GitHub).

### Using Stellar Expert

1. Copy the contract ID from the Fund-My-Cause interface.
2. Open [https://stellar.expert/explorer/public](https://stellar.expert/explorer/public) (mainnet) or [https://stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet) (testnet).
3. Paste the contract ID into the search bar.
4. Confirm:
   - The contract exists and has been initialized.
   - The **WASM hash** matches the hash published by the Fund-My-Cause team (see [Audit Reports](#audit-reports) below).
   - The **initialized** event is present with the expected campaign parameters (goal, deadline, creator address).

### Using Stellar CLI

```bash
# Fetch campaign info directly from the contract
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_campaign_info

# Verify the contract version
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- version
```

Compare the returned `creator`, `goal`, `deadline`, and `platform_fee_bps` against what the campaign creator has publicly announced.

### Checking the WASM Hash

The deployed WASM bytecode can be verified against the source code:

```bash
# Build the contract locally from the audited commit
git checkout <AUDITED_COMMIT_SHA>
cargo build --release --target wasm32-unknown-unknown \
  --manifest-path contracts/crowdfund/Cargo.toml

# Hash your local build
sha256sum target/wasm32-unknown-unknown/release/crowdfund.wasm
```

Compare this hash against the one shown on Stellar Expert under the contract's **Code** tab. A match confirms the on-chain bytecode corresponds to the published source.

---

## Audit Reports

> **Current status:** Fund-My-Cause is deployed on **testnet only** (contract v3). No formal third-party security audit has been completed yet.

| Audit | Auditor | Scope | Status | Report |
|-------|---------|-------|--------|--------|
| Smart contract audit | — | `contracts/crowdfund`, `contracts/registry` | Not yet conducted | — |
| Frontend audit | — | `apps/interface` | Not yet conducted | — |

Known dependency vulnerabilities and their mitigations are tracked in [docs/audit-notes.md](./audit-notes.md).

When a formal audit is completed, the report will be linked here and the audited WASM hash will be published alongside it. **Do not use Fund-My-Cause with significant funds until a mainnet audit has been completed and published.**

To report a vulnerability, follow the process in [SECURITY.md](../SECURITY.md).
