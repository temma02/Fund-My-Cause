# Registry Contract API Reference

The registry contract is a lightweight index that tracks deployed campaign contract addresses, enabling frontend discovery and pagination without querying the Stellar network directly.

**Contract:** `contracts/registry/src/lib.rs`

---

## Overview

Each time a new crowdfund campaign is deployed and initialized, its contract address is registered here. The frontend queries the registry to list all campaigns rather than scanning the ledger.

```
deploy crowdfund contract
        │
        ▼
registry.register(campaign_id)   ← adds address to the list (deduplicates)
        │
        ▼
frontend calls registry.list(offset, limit)  ← paginated discovery
```

---

## Storage

| Key | Type | Storage | Description |
|-----|------|---------|-------------|
| `CMPLIST` | `Vec<Address>` | Instance | Ordered list of registered campaign contract addresses |

Entries are appended in registration order and never removed. Deduplication is enforced by `register`.

---

## Functions

### `register`

Adds a campaign contract address to the registry. If the address is already registered, the call is a no-op — no error, no duplicate entry.

**Signature:**
```rust
pub fn register(env: Env, campaign_id: Address)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `campaign_id` | `Address` | The deployed crowdfund contract address to register |

**Returns:** `()` — no return value, no error type

**Behaviour:**
- Reads the current campaign list from instance storage (empty `Vec` if first call)
- Checks `campaigns.contains(&campaign_id)` before inserting — safe to call multiple times with the same address
- Appends the address and writes the updated list back to storage
- Emits an event only when a new address is actually added

**Events:**

| Topic | Data | Emitted when |
|-------|------|--------------|
| `("registry", "registered")` | `campaign_id: Address` | Address was not already present |

**Example — deploy script:**
```bash
stellar contract invoke \
  --id $REGISTRY_CONTRACT_ID \
  --source $DEPLOYER_SECRET \
  --network testnet \
  -- register \
  --campaign_id $CROWDFUND_CONTRACT_ID
```

**Example — TypeScript client:**
```ts
await registryClient.register({ campaign_id: crowdfundContractId });
```

---

### `list`

Returns a paginated slice of registered campaign contract addresses in registration order.

**Signature:**
```rust
pub fn list(env: Env, offset: u32, limit: u32) -> Vec<Address>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `offset` | `u32` | Zero-based start index |
| `limit` | `u32` | Maximum number of addresses to return |

**Returns:** `Vec<Address>` — addresses from index `offset` up to `offset + limit` (exclusive). Returns an empty vector when `offset >= total` or `limit == 0`.

**Behaviour:**
- `limit = 0` → returns empty vector immediately
- `offset >= total` → returns empty vector
- `offset + limit > total` → returns only the remaining addresses (no padding)
- Order is stable: registration order is preserved across calls

**Pagination pattern:**

```ts
const PAGE_SIZE = 20;
let offset = 0;
let allCampaigns: string[] = [];

while (true) {
  const page = await registryClient.list({ offset, limit: PAGE_SIZE });
  if (page.length === 0) break;
  allCampaigns.push(...page);
  offset += PAGE_SIZE;
}
```

**Example — fetch first page:**
```ts
// First 20 campaigns
const page1 = await registryClient.list({ offset: 0, limit: 20 });

// Next 20
const page2 = await registryClient.list({ offset: 20, limit: 20 });
```

**Example — CLI:**
```bash
stellar contract invoke \
  --id $REGISTRY_CONTRACT_ID \
  --network testnet \
  -- list \
  --offset 0 \
  --limit 10
```

---

## Error Handling

The registry contract has no `#[contracterror]` enum — neither function returns a `Result`. Calls cannot fail with a contract-level error code.

The only failure modes are Soroban host-level panics, which are not catchable in normal usage:

| Condition | Outcome |
|-----------|---------|
| `campaign_id` is not a valid contract address | Host rejects the transaction before invocation |
| Storage read/write failure | Host-level panic (infrastructure issue) |
| `offset` or `limit` overflow `u32` | Not possible — Soroban validates argument types |

For the frontend, treat any non-`SUCCESS` transaction result as a transient infrastructure error and retry with exponential backoff.

---

## Counting Campaigns

There is no dedicated `get_campaign_count` function. Derive the count from `list` by fetching until an empty page is returned, or track it client-side after a full sync:

```ts
// Efficient count: fetch with limit=0 at a large offset to find the boundary,
// or simply accumulate during a full list traversal.
let count = 0;
let offset = 0;
const PAGE = 50;
while (true) {
  const page = await registryClient.list({ offset, limit: PAGE });
  count += page.length;
  if (page.length < PAGE) break;
  offset += PAGE;
}
// count now equals total registered campaigns
```

If you need the count frequently, cache it in your frontend state and invalidate on each `("registry", "registered")` event.

---

## Listening for New Campaigns

Subscribe to the `("registry", "registered")` event to receive new campaign addresses in real time without polling:

```ts
// Using @stellar/stellar-sdk event streaming
server.getEvents({
  startLedger: fromLedger,
  filters: [{
    type: "contract",
    contractIds: [REGISTRY_CONTRACT_ID],
    topics: [["*", nativeToScVal("registered", { type: "symbol" }).toXDR("base64")]],
  }],
});
```

Each event's `value` is the newly registered `campaign_id` as a `ScVal` address.

---

## Integration with the Deploy Script

`scripts/deploy.sh` calls `register` automatically after initializing a new crowdfund contract:

```bash
# From deploy.sh
stellar contract invoke \
  --id "$REGISTRY_ID" \
  --source "$CREATOR_SECRET" \
  --network testnet \
  -- register \
  --campaign_id "$CONTRACT_ID"
```

If `REGISTRY_CONTRACT_ID` is not supplied, the script deploys a fresh registry first and prints the new ID. Save both IDs in your `.env.local`:

```bash
NEXT_PUBLIC_CROWDFUND_CONTRACT_ID=<CONTRACT_ID>
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<REGISTRY_ID>
```

---

## Relationship to the Crowdfund Contract

The registry and crowdfund contracts are fully independent — neither calls the other on-chain. The registry stores only the crowdfund contract's address; it does not validate that the address points to a valid crowdfund contract or that the campaign is active. Validation happens in the frontend when it calls `get_campaign_info` on each address returned by `list`.
