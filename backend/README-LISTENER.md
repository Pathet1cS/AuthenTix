# Blockchain Event Listener — Operational Runbook

This document covers how to run, monitor, and troubleshoot the **Event
Listener Service** (`src/features/listener/`), implemented as part of
**TASK-BE-09**. See the full design rationale in
[`docs/superpowers/specs/2026-10-01-task-be-09-event-listener-design.md`](../docs/superpowers/specs/2026-10-01-task-be-09-event-listener-design.md).

## What it does

The listener is a standalone background process, separate from the Express
API, that keeps MongoDB in sync with the `EventTicketNFT` contract on
Optimism Sepolia by:

1. On startup, **replaying** any `TicketMinted` / `TicketTransferred` /
   `TicketUsed` events emitted since the last checkpoint (`SyncState`
   collection).
2. After catch-up, **subscribing** to the same three events in real time.

It is safe to run with zero or more Express API instances, and safe to
restart at any time — all event handlers are idempotent.

## Running locally

Requires the same `.env` as the API (`MONGO_URI`, `RPC_URL`,
`CONTRACT_ADDRESS`, etc.) plus the listener-specific variables below.

```powershell
# Terminal 1: Express API
npm run dev

# Terminal 2: Event Listener (separate process)
npm run listener:watch
```

Use `npm run listener` (no file-watching) for a one-off / production-like
run, and `npm run listener:watch` while actively developing handlers.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `RPC_URL` | yes | — | HTTP RPC endpoint, also used as fallback if `WS_RPC_URL` is unset. |
| `WS_RPC_URL` | no | — | WebSocket RPC endpoint for real-time events. If omitted, falls back to the HTTP provider (`contract.on` still works over HTTP via polling, just with higher latency). |
| `CONTRACT_DEPLOYMENT_BLOCK` | yes | — | Block number the `EventTicketNFT` contract was deployed at. Used as the catch-up starting point only when no `SyncState` document exists yet (fresh database). |
| `LISTENER_BATCH_SIZE` | no | `1000` | Max block range per historical `queryFilter` call during catch-up (1-5000). Lower this if your RPC provider rejects wide ranges. |
| `LISTENER_CHECKPOINT_INTERVAL` | no | `10` | Reserved for future use; checkpoint throttling during real-time listening is currently a fixed 30s interval (see `ListenerService.checkpointIntervalMs`). |

## Checking sync status

Connect to MongoDB and inspect the singleton `SyncState` document:

```js
use authentix
db.syncstates.findOne()
// { _id: ..., lastProcessedBlock: 14512345, createdAt: ..., updatedAt: ... }
```

Compare `lastProcessedBlock` against the current chain head (e.g. via a
block explorer or `provider.getBlockNumber()`) to estimate how far behind
the listener is. A multi-thousand-block gap right after startup is normal
(catch-up in progress); a growing gap while the process is supposedly
"running" indicates a stuck or crashed listener.

Audit all synchronized on-chain activity via the `Transaction` collection:

```js
db.transactions.find({ tokenId: '123' }).sort({ timestamp: 1 })
```

## Manually forcing a full re-sync

There is no admin API for this yet (tracked as a future enhancement). To
force a full historical replay:

1. Stop the listener process.
2. Delete the `SyncState` document: `db.syncstates.deleteMany({})`.
3. Restart the listener (`npm run listener`). It will treat
   `CONTRACT_DEPLOYMENT_BLOCK` as the starting point and replay everything.

This is safe (idempotent handlers), but can be slow for a long-lived
contract and will re-create `Transaction` records only for events that
don't already have one — existing `Ticket`/`Transaction` documents are
upserted/matched by `tokenId` / `txHash`, not duplicated.

## Troubleshooting

**Listener won't start / exits immediately with "Fatal error during initialization"**
Check the printed error. Common causes:
- `MONGO_URI` unreachable — same connection logic as the API (`connectDB`),
  retries once after 1s then throws.
- `CONTRACT_DEPLOYMENT_BLOCK` missing/invalid — required by `env.schema.ts`;
  the process won't even reach `main()` without it (see `src/config/env.ts`).

**Catch-up seems to hang on a specific block range**
Your RPC provider may be rejecting the configured `LISTENER_BATCH_SIZE`.
Lower it (e.g. to `500` or `200`) and restart.

**`[Listener] Real-time handler error for ...` appears in logs**
This is expected to be non-fatal — the error is logged and the specific
event is skipped without crashing the process or blocking other events.
Because handlers are idempotent, the failed event will be picked up again
automatically the next time the listener restarts and runs catch-up (as
long as the checkpoint hasn't advanced past that block, which it won't if
the handler threw). Investigate the logged error; if it's a transient RPC
or MongoDB issue, a restart alone is often enough to recover.

**MongoDB shows a ticket owner that looks "stale"**
Remember blockchain state is authoritative. If you suspect the listener
missed an event, check `SyncState.lastProcessedBlock` against the chain
head, and consider the manual full re-sync procedure above.

**Duplicate `Transaction` records for the same `txHash`**
Should not happen — `txHash` has a unique index on the `Transaction`
model, and every handler either checks for an existing record first or
relies on that unique constraint. If you see this, it indicates a bug;
check whether the unique index exists (`db.transactions.getIndexes()`).

## Known limitations (by design, see spec §11)

- No dead-letter queue: a persistently-failing event blocks catch-up
  checkpoint progress until manually investigated and resolved (e.g. by
  fixing a data issue and restarting).
- No reorg detection/rollback: events are treated as final once seen with
  1 confirmation, matching the backend's existing `tx.wait(1)` convention
  elsewhere in the codebase. Deep reorgs on Optimism Sepolia are rare but
  not handled.
- Single-instance only: running two listener processes against the same
  MongoDB will cause both to process the same events (idempotency makes
  this safe, but wasteful). Do not scale this service horizontally without
  adding coordination (e.g. a distributed lock).
