# Frontend Integration Guide

This guide covers how to integrate Fund-My-Cause smart contracts into your own Next.js (or any React) frontend using the Stellar SDK and Freighter wallet.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| `@stellar/stellar-sdk` | 12+ |
| `@stellar/freighter-api` | 4+ |
| Freighter browser extension | Latest |

```bash
npm install @stellar/stellar-sdk @stellar/freighter-api
```

---

## Environment Variables

Create a `.env.local` file at the root of your app:

```bash
NEXT_PUBLIC_CROWDFUND_CONTRACT_ID=<YOUR_CONTRACT_ID>
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<YOUR_REGISTRY_CONTRACT_ID>
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

---

## Contract Client Initialization

The contract client is a thin wrapper around `@stellar/stellar-sdk`'s `SorobanRpc.Server`. Initialize it once and reuse it across calls.

```ts
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!;
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!;

export function getContractClient(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL);
}
```

Read-only calls use `simulateTransaction` with a dummy account — no signing required:

```ts
import {
  Account,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  scValToNative,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";

async function simulateView(contractId: string, method: string, args = []) {
  const rpc = getContractClient();
  const contract = new Contract(contractId);
  // Dummy account — never submitted, only used to build the tx envelope
  const account = new Account("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN", "0");

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(result.error);
  }
  return scValToNative(result.result!.retval);
}
```

---

## Contract Function Examples

### Read: Fetch Campaign Info

```ts
import { Address, nativeToScVal } from "@stellar/stellar-sdk";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CROWDFUND_CONTRACT_ID!;

// Fetch all campaign metadata in parallel
const [title, description, goal, deadline, minContribution] = await Promise.all([
  simulateView(CONTRACT_ID, "title"),
  simulateView(CONTRACT_ID, "description"),
  simulateView(CONTRACT_ID, "goal"),
  simulateView(CONTRACT_ID, "deadline"),
  simulateView(CONTRACT_ID, "min_contribution"),
]);
```

### Read: Fetch Campaign Stats

```ts
const stats = await simulateView(CONTRACT_ID, "get_stats") as {
  total_raised: bigint;
  goal: bigint;
  progress_bps: number;
  contributor_count: number;
  average_contribution: bigint;
  largest_contribution: bigint;
};

const progressPercent = stats.progress_bps / 100; // e.g. 5000 bps = 50%
```

### Read: Fetch a Contributor's Amount

```ts
import { Address } from "@stellar/stellar-sdk";

const amount = await simulateView(CONTRACT_ID, "contribution", [
  new Address(contributorAddress).toScVal(),
]);
// amount is in stroops; divide by 1e7 for XLM
const xlm = Number(amount) / 1e7;
```

### Write: Contribute

State-changing calls require building a transaction, preparing it (to attach resource fees), signing it with the wallet, and submitting it.

```ts
import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  Horizon,
  rpc as SorobanRpc,
  TransactionBuilder as TB,
} from "@stellar/stellar-sdk";

async function contribute(
  contractId: string,
  contributor: string,
  amountXlm: number,
  signTx: (xdr: string) => Promise<string>,
): Promise<string> {
  const amountStroops = BigInt(Math.round(amountXlm * 1e7));
  const horizon = new Horizon.Server(process.env.NEXT_PUBLIC_HORIZON_URL!);
  const rpc = getContractClient();

  const account = await horizon.loadAccount(contributor);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "contribute",
        nativeToScVal(amountStroops, { type: "i128" }),
      ),
    )
    .setTimeout(30)
    .build();

  // Attach resource fees and footprint
  const prepared = await rpc.prepareTransaction(tx);
  const signedXdr = await signTx(prepared.toXDR());
  const signedTx = TB.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sendResult = await rpc.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    throw new Error(`Submit failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  return pollTransaction(rpc, sendResult.hash);
}
```

### Write: Withdraw (Creator)

```ts
async function withdraw(
  contractId: string,
  creator: string,
  signTx: (xdr: string) => Promise<string>,
): Promise<string> {
  // Same pattern as contribute — no args needed
  return invokeContract(creator, contractId, "withdraw", [], signTx);
}
```

### Write: Refund (Contributor)

Uses the pull-based refund model — each contributor claims their own refund individually.

```ts
async function refundSingle(
  contractId: string,
  contributor: string,
  signTx: (xdr: string) => Promise<string>,
): Promise<string> {
  return invokeContract(
    contributor,
    contractId,
    "refund_single",
    [new Address(contributor).toScVal()],
    signTx,
  );
}
```

---

## Transaction Signing Patterns

### Polling for Confirmation

After `sendTransaction`, poll `getTransaction` until the status is `SUCCESS` or `FAILED`:

```ts
async function pollTransaction(
  rpc: SorobanRpc.Server,
  hash: string,
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await rpc.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return hash;
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain: ${hash}`);
    }
  }
  throw new Error(`Transaction not confirmed after polling: ${hash}`);
}
```

### Simulate Before Signing

Always simulate before prompting the user to sign. This catches contract errors early and surfaces the estimated resource fee:

```ts
async function simulateTx(unsignedXdr: string) {
  const rpc = getContractClient();
  const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
  const result = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(result.error);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, result).build();
  const minFeeXlm = (Number(result.minResourceFee) / 1e7).toFixed(7) + " XLM";

  return { preparedXdr: prepared.toXDR(), minFeeXlm };
}
```

---

## Wallet Integration

### WalletContext Setup

Wrap your app with `WalletProvider` to expose wallet state globally:

```tsx
// app/layout.tsx
import { WalletProvider } from "@/context/WalletContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
```

### Using the Wallet in a Component

```tsx
import { useWallet } from "@/context/WalletContext";

export function ContributeButton({ contractId }: { contractId: string }) {
  const { address, signTx, isSigning, connect } = useWallet();

  async function handleContribute() {
    if (!address) return connect();
    await contribute(contractId, address, 10, signTx); // 10 XLM
  }

  return (
    <button onClick={handleContribute} disabled={isSigning}>
      {isSigning ? "Signing…" : "Contribute 10 XLM"}
    </button>
  );
}
```

### WalletContext API

| Property | Type | Description |
|---|---|---|
| `address` | `string \| null` | Connected wallet public key |
| `xlmBalance` | `string \| null` | XLM balance (e.g. `"42.50"`) |
| `refreshBalance` | `() => void` | Re-fetch balance after a transaction |
| `connect` | `() => Promise<void>` | Opens wallet selection modal |
| `disconnect` | `() => void` | Clears session and disconnects |
| `signTx` | `(xdr: string) => Promise<string>` | Signs a transaction XDR |
| `isSigning` | `boolean` | True while wallet is signing |
| `isConnecting` | `boolean` | True while connecting |
| `networkMismatch` | `boolean` | True if wallet is on the wrong network |

---

## Error Handling

### ContractError

Import `ContractError` from the contract lib to distinguish contract-level failures from network errors:

```ts
import { ContractError } from "@/lib/contract";

try {
  await contribute(contractId, address, amount, signTx);
} catch (e) {
  if (e instanceof ContractError) {
    // Contract rejected the call (e.g. below minimum, deadline passed)
    console.error("Contract error:", e.message);
  } else {
    // Network or signing error
    console.error("Unexpected error:", e);
  }
}
```

### Common Contract Error Patterns

| Scenario | Cause | Handling |
|---|---|---|
| `ContractError(1)` | Amount below minimum contribution | Show minimum amount to user |
| `ContractError(2)` | Campaign deadline has passed | Disable contribute button |
| `ContractError(3)` | Campaign not in `Active` status | Check `status` before showing UI |
| User rejection | Freighter/LOBSTR declined | Catch `/declined\|rejected\|cancel/i` in message |
| Network timeout | RPC unreachable | Retry with exponential backoff |

### Simulation Error Parsing

Parse Soroban diagnostic strings into user-friendly messages:

```ts
function parseSimulationError(raw: string): string {
  const match = raw.match(/ContractError\((\d+)\)/);
  if (match) return `Contract error code ${match[1]}. Check your inputs.`;
  if (raw.includes("below minimum")) return "Amount is below the minimum contribution.";
  if (raw.includes("deadline")) return "This campaign's deadline has passed.";
  if (raw.includes("Cancelled")) return "This campaign has been cancelled.";
  return raw.split("\n")[0] ?? "Simulation failed. Please try again.";
}
```

---

## TypeScript Type Definitions

```ts
/** Wallet signing function — matches WalletContext.signTx */
export type SignFn = (xdr: string) => Promise<string>;

/** Campaign status from the contract */
export type CampaignStatus = "Active" | "Successful" | "Refunded" | "Cancelled" | "Paused";

/** Full campaign metadata returned by get_campaign_info */
export interface CampaignInfo {
  contractId: string;
  creator: string;
  token: string;
  goal: bigint;           // stroops
  deadline: bigint;       // Unix timestamp (seconds)
  minContribution: bigint; // stroops
  title: string;
  description: string;
  status: CampaignStatus;
  hasPlatformConfig: boolean;
  platformFeeBps: number;
  platformAddress: string;
  socialLinks: string[];
  acceptedTokens?: string[];
}

/** Live campaign statistics from get_stats */
export interface CampaignStats {
  totalRaised: bigint;       // stroops
  goal: bigint;              // stroops
  progressBps: number;       // basis points (10000 = 100%)
  contributorCount: number;
  averageContribution: bigint; // stroops
  largestContribution: bigint; // stroops
}

/** Normalized display model (XLM floats, ISO deadline) */
export interface CampaignData {
  contractId: string;
  title: string;
  description: string;
  raised: number;    // XLM
  goal: number;      // XLM
  deadline: string;  // ISO 8601
  creator: string;
  socialLinks: string[];
  contributorCount: number;
  averageContribution: number; // XLM
  status: CampaignStatus;
}

/** Campaign initialization parameters */
export interface InitializeParams {
  contractId: string;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  minContribution: bigint;
  title: string;
  description: string;
  socialLinks?: string[];
  acceptedTokens?: string[];
  platformFeeAddress?: string;
  platformFeeBps?: number;
}
```

---

## Unit Conversions

Stellar amounts are stored in **stroops** (1 XLM = 10,000,000 stroops):

```ts
const xlmToStroops = (xlm: number): bigint => BigInt(Math.round(xlm * 1e7));
const stroopsToXlm = (stroops: bigint): number => Number(stroops) / 1e7;

// Progress from basis points
const bpsToPercent = (bps: number): number => bps / 100; // 5000 bps → 50%
```

---

## Further Reading

- [Stellar SDK Docs](https://stellar.github.io/js-stellar-sdk/)
- [Soroban Docs](https://soroban.stellar.org)
- [Freighter API Docs](https://docs.freighter.app)
- [Contract Source](../contracts/crowdfund/src/lib.rs)
