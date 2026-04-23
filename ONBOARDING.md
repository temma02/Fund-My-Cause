# Contributor Onboarding Guide

Welcome to Fund-My-Cause! This guide gets you from zero to a fully working local development environment as quickly as possible.

For PR workflow, commit conventions, and branch naming, see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | 1.70+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | 21.0+ | [Installation guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Included with Node.js |
| Freighter wallet | Latest | [freighter.app](https://www.freighter.app/) (browser extension, for manual testing) |

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
cd Fund-My-Cause

# Install Node workspace dependencies
npm install
```

### 2. Build and test the contracts

```bash
# Build both contracts as WASM
cargo build --release --target wasm32-unknown-unknown

# Run all Rust tests
cargo test --workspace
```

### 3. Configure the frontend

```bash
cp apps/interface/.env.example apps/interface/.env.local
```

Edit `apps/interface/.env.local` and fill in the testnet values:

```bash
NEXT_PUBLIC_CROWDFUND_CONTRACT_ID=<testnet-contract-id>
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<testnet-registry-id>
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

If you don't have contract IDs yet, deploy to testnet first:

```bash
DEADLINE=$(date -d "+30 days" +%s)
./scripts/deploy.sh <YOUR_TESTNET_ADDRESS> \
  CAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4 \
  1000 $DEADLINE 10 "Test Campaign" "Onboarding test" null
```

### 4. Run the frontend

```bash
cd apps/interface
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run the full test suite

```bash
# Rust contract tests
cargo test --workspace

# Frontend unit tests
cd apps/interface && npm test

# Frontend tests with coverage report
cd apps/interface && npm run test:coverage

# E2E tests (requires a running dev server)
npx playwright test
```

---

## Code Style Guidelines

### Rust (contracts)

- Format with `cargo fmt` before committing — CI will fail on unformatted code.
- Lint with `cargo clippy -- -D warnings`.
- Keep contract functions focused; avoid side effects outside of storage writes and token transfers.
- All public contract functions must have a doc comment explaining parameters and behavior.
- Error handling: use `panic!` with a descriptive message for invariant violations; avoid silent failures.

### TypeScript (frontend)

- Lint and format: `cd apps/interface && npm run lint`.
- Use TypeScript strictly — no `any` unless absolutely unavoidable, and add a comment explaining why.
- Components live in `apps/interface/src/components/`. One component per file, named to match the export.
- Context providers live in `apps/interface/src/context/`.
- Contract client helpers live in `apps/interface/src/lib/`.
- Prefer named exports over default exports for components.
- Use Tailwind CSS utility classes; avoid inline styles.

### General

- Follow [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages (see [CONTRIBUTING.md](./CONTRIBUTING.md)).
- Keep PRs focused — one logical change per PR.
- The frontend enforces an **80% coverage threshold** (statements, branches, functions, lines). New code must maintain this floor. Run `npm run test:coverage` locally before pushing.

---

## Troubleshooting

### `cargo build` fails with "can't find crate"

Run `cargo update` to refresh the lock file, then retry. If the issue persists, ensure your Rust toolchain is up to date: `rustup update stable`.

### `wasm32-unknown-unknown` target missing

```bash
rustup target add wasm32-unknown-unknown
```

### Stellar CLI not found after install

Add the Stellar CLI binary to your PATH. The installer prints the exact path — add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) and reload: `source ~/.zshrc`.

### `npm install` fails with peer dependency errors

Ensure you're on Node.js 18+: `node --version`. If you manage multiple Node versions, switch with `nvm use 18` (or `nvm use --lts`).

### Frontend shows "contract not found" or RPC errors

- Verify `apps/interface/.env.local` exists and all four variables are set.
- Confirm the contract IDs are for the **testnet** network, not mainnet.
- Check the RPC endpoint is reachable: `curl https://soroban-testnet.stellar.org`.

### Jest coverage threshold failure

The build fails if any coverage metric drops below 80%. Run `npm run test:coverage` to see which files are under-covered, then add tests for the uncovered branches before pushing.

### Freighter wallet not connecting

- Ensure the Freighter extension is installed and unlocked.
- Switch Freighter to **Testnet** (Settings → Network).
- Hard-refresh the page (`Ctrl+Shift+R`) after switching networks.

### `deploy.sh` fails with "insufficient balance"

Fund your testnet account using [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test) or the Friendbot: `curl "https://friendbot.stellar.org?addr=<YOUR_ADDRESS>"`.

---

## Good First Issues

New contributors should look for issues tagged **`good first issue`** on GitHub:

[https://github.com/Fund-My-Cause/Fund-My-Cause/issues?q=is%3Aopen+label%3A%22good+first+issue%22](https://github.com/Fund-My-Cause/Fund-My-Cause/issues?q=is%3Aopen+label%3A%22good+first+issue%22)

These issues are scoped to be approachable without deep knowledge of the full codebase. They include:

- Frontend UI improvements (components, accessibility, styling)
- Documentation fixes and additions
- Adding test coverage for existing functions
- Small contract helper functions or view queries

If you're unsure where to start, comment on an issue and a maintainer will help scope the work.

---

## Getting Help

- Browse [open issues](https://github.com/Fund-My-Cause/Fund-My-Cause/issues) and [discussions](https://github.com/Fund-My-Cause/Fund-My-Cause/discussions).
- Ask questions in a GitHub Discussion — maintainers respond there.
- For Stellar/Soroban questions: [Stellar Discord](https://discord.gg/stellar) `#soroban` channel.
- For Freighter questions: [Freighter GitHub](https://github.com/stellar/freighter).
