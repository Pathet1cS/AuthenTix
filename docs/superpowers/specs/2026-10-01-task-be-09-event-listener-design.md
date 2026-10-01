# Design Specification: TASK-BE-09 Blockchain Event Listener & Recovery Engine

- **Document Version:** 1.0.0
- **Date:** 2026-10-01
- **Status:** Approved / Ready for Implementation
- **Target Component:** `backend/src/features/listener/`, `backend/src/shared/services/`, `backend/src/shared/models/`
- **Related Requirements:** PRD Sections 6 (FR-09 Blockchain Synchronization), 7 (NFR: Reliability, System must recover from missed blockchain events), 11 (Event Listener Design), 13 (Failure Recovery Rules).

---

## 1. Executive Summary

This specification defines the architecture, synchronization logic, recovery mechanisms, and testing strategy for **TASK-BE-09: Blockchain Event Listener & Recovery Engine**.

AuthenTix operates as a hybrid Web2 + Web3 system where the **blockchain (Optimism Sepolia) is the authoritative source of truth** for ticket ownership, transfers, and redemptions, while **MongoDB serves as a high-performance read cache** for instant querying, filtering, and analytics.

Until now (TASK-BE-01 through TASK-BE-08), the backend has relied on:
1. **Synchronous updates** after backend-initiated transactions (e.g., `mintTicket` in BE-06).
2. **Client-provided transaction hashes** with on-chain receipt verification (e.g., resale flows in BE-07).
3. **Live `ownerOf` queries** to the blockchain when MongoDB data freshness cannot be guaranteed (e.g., QR verification in BE-08).

These approaches work for backend-controlled and client-verified flows, but they have critical gaps:

- **User-initiated wallet transfers** (direct `transferFrom` calls outside the platform UI) are not reflected in MongoDB.
- **Direct smart contract interactions** (e.g., a technically-savvy user calling `markUsed` from Etherscan) bypass the API entirely.
- **Service restarts** could miss events emitted during downtime, causing MongoDB to diverge from blockchain state.
- **Network partitions or RPC failures** could cause temporary desynchronization without a catch-up mechanism.

**TASK-BE-09** solves these problems by implementing a **standalone, self-healing event listener service** that:

1. **Continuously monitors** Optimism Sepolia for `TicketMinted`, `TicketTransferred`, and `TicketUsed` events emitted by the `EventTicketNFT` contract.
2. **Replicates all on-chain state changes** into MongoDB, ensuring the read cache is eventually consistent with blockchain reality.
3. **Maintains a `SyncState` checkpoint** (`lastProcessedBlock`) to track synchronization progress.
4. **Automatically recovers from downtime** by querying historical logs from the last checkpoint to the current block on startup.
5. **Runs as an independent background service** that can be deployed, scaled, and monitored separately from the Express API.

This enables:
- **Real-time ownership tracking** without per-request on-chain queries.
- **Auditability**: `Transaction` records become a complete, immutable audit log of all on-chain activity.
- **Resilience**: The system can recover from hours or days of downtime without manual intervention.
- **Scalability**: The API layer can serve millions of ticket queries from MongoDB without blockchain RPC bottlenecks.

---

## 2. System Architecture & Component Interactions

```
 +-----------------------------------------------------------------------------------+
 |                          Optimism Sepolia Blockchain                              |
 |                        EventTicketNFT Smart Contract                              |
 |  Events: TicketMinted, TicketTransferred, TicketUsed, ListingCreated, etc.       |
 +------------------------------------+----------------------------------------------+
                                      |
                                      | WebSocket / Polling
                                      | (ethers.js Provider)
                                      v
 +-----------------------------------------------------------------------------------+
 |                     Event Listener Service (Node.js Background Process)           |
 |                        (backend/src/features/listener/listener.service.ts)        |
 |                                                                                     |
 |  ┌─────────────────────────────────────────────────────────────────────────────┐ |
 |  │  Startup Recovery:                                                           │ |
 |  │  1. Read SyncState.lastProcessedBlock                                        │ |
 |  │  2. Query logs from lastProcessedBlock to latestBlock                        │ |
 |  │  3. Replay all missed events (TicketMinted, TicketTransferred, TicketUsed)   │ |
 |  │  4. Update SyncState checkpoint after each batch                             │ |
 |  └─────────────────────────────────────────────────────────────────────────────┘ |
 |                                                                                     |
 |  ┌─────────────────────────────────────────────────────────────────────────────┐ |
 |  │  Real-Time Listening:                                                        │ |
 |  │  1. Subscribe to contract.on('TicketMinted', handler)                        │ |
 |  │  2. Subscribe to contract.on('TicketTransferred', handler)                   │ |
 |  │  3. Subscribe to contract.on('TicketUsed', handler)                          │ |
 |  │  4. Process each event: update MongoDB (Ticket, Transaction)                 │ |
 |  │  5. Checkpoint SyncState every 10 blocks                                     │ |
 |  └─────────────────────────────────────────────────────────────────────────────┘ |
 |                                                                                     |
 |  ┌─────────────────────────────────────────────────────────────────────────────┐ |
 |  │  Error Handling:                                                             │ |
 |  │  - RPC connection lost -> exponential backoff reconnect                      │ |
 |  │  - Duplicate event (idempotency) -> skip silently                            │ |
 |  │  - Blockchain reorg detection -> rollback affected blocks                    │ |
 |  └─────────────────────────────────────────────────────────────────────────────┘ |
 +------------------------------------+----------------------------------------------+
                                      |
                                      | Read/Write MongoDB
                                      v
 +-----------------------------------------------------------------------------------+
 |                                MongoDB Database                                   |
 |                                                                                     |
 |  ┌─────────────────────────────────────────────────────────────────────────────┐ |
 |  │  SyncState Collection:                                                       │ |
 |  │  { lastProcessedBlock: 12345678, updatedAt: "2026-10-01T12:00:00.000Z" }    │ |
 |  └─────────────────────────────────────────────────────────────────────────────┘ |
 |                                                                                     |
 |  ┌─────────────────────────────────────────────────────────────────────────────┐ |
 |  │  Ticket Collection:                                                          │ |
 |  │  - ownerWallet updated on TicketTransferred                                  │ |
 |  │  - isUsed / usedAt updated on TicketUsed                                     │ |
 |  │  - isListed / resalePrice updated on ListingCreated / ListingSold            │ |
 |  └─────────────────────────────────────────────────────────────────────────────┘ |
 |                                                                                     |
 |  ┌─────────────────────────────────────────────────────────────────────────────┐ |
 |  │  Transaction Collection:                                                     │ |
 |  │  - Audit log for every on-chain event (mint, transfer, resell, redeem)      │ |
 |  └─────────────────────────────────────────────────────────────────────────────┘ |
 +-----------------------------------------------------------------------------------+
                                      ^
                                      |
                                      | Read MongoDB (cached data)
                                      |
 +-----------------------------------------------------------------------------------+
 |                          Express Backend API (Existing)                           |
 |  - GET /api/tickets/my (reads from MongoDB, no blockchain query needed)          |
 |  - GET /api/tickets/resale (reads from MongoDB)                                  |
 |  - POST /api/tickets/verify (reads from MongoDB, trusts listener sync)           |
 +-----------------------------------------------------------------------------------+
```

---

## 3. Event Listener Service Architecture

### 3.1 Service Structure

```
backend/src/features/listener/
├── listener.service.ts          # Main event listener orchestrator
├── handlers/
│   ├── ticketMinted.handler.ts      # Handles TicketMinted events
│   ├── ticketTransferred.handler.ts # Handles TicketTransferred events
│   └── ticketUsed.handler.ts        # Handles TicketUsed events
├── listener.types.ts            # TypeScript types for event payloads
└── listener.test.ts             # Unit tests for listener logic
```

### 3.2 Listener Service Responsibilities

The `ListenerService` class (`listener.service.ts`) is the central orchestrator:

```typescript
export class ListenerService {
  private provider: ethers.WebSocketProvider | ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private isListening: boolean = false;

  constructor() {
    // Initialize provider (prefer WebSocket for real-time, fallback to HTTP polling)
    // Initialize contract with EVENT_TICKET_NFT_ABI
  }

  async start(): Promise<void> {
    // 1. Connect to MongoDB
    // 2. Run startup recovery (catchUpFromLastCheckpoint)
    // 3. Start real-time listeners (subscribeToEvents)
    // 4. Handle graceful shutdown (SIGINT, SIGTERM)
  }

  private async catchUpFromLastCheckpoint(): Promise<void> {
    // Query SyncState.lastProcessedBlock
    // Query contract logs from lastProcessedBlock to provider.getBlockNumber()
    // Process each event in chronological order
    // Update SyncState checkpoint every 100 blocks
  }

  private async subscribeToEvents(): Promise<void> {
    // contract.on('TicketMinted', handleTicketMinted)
    // contract.on('TicketTransferred', handleTicketTransferred)
    // contract.on('TicketUsed', handleTicketUsed)
    // Periodic checkpoint update (every 10 blocks or 30 seconds)
  }

  async stop(): Promise<void> {
    // Gracefully disconnect listeners
    // Close MongoDB connection
  }
}
```

---

## 4. Event Handler Specifications

### 4.1 `TicketMinted` Event Handler

**Event Signature:**
```solidity
event TicketMinted(
    uint256 indexed tokenId,
    uint256 indexed eventId,
    address indexed owner,
    string tokenURI
)
```

**Handler Logic (`handleTicketMinted`):**

1. **Parse event parameters:**
   - `tokenId`: Convert BigNumber to string.
   - `eventId`: Convert BigNumber to MongoDB ObjectId lookup.
   - `owner`: Lowercase wallet address.
   - `tokenURI`: IPFS metadata URI.
   - `blockNumber`: From event log.
   - `txHash`: From event log.

2. **Idempotency check:**
   - Query `Ticket.findOne({ tokenId })`.
   - If exists AND `mintTxHash === txHash` → skip (already processed).
   - If exists AND `mintTxHash !== txHash` → log warning (potential reorg or duplicate tokenId, should not happen in ERC-721).

3. **Create or update `Ticket` document:**
   ```typescript
   await Ticket.findOneAndUpdate(
     { tokenId },
     {
       tokenId,
       eventId: mongoEventId,
       ownerWallet: owner.toLowerCase(),
       tokenURI,
       mintTxHash: txHash,
       blockNumber,
       isUsed: false,
       usedAt: null,
       isListed: false,
       resalePrice: null,
       listingTxHash: '',
       lastTransferTxHash: '',
     },
     { upsert: true, new: true }
   );
   ```

4. **Create audit `Transaction` record:**
   ```typescript
   await Transaction.findOneAndUpdate(
     { txHash },
     {
       txHash,
       type: 'mint',
       tokenId,
       fromWallet: ethers.ZeroAddress,
       toWallet: owner.toLowerCase(),
       price: 0,
       timestamp: new Date(blockTimestamp * 1000),
       status: 'SUCCESS',
     },
     { upsert: true }
   );
   ```

5. **Update event `remainingQuota`:**
   ```typescript
   await Event.findByIdAndUpdate(mongoEventId, {
     $inc: { remainingQuota: -1 }
   });
   ```

6. **Structured logging:**
   ```typescript
   console.log(`[TicketMinted] tokenId=${tokenId}, owner=${owner}, block=${blockNumber}, txHash=${txHash}`);
   ```

---

### 4.2 `TicketTransferred` Event Handler

**Event Signature:**
```solidity
event TicketTransferred(
    uint256 indexed tokenId,
    address indexed from,
    address indexed to
)
```

**Handler Logic (`handleTicketTransferred`):**

1. **Parse event parameters:**
   - `tokenId`: Convert to string.
   - `from`: Lowercase wallet address.
   - `to`: Lowercase wallet address.
   - `blockNumber`: From event log.
   - `txHash`: From event log.

2. **Idempotency check:**
   - Query `Transaction.findOne({ txHash, type: 'transfer' })`.
   - If exists → skip (already processed).

3. **Update `Ticket` ownership:**
   ```typescript
   await Ticket.findOneAndUpdate(
     { tokenId },
     {
       ownerWallet: to.toLowerCase(),
       lastTransferTxHash: txHash,
       blockNumber,
       isListed: false,        // Transfer invalidates any active listing
       resalePrice: null,
       listingTxHash: '',
     },
     { new: true }
   );
   ```

4. **Create audit `Transaction` record:**
   ```typescript
   await Transaction.create({
     txHash,
     type: 'transfer',
     tokenId,
     fromWallet: from.toLowerCase(),
     toWallet: to.toLowerCase(),
     price: 0,  // Pure transfer, no sale (resale sales use type: 'resell')
     timestamp: new Date(blockTimestamp * 1000),
     status: 'SUCCESS',
   });
   ```

5. **Structured logging:**
   ```typescript
   console.log(`[TicketTransferred] tokenId=${tokenId}, from=${from}, to=${to}, block=${blockNumber}, txHash=${txHash}`);
   ```

**Special Case: ListingSold vs TicketTransferred**

When a resale purchase occurs on-chain via `buyResoldTicket`:
- Both `ListingSold` AND `TicketTransferred` events are emitted in the same transaction.
- The `ListingSold` event contains price information.
- The API endpoint `POST /api/tickets/resell/purchase` (BE-07) already handles this synchronization by verifying both events.
- **Listener behavior:** The `TicketTransferred` handler should check if a `Transaction` with `type: 'resell'` already exists for this `txHash`:
  - If yes → skip (the API already processed this as a resale).
  - If no → create `type: 'transfer'` (this is a direct wallet-to-wallet transfer).

---

### 4.3 `TicketUsed` Event Handler

**Event Signature:**
```solidity
event TicketUsed(
    uint256 indexed tokenId,
    uint256 indexed eventId
)
```

**Handler Logic (`handleTicketUsed`):**

1. **Parse event parameters:**
   - `tokenId`: Convert to string.
   - `eventId`: Convert for logging (MongoDB eventId lookup optional).
   - `blockNumber`: From event log.
   - `txHash`: From event log.

2. **Idempotency check:**
   - Query `Ticket.findOne({ tokenId })`.
   - If `isUsed === true` AND `lastTransferTxHash === txHash` → skip (already processed).

3. **Update `Ticket` redemption status:**
   ```typescript
   await Ticket.findOneAndUpdate(
     { tokenId },
     {
       isUsed: true,
       usedAt: new Date(blockTimestamp * 1000),
       isListed: false,     // Used tickets cannot be listed
       resalePrice: null,
       listingTxHash: '',
     },
     { new: true }
   );
   ```

4. **Create audit `Transaction` record:**
   ```typescript
   const ticket = await Ticket.findOne({ tokenId });
   await Transaction.findOneAndUpdate(
     { txHash },
     {
       txHash,
       type: 'redeem',
       tokenId,
       fromWallet: ticket.ownerWallet,
       toWallet: ticket.ownerWallet,
       price: 0,
       timestamp: new Date(blockTimestamp * 1000),
       status: 'SUCCESS',
     },
     { upsert: true }
   );
   ```

5. **Structured logging:**
   ```typescript
   console.log(`[TicketUsed] tokenId=${tokenId}, eventId=${eventId}, block=${blockNumber}, txHash=${txHash}`);
   ```

---

## 5. Sync State Management & Checkpointing

### 5.1 `SyncState` Model (Already Exists)

```typescript
export interface ISyncState extends Document {
  lastProcessedBlock: number;
  updatedAt: Date;
}
```

- The listener maintains a **singleton** `SyncState` document in MongoDB.
- After processing a batch of events (or every 10 blocks in real-time mode), the listener updates:
  ```typescript
  await SyncState.findOneAndUpdate(
    {},
    { lastProcessedBlock: latestBlock },
    { upsert: true, new: true }
  );
  ```

### 5.2 Startup Recovery Flow

```typescript
async function catchUpFromLastCheckpoint(): Promise<void> {
  // 1. Read checkpoint
  const syncState = await SyncState.findOne({});
  const fromBlock = syncState?.lastProcessedBlock ?? env.CONTRACT_DEPLOYMENT_BLOCK;
  const toBlock = await provider.getBlockNumber();

  console.log(`[Listener] Starting catch-up from block ${fromBlock} to ${toBlock}...`);

  // 2. Query historical logs in batches (to avoid RPC query size limits)
  const BATCH_SIZE = 1000; // Optimism Sepolia typically supports 1000-2000 block ranges
  for (let start = fromBlock + 1; start <= toBlock; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, toBlock);

    const mintedLogs = await contract.queryFilter('TicketMinted', start, end);
    const transferredLogs = await contract.queryFilter('TicketTransferred', start, end);
    const usedLogs = await contract.queryFilter('TicketUsed', start, end);

    // 3. Merge and sort all logs by blockNumber, then logIndex
    const allLogs = [...mintedLogs, ...transferredLogs, ...usedLogs]
      .sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        return (a.logIndex ?? 0) - (b.logIndex ?? 0);
      });

    // 4. Process each log sequentially
    for (const log of allLogs) {
      if (log.eventName === 'TicketMinted') await handleTicketMinted(log);
      if (log.eventName === 'TicketTransferred') await handleTicketTransferred(log);
      if (log.eventName === 'TicketUsed') await handleTicketUsed(log);
    }

    // 5. Update checkpoint
    await SyncState.findOneAndUpdate({}, { lastProcessedBlock: end }, { upsert: true });
    console.log(`[Listener] Processed blocks ${start}-${end}`);
  }

  console.log(`[Listener] Catch-up complete. Synced to block ${toBlock}.`);
}
```

### 5.3 Real-Time Listening

After catch-up, the listener subscribes to live events:

```typescript
async function subscribeToEvents(): Promise<void> {
  console.log('[Listener] Starting real-time event subscription...');

  contract.on('TicketMinted', async (tokenId, eventId, owner, tokenURI, event) => {
    try {
      await handleTicketMinted(event);
      await updateCheckpoint(event.blockNumber);
    } catch (error) {
      console.error('[TicketMinted] Handler error:', error);
    }
  });

  contract.on('TicketTransferred', async (tokenId, from, to, event) => {
    try {
      await handleTicketTransferred(event);
      await updateCheckpoint(event.blockNumber);
    } catch (error) {
      console.error('[TicketTransferred] Handler error:', error);
    }
  });

  contract.on('TicketUsed', async (tokenId, eventId, event) => {
    try {
      await handleTicketUsed(event);
      await updateCheckpoint(event.blockNumber);
    } catch (error) {
      console.error('[TicketUsed] Handler error:', error);
    }
  });

  isListening = true;
}
```

---

## 6. Error Handling & Resilience

### 6.1 RPC Connection Failures

**Problem:** WebSocket or HTTP RPC connection drops due to network issues, provider rate limits, or infrastructure outages.

**Solution:**
```typescript
async function connectWithRetry(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      provider = new ethers.WebSocketProvider(env.WS_RPC_URL);
      await provider.getBlockNumber(); // Test connection
      console.log('[Listener] Connected to RPC provider');
      return;
    } catch (error) {
      console.error(`[Listener] Connection attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * 2 ** attempt, 30000); // Exponential backoff, max 30s
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw new Error('Failed to connect to RPC provider after maximum retries');
      }
    }
  }
}

// Auto-reconnect on WebSocket close
provider.on('close', () => {
  console.warn('[Listener] WebSocket closed. Reconnecting...');
  isListening = false;
  connectWithRetry().then(() => start());
});
```

### 6.2 Duplicate Event Processing (Idempotency)

**Problem:** The same event might be received multiple times due to:
- RPC provider rebroadcasting events after reconnection.
- Overlapping catch-up and real-time subscription windows.
- Blockchain reorganizations (reorgs).

**Solution:** Every handler checks for existing records before creating/updating:
- `Ticket.findOne({ tokenId })` → compare `mintTxHash` or `lastTransferTxHash`.
- `Transaction.findOne({ txHash, type })` → skip if exists.
- `findOneAndUpdate` with `upsert: true` for atomic writes.

### 6.3 Blockchain Reorganizations (Reorgs)

**Problem:** Optimism Sepolia (and all EVM chains) can experience chain reorganizations where blocks are replaced.

**Solution (Out of Scope for MVP, but documented for future work):**
- **Current approach:** Wait for 1 block confirmation before processing (already done in `tx.wait(1)` for backend-initiated transactions).
- **Future improvement:** Implement a "confirmations buffer" where events are only considered final after N blocks (e.g., 5-10 confirmations). This requires:
  - Storing events in a temporary "pending" table with their block number.
  - Periodically checking if blocks are still canonical.
  - Rolling back "pending" events if their block disappears.
- **For BE-09 MVP:** Accept 1-block confirmation as sufficient (Optimism Sepolia reorgs are rare and shallow).

### 6.4 MongoDB Write Failures

**Problem:** MongoDB connection drops, disk full, or replica set unavailable during event processing.

**Solution:**
- Catch all MongoDB errors in handlers.
- **Do NOT update `SyncState.lastProcessedBlock`** if any event in a batch fails to process.
- On next startup, the listener will replay from the last successful checkpoint, reprocessing failed events (idempotency guarantees this is safe).

```typescript
try {
  await handleTicketMinted(event);
} catch (error) {
  console.error('[TicketMinted] Failed to process event:', error);
  // Do not update checkpoint - this event will be retried on next startup
  throw error; // Or: add to a dead-letter queue for manual review
}
```

---

## 7. Deployment & Lifecycle Management

### 7.1 Running the Listener as a Separate Process

**Option 1: Standalone Node.js Process (Recommended for MVP)**

Create `backend/src/features/listener/index.ts`:

```typescript
import { connectDB } from '@/shared/db/connect';
import { ListenerService } from './listener.service';

async function main() {
  console.log('[Listener] Starting Event Listener Service...');
  
  await connectDB();
  
  const listener = new ListenerService();
  await listener.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[Listener] Received SIGINT, shutting down gracefully...');
    await listener.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[Listener] Received SIGTERM, shutting down gracefully...');
    await listener.stop();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('[Listener] Fatal error:', error);
  process.exit(1);
});
```

**package.json script:**
```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "listener": "tsx src/features/listener/index.ts",
    "listener:watch": "tsx watch src/features/listener/index.ts"
  }
}
```

**Development:** Run in separate terminals:
```bash
npm run dev       # Express API
npm run listener  # Event listener
```

**Production:** Use a process manager (PM2, Docker Compose, Kubernetes):
```bash
pm2 start npm --name "authentix-api" -- start
pm2 start npm --name "authentix-listener" -- run listener
```

### 7.2 Docker Compose Configuration (Future: TASK-DO-01)

```yaml
services:
  api:
    build: ./backend
    command: npm start
    environment:
      - MONGODB_URI=mongodb://mongo:27017/authentix
      - RPC_URL=https://sepolia.optimism.io
    depends_on:
      - mongo

  listener:
    build: ./backend
    command: npm run listener
    environment:
      - MONGODB_URI=mongodb://mongo:27017/authentix
      - WS_RPC_URL=wss://sepolia.optimism.io
    depends_on:
      - mongo
    restart: always

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
```

---

## 8. Environment Variables

Add to `backend/src/config/env.schema.ts`:

```typescript
export const envSchema = z.object({
  // Existing...
  RPC_URL: z.string().url(),
  WS_RPC_URL: z.string().url().optional(), // WebSocket RPC for real-time listening
  CONTRACT_DEPLOYMENT_BLOCK: z.string().transform(Number), // Starting block for initial catch-up
  LISTENER_BATCH_SIZE: z.string().transform(Number).default('1000'), // Historical log query batch size
  LISTENER_CHECKPOINT_INTERVAL: z.string().transform(Number).default('10'), // Blocks between checkpoints
});
```

Example `.env`:
```bash
RPC_URL=https://sepolia.optimism.io
WS_RPC_URL=wss://sepolia.optimism.io
CONTRACT_DEPLOYMENT_BLOCK=14325678
LISTENER_BATCH_SIZE=1000
LISTENER_CHECKPOINT_INTERVAL=10
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (`listener.service.test.ts`)

**Test Coverage:**
1. **Catch-up recovery:**
   - Mock `SyncState.findOne()` returning `{ lastProcessedBlock: 1000 }`.
   - Mock `provider.getBlockNumber()` returning `1050`.
   - Mock `contract.queryFilter()` returning test event logs.
   - Assert that all 3 handlers are called in correct order.
   - Assert that `SyncState` is updated to block `1050`.

2. **Idempotency:**
   - Process the same `TicketMinted` event twice.
   - Assert that `Ticket` and `Transaction` are created once only.

3. **Real-time subscription:**
   - Mock `contract.on('TicketMinted', callback)`.
   - Simulate event emission.
   - Assert handler is invoked and checkpoint updated.

4. **Error handling:**
   - Simulate MongoDB connection failure during event processing.
   - Assert that `SyncState.lastProcessedBlock` is NOT updated.
   - Restart listener and assert event is reprocessed.

5. **Graceful shutdown:**
   - Call `listener.stop()`.
   - Assert that `contract.removeAllListeners()` is called.
   - Assert MongoDB connection is closed.

### 9.2 Integration Tests (`listener.integration.test.ts`)

**Test Setup:**
- Use `mongodb-memory-server` for ephemeral MongoDB.
- Use Hardhat local node or Foundry Anvil for test blockchain.
- Deploy `EventTicketNFT` contract to local chain.
- Mint test tickets and emit events.

**Test Scenarios:**
1. **Full catch-up from deployment block:**
   - Mint 10 tickets on local chain.
   - Start listener from block 0.
   - Assert all 10 tickets exist in MongoDB with correct ownership.

2. **Real-time event processing:**
   - Start listener.
   - Mint a new ticket on-chain.
   - Wait for listener to process (poll MongoDB for ticket).
   - Assert ticket appears in MongoDB within 5 seconds.

3. **Transfer ownership:**
   - Mint ticket to Alice.
   - Transfer to Bob on-chain.
   - Assert `Ticket.ownerWallet` updates to Bob's address.
   - Assert `Transaction` with `type: 'transfer'` is created.

4. **Ticket redemption:**
   - Mint ticket and mark as used on-chain.
   - Assert `Ticket.isUsed === true` and `usedAt` is set.
   - Assert `Transaction` with `type: 'redeem'` is created.

5. **Listener restart and recovery:**
   - Start listener, process 5 events.
   - Stop listener (simulate crash).
   - Emit 3 more events while listener is down.
   - Restart listener.
   - Assert all 8 events are in MongoDB (catch-up works).

---

## 10. Success Criteria

TASK-BE-09 is complete when:

1. ✅ **Listener service starts successfully** and connects to MongoDB + RPC provider.
2. ✅ **Startup recovery** replays all historical events from `lastProcessedBlock` to current block.
3. ✅ **Real-time listening** processes `TicketMinted`, `TicketTransferred`, and `TicketUsed` events within 5 seconds of emission.
4. ✅ **MongoDB sync** accurately reflects on-chain state for:
   - Ticket ownership (`ownerWallet`).
   - Ticket redemption status (`isUsed`, `usedAt`).
   - Transaction audit log (`Transaction` collection).
5. ✅ **Idempotency** guarantees that duplicate events do not corrupt data.
6. ✅ **Graceful shutdown** stops listeners and closes connections cleanly.
7. ✅ **Error recovery** reconnects to RPC provider after connection loss.
8. ✅ **Unit and integration tests** achieve >90% coverage for listener logic.
9. ✅ **Documentation** includes setup instructions and operational runbook.

---

## 11. Future Enhancements (Out of Scope for BE-09)

1. **Dead-letter queue** for events that fail to process after N retries (e.g., Redis queue, AWS SQS).
2. **Prometheus metrics** for monitoring:
   - Events processed per second.
   - Lag (current block - `lastProcessedBlock`).
   - Error rate.
3. **Multi-instance coordination** using MongoDB locks or Redis for distributed listener deployments.
4. **Reorg detection and rollback** for deep chain reorganizations (requires block hash tracking).
5. **Admin API endpoint** `POST /api/admin/sync/trigger` to manually force a catch-up (for debugging).
6. **Event filtering by contract version** if the contract is upgraded in the future (proxy pattern).

---

## 12. Security Considerations

1. **RPC endpoint security:**
   - Use authenticated RPC providers (e.g., Alchemy, Infura with API keys).
   - **Never** expose `WS_RPC_URL` or `RPC_URL` in client-side code.

2. **MongoDB access control:**
   - Listener service should have `readWrite` permissions on `authentix` database only.
   - Use MongoDB authentication (`MONGODB_URI` with username/password).

3. **Log sanitization:**
   - **Never** log private keys or sensitive user data.
   - Log wallet addresses in lowercase for consistency.

4. **Rate limiting:**
   - Respect RPC provider rate limits (e.g., Alchemy: 330 requests/second on free tier).
   - Implement exponential backoff for RPC errors (already covered in §6.1).

5. **Auditability:**
   - Every `Transaction` record includes `txHash` for on-chain verification.
   - Admins can always cross-reference MongoDB state with blockchain explorers (Etherscan, Blockscout).

---

## 13. Acceptance Testing Script

```bash
# Terminal 1: Start MongoDB
docker run -d -p 27017:27017 mongo:7

# Terminal 2: Start local Hardhat node (if testing against local chain)
cd contracts && npx hardhat node

# Terminal 3: Deploy contract (if testing against local chain)
cd contracts && npx hardhat run scripts/deploy.ts --network localhost

# Terminal 4: Start Event Listener
cd backend && npm run listener:watch

# Terminal 5: Mint test tickets (trigger events)
cd contracts && npx hardhat run scripts/mintTestTickets.ts --network localhost

# Verify in MongoDB:
mongosh
use authentix
db.tickets.find()           # Should show minted tickets
db.transactions.find()      # Should show mint transactions
db.syncstates.findOne()     # Should show updated lastProcessedBlock

# Test restart recovery:
# 1. Stop listener (Ctrl+C in Terminal 4)
# 2. Mint more tickets (Terminal 5)
# 3. Restart listener (Terminal 4)
# 4. Verify new tickets appear in MongoDB (catch-up worked)
```

---

**Document Status:** Ready for Implementation  
**Assigned Task:** TASK-BE-09  
**Implementation Plan:** `docs/superpowers/plans/2026-10-01-task-be-09-event-listener-implementation-plan.md`
