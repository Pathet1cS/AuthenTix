# Implementation Plan: TASK-BE-09 Blockchain Event Listener & Recovery Engine

- **Plan Version:** 1.0.0
- **Date:** 2026-10-01
- **Status:** Ready for Execution
- **Design Specification:** `docs/superpowers/specs/2026-10-01-task-be-09-event-listener-design.md`
- **Target Branch:** `feature/be-09-event-listener`
- **Estimated Duration:** 8-12 hours

---

## 1. Task Overview

Implement a standalone background service that continuously monitors the `EventTicketNFT` smart contract on Optimism Sepolia for on-chain events (`TicketMinted`, `TicketTransferred`, `TicketUsed`) and synchronizes them to MongoDB in real-time. The service must support:

- **Startup recovery** (catch-up from last checkpoint).
- **Real-time event listening** (WebSocket or polling).
- **Idempotent event processing** (safe to replay events).
- **Checkpoint management** (track `lastProcessedBlock` in MongoDB).
- **Error recovery** (reconnect on RPC failures, rollback on MongoDB failures).

---

## 2. Prerequisites

Before starting implementation:

- [x] Smart contract deployed to Optimism Sepolia (from TASK-BC-04).
- [x] MongoDB models exist: `Ticket`, `Transaction`, `SyncState`, `Event` (from TASK-BE-02).
- [x] `BlockchainService` exists with contract ABI and provider setup (from TASK-BE-06).
- [x] Environment variables configured: `RPC_URL`, `CONTRACT_ADDRESS`, `MONGODB_URI`.

---

## 3. Implementation Tasks

### **Task 1: Environment & Configuration Setup**

**Duration:** 30 minutes

**Files to Create/Modify:**
- `backend/src/config/env.schema.ts`
- `backend/.env.example`

**Implementation Steps:**

1. **Update `env.schema.ts`** to add listener-specific environment variables:
   ```typescript
   export const envSchema = z.object({
     // ... existing variables
     RPC_URL: z.string().url(),
     WS_RPC_URL: z.string().url().optional(),
     CONTRACT_DEPLOYMENT_BLOCK: z.string().transform(Number),
     LISTENER_BATCH_SIZE: z.string().transform(Number).default('1000'),
     LISTENER_CHECKPOINT_INTERVAL: z.string().transform(Number).default('10'),
   });
   ```

2. **Update `.env.example`** with new variables:
   ```bash
   # Blockchain Listener Configuration
   RPC_URL=https://sepolia.optimism.io
   WS_RPC_URL=wss://sepolia.optimism.io
   CONTRACT_DEPLOYMENT_BLOCK=14325678
   LISTENER_BATCH_SIZE=1000
   LISTENER_CHECKPOINT_INTERVAL=10
   ```

3. **Add to local `.env`** (copy from `.env.example`, fill with actual deployment block number).

**Testing:**
- Run `npm run dev` and verify no Zod validation errors.
- `console.log(env.CONTRACT_DEPLOYMENT_BLOCK)` should output a number, not a string.

**Commit Message:**
```
feat(config): add event listener environment variables

- Add WS_RPC_URL, CONTRACT_DEPLOYMENT_BLOCK, LISTENER_BATCH_SIZE, LISTENER_CHECKPOINT_INTERVAL
- Update env.schema.ts with validation
- Update .env.example with listener configuration
```

---

### **Task 2: Event Handler Types & Utilities**

**Duration:** 30 minutes

**Files to Create:**
- `backend/src/features/listener/listener.types.ts`
- `backend/src/features/listener/utils/blockTimestamp.ts`

**Implementation Steps:**

1. **Create `listener.types.ts`** with TypeScript interfaces for event logs:
   ```typescript
   import { ethers } from 'ethers';

   export interface TicketMintedEvent {
     tokenId: bigint;
     eventId: bigint;
     owner: string;
     tokenURI: string;
   }

   export interface TicketTransferredEvent {
     tokenId: bigint;
     from: string;
     to: string;
   }

   export interface TicketUsedEvent {
     tokenId: bigint;
     eventId: bigint;
   }

   export interface ParsedEventLog {
     eventName: string;
     args: TicketMintedEvent | TicketTransferredEvent | TicketUsedEvent;
     blockNumber: number;
     blockHash: string;
     transactionHash: string;
     logIndex: number;
   }
   ```

2. **Create `utils/blockTimestamp.ts`** to fetch block timestamps:
   ```typescript
   import { ethers } from 'ethers';

   const blockTimestampCache = new Map<number, number>();

   export async function getBlockTimestamp(
     provider: ethers.Provider,
     blockNumber: number
   ): Promise<number> {
     if (blockTimestampCache.has(blockNumber)) {
       return blockTimestampCache.get(blockNumber)!;
     }

     const block = await provider.getBlock(blockNumber);
     if (!block) {
       throw new Error(`Block ${blockNumber} not found`);
     }

     blockTimestampCache.set(blockNumber, block.timestamp);
     return block.timestamp;
   }
   ```

**Testing:**
- TypeScript compilation: `npm run build` should succeed.
- No runtime tests needed yet (types only).

**Commit Message:**
```
feat(listener): add event types and block timestamp utility

- Define TypeScript interfaces for TicketMinted, TicketTransferred, TicketUsed events
- Add blockTimestamp caching utility to reduce RPC calls
```

---

### **Task 3: Event Handlers — TicketMinted**

**Duration:** 1.5 hours

**Files to Create:**
- `backend/src/features/listener/handlers/ticketMinted.handler.ts`
- `backend/src/features/listener/handlers/ticketMinted.handler.test.ts`

**Implementation Steps:**

1. **Create `ticketMinted.handler.ts`**:
   ```typescript
   import { ethers } from 'ethers';
   import { Ticket } from '@/shared/models/ticket.model';
   import { Transaction } from '@/shared/models/transaction.model';
   import { Event } from '@/shared/models/event.model';
   import { TicketMintedEvent, ParsedEventLog } from '../listener.types';
   import { getBlockTimestamp } from '../utils/blockTimestamp';

   export async function handleTicketMinted(
     event: ParsedEventLog,
     provider: ethers.Provider
   ): Promise<void> {
     const { tokenId, eventId, owner, tokenURI } = event.args as TicketMintedEvent;
     const { transactionHash: txHash, blockNumber } = event;

     const tokenIdStr = tokenId.toString();
     const eventIdStr = eventId.toString();
     const ownerLower = owner.toLowerCase();

     // Idempotency check
     const existingTicket = await Ticket.findOne({ tokenId: tokenIdStr });
     if (existingTicket && existingTicket.mintTxHash === txHash) {
       console.log(`[TicketMinted] Already processed tokenId=${tokenIdStr}, txHash=${txHash}`);
       return;
     }

     // Fetch MongoDB Event document by onChainEventId
     const eventDoc = await Event.findOne({ onChainEventId: parseInt(eventIdStr) });
     if (!eventDoc) {
       console.error(`[TicketMinted] Event not found: onChainEventId=${eventIdStr}, tokenId=${tokenIdStr}`);
       throw new Error(`Event ${eventIdStr} not found in database`);
     }

     // Get block timestamp
     const blockTimestamp = await getBlockTimestamp(provider, blockNumber);

     // Upsert Ticket
     await Ticket.findOneAndUpdate(
       { tokenId: tokenIdStr },
       {
         tokenId: tokenIdStr,
         eventId: eventDoc._id,
         ownerWallet: ownerLower,
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

     // Upsert Transaction audit log
     await Transaction.findOneAndUpdate(
       { txHash },
       {
         txHash,
         type: 'mint',
         tokenId: tokenIdStr,
         fromWallet: ethers.ZeroAddress,
         toWallet: ownerLower,
         price: 0,
         timestamp: new Date(blockTimestamp * 1000),
         status: 'SUCCESS',
       },
       { upsert: true }
     );

     // Decrement event remaining quota
     await Event.findByIdAndUpdate(eventDoc._id, {
       $inc: { remainingQuota: -1 },
     });

     console.log(`[TicketMinted] Processed tokenId=${tokenIdStr}, owner=${ownerLower}, block=${blockNumber}, txHash=${txHash}`);
   }
   ```

2. **Create `ticketMinted.handler.test.ts`** (unit test with `mongodb-memory-server`):
   ```typescript
   import { MongoMemoryServer } from 'mongodb-memory-server';
   import mongoose from 'mongoose';
   import { ethers } from 'ethers';
   import { handleTicketMinted } from './ticketMinted.handler';
   import { Ticket } from '@/shared/models/ticket.model';
   import { Transaction } from '@/shared/models/transaction.model';
   import { Event } from '@/shared/models/event.model';
   import { ParsedEventLog } from '../listener.types';

   let mongoServer: MongoMemoryServer;

   beforeAll(async () => {
     mongoServer = await MongoMemoryServer.create();
     await mongoose.connect(mongoServer.getUri());
   });

   afterAll(async () => {
     await mongoose.disconnect();
     await mongoServer.stop();
   });

   afterEach(async () => {
     await Ticket.deleteMany({});
     await Transaction.deleteMany({});
     await Event.deleteMany({});
   });

   describe('handleTicketMinted', () => {
     const mockProvider = {
       getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
     } as any;

     it('should create Ticket and Transaction records on first call', async () => {
       // Setup: Create Event document
       const eventDoc = await Event.create({
         organizerId: new mongoose.Types.ObjectId(),
         onChainEventId: 1,
         name: 'Test Event',
         description: 'Test',
         eventDate: new Date('2026-12-01'),
         ticketPrice: 0.05,
         maxResalePrice: 0.075,
         saleDeadline: new Date('2026-11-30'),
         totalCapacity: 100,
         remainingQuota: 100,
         posterCID: 'ipfs://test',
         status: 'active',
       });

       const mockEvent: ParsedEventLog = {
         eventName: 'TicketMinted',
         args: {
           tokenId: 1n,
           eventId: 1n,
           owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
           tokenURI: 'ipfs://token1',
         },
         blockNumber: 1000,
         blockHash: '0xabc',
         transactionHash: '0x123',
         logIndex: 0,
       };

       await handleTicketMinted(mockEvent, mockProvider);

       const ticket = await Ticket.findOne({ tokenId: '1' });
       expect(ticket).toBeTruthy();
       expect(ticket?.ownerWallet).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
       expect(ticket?.tokenURI).toBe('ipfs://token1');
       expect(ticket?.mintTxHash).toBe('0x123');

       const transaction = await Transaction.findOne({ txHash: '0x123' });
       expect(transaction).toBeTruthy();
       expect(transaction?.type).toBe('mint');
       expect(transaction?.tokenId).toBe('1');

       const updatedEvent = await Event.findById(eventDoc._id);
       expect(updatedEvent?.remainingQuota).toBe(99);
     });

     it('should skip processing if event already processed (idempotency)', async () => {
       const eventDoc = await Event.create({
         organizerId: new mongoose.Types.ObjectId(),
         onChainEventId: 1,
         name: 'Test Event',
         description: 'Test',
         eventDate: new Date('2026-12-01'),
         ticketPrice: 0.05,
         maxResalePrice: 0.075,
         saleDeadline: new Date('2026-11-30'),
         totalCapacity: 100,
         remainingQuota: 100,
         posterCID: 'ipfs://test',
         status: 'active',
       });

       await Ticket.create({
         tokenId: '1',
         eventId: eventDoc._id,
         ownerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
         tokenURI: 'ipfs://token1',
         mintTxHash: '0x123',
         blockNumber: 1000,
       });

       const mockEvent: ParsedEventLog = {
         eventName: 'TicketMinted',
         args: { tokenId: 1n, eventId: 1n, owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', tokenURI: 'ipfs://token1' },
         blockNumber: 1000,
         blockHash: '0xabc',
         transactionHash: '0x123',
         logIndex: 0,
       };

       await handleTicketMinted(mockEvent, mockProvider);

       const tickets = await Ticket.find({ tokenId: '1' });
       expect(tickets).toHaveLength(1); // Should not create duplicate

       const updatedEvent = await Event.findById(eventDoc._id);
       expect(updatedEvent?.remainingQuota).toBe(100); // Should not decrement again
     });
   });
   ```

**Testing:**
```bash
npm test -- ticketMinted.handler.test.ts
```

**Commit Message:**
```
feat(listener): implement TicketMinted event handler

- Create Ticket and Transaction records from TicketMinted events
- Implement idempotency check (skip if already processed)
- Decrement Event remainingQuota on mint
- Add comprehensive unit tests with mongodb-memory-server
```

---

### **Task 4: Event Handlers — TicketTransferred**

**Duration:** 1.5 hours

**Files to Create:**
- `backend/src/features/listener/handlers/ticketTransferred.handler.ts`
- `backend/src/features/listener/handlers/ticketTransferred.handler.test.ts`

**Implementation Steps:**

1. **Create `ticketTransferred.handler.ts`**:
   ```typescript
   import { ethers } from 'ethers';
   import { Ticket } from '@/shared/models/ticket.model';
   import { Transaction } from '@/shared/models/transaction.model';
   import { TicketTransferredEvent, ParsedEventLog } from '../listener.types';
   import { getBlockTimestamp } from '../utils/blockTimestamp';

   export async function handleTicketTransferred(
     event: ParsedEventLog,
     provider: ethers.Provider
   ): Promise<void> {
     const { tokenId, from, to } = event.args as TicketTransferredEvent;
     const { transactionHash: txHash, blockNumber } = event;

     const tokenIdStr = tokenId.toString();
     const fromLower = from.toLowerCase();
     const toLower = to.toLowerCase();

     // Idempotency check: skip if Transaction already exists with type 'transfer' or 'resell'
     const existingTx = await Transaction.findOne({ txHash });
     if (existingTx) {
       console.log(`[TicketTransferred] Already processed tokenId=${tokenIdStr}, txHash=${txHash}, type=${existingTx.type}`);
       return;
     }

     // Check if this is a resale (ListingSold was processed by API, Transaction type='resell' exists)
     // If BE-07 API already created a 'resell' transaction, we skip this transfer event
     // (This check is redundant with the above, but explicit for clarity)

     // Get block timestamp
     const blockTimestamp = await getBlockTimestamp(provider, blockNumber);

     // Update Ticket ownership
     const ticket = await Ticket.findOneAndUpdate(
       { tokenId: tokenIdStr },
       {
         ownerWallet: toLower,
         lastTransferTxHash: txHash,
         blockNumber,
         isListed: false,        // Transfer clears any active listing
         resalePrice: null,
         listingTxHash: '',
       },
       { new: true }
     );

     if (!ticket) {
       console.error(`[TicketTransferred] Ticket not found: tokenId=${tokenIdStr}`);
       throw new Error(`Ticket ${tokenIdStr} not found in database`);
     }

     // Create Transaction audit log (type: 'transfer' for pure transfers)
     await Transaction.create({
       txHash,
       type: 'transfer',
       tokenId: tokenIdStr,
       fromWallet: fromLower,
       toWallet: toLower,
       price: 0,
       timestamp: new Date(blockTimestamp * 1000),
       status: 'SUCCESS',
     });

     console.log(`[TicketTransferred] Processed tokenId=${tokenIdStr}, from=${fromLower}, to=${toLower}, block=${blockNumber}, txHash=${txHash}`);
   }
   ```

2. **Create `ticketTransferred.handler.test.ts`**:
   ```typescript
   import { MongoMemoryServer } from 'mongodb-memory-server';
   import mongoose from 'mongoose';
   import { handleTicketTransferred } from './ticketTransferred.handler';
   import { Ticket } from '@/shared/models/ticket.model';
   import { Transaction } from '@/shared/models/transaction.model';
   import { Event } from '@/shared/models/event.model';
   import { ParsedEventLog } from '../listener.types';

   let mongoServer: MongoMemoryServer;

   beforeAll(async () => {
     mongoServer = await MongoMemoryServer.create();
     await mongoose.connect(mongoServer.getUri());
   });

   afterAll(async () => {
     await mongoose.disconnect();
     await mongoServer.stop();
   });

   afterEach(async () => {
     await Ticket.deleteMany({});
     await Transaction.deleteMany({});
     await Event.deleteMany({});
   });

   describe('handleTicketTransferred', () => {
     const mockProvider = {
       getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
     } as any;

     it('should update Ticket ownership and create Transaction', async () => {
       const eventDoc = await Event.create({
         organizerId: new mongoose.Types.ObjectId(),
         onChainEventId: 1,
         name: 'Test Event',
         eventDate: new Date('2026-12-01'),
         ticketPrice: 0.05,
         maxResalePrice: 0.075,
         saleDeadline: new Date('2026-11-30'),
         totalCapacity: 100,
         remainingQuota: 99,
         posterCID: 'ipfs://test',
         status: 'active',
       });

       await Ticket.create({
         tokenId: '1',
         eventId: eventDoc._id,
         ownerWallet: '0xalice',
         tokenURI: 'ipfs://token1',
         mintTxHash: '0xmint',
         blockNumber: 1000,
       });

       const mockEvent: ParsedEventLog = {
         eventName: 'TicketTransferred',
         args: {
           tokenId: 1n,
           from: '0xAlice',
           to: '0xBob',
         },
         blockNumber: 1050,
         blockHash: '0xdef',
         transactionHash: '0xtransfer',
         logIndex: 0,
       };

       await handleTicketTransferred(mockEvent, mockProvider);

       const ticket = await Ticket.findOne({ tokenId: '1' });
       expect(ticket?.ownerWallet).toBe('0xbob');
       expect(ticket?.lastTransferTxHash).toBe('0xtransfer');
       expect(ticket?.isListed).toBe(false);

       const transaction = await Transaction.findOne({ txHash: '0xtransfer' });
       expect(transaction?.type).toBe('transfer');
       expect(transaction?.fromWallet).toBe('0xalice');
       expect(transaction?.toWallet).toBe('0xbob');
     });

     it('should skip processing if transaction already exists (idempotency)', async () => {
       const eventDoc = await Event.create({
         organizerId: new mongoose.Types.ObjectId(),
         onChainEventId: 1,
         name: 'Test Event',
         eventDate: new Date('2026-12-01'),
         ticketPrice: 0.05,
         maxResalePrice: 0.075,
         saleDeadline: new Date('2026-11-30'),
         totalCapacity: 100,
         remainingQuota: 99,
         posterCID: 'ipfs://test',
         status: 'active',
       });

       await Ticket.create({
         tokenId: '1',
         eventId: eventDoc._id,
         ownerWallet: '0xbob',
         tokenURI: 'ipfs://token1',
         mintTxHash: '0xmint',
         blockNumber: 1000,
         lastTransferTxHash: '0xtransfer',
       });

       await Transaction.create({
         txHash: '0xtransfer',
         type: 'transfer',
         tokenId: '1',
         fromWallet: '0xalice',
         toWallet: '0xbob',
         price: 0,
         timestamp: new Date(),
         status: 'SUCCESS',
       });

       const mockEvent: ParsedEventLog = {
         eventName: 'TicketTransferred',
         args: { tokenId: 1n, from: '0xAlice', to: '0xBob' },
         blockNumber: 1050,
         blockHash: '0xdef',
         transactionHash: '0xtransfer',
         logIndex: 0,
       };

       await handleTicketTransferred(mockEvent, mockProvider);

       const transactions = await Transaction.find({ txHash: '0xtransfer' });
       expect(transactions).toHaveLength(1); // Should not create duplicate
     });
   });
   ```

**Testing:**
```bash
npm test -- ticketTransferred.handler.test.ts
```

**Commit Message:**
```
feat(listener): implement TicketTransferred event handler

- Update Ticket ownership and lastTransferTxHash
- Clear resale listing status on transfer
- Create Transaction audit log with type 'transfer'
- Add unit tests for ownership updates and idempotency
```

---

### **Task 5: Event Handlers — TicketUsed**

**Duration:** 1 hour

**Files to Create:**
- `backend/src/features/listener/handlers/ticketUsed.handler.ts`
- `backend/src/features/listener/handlers/ticketUsed.handler.test.ts`

**Implementation Steps:**

1. **Create `ticketUsed.handler.ts`**:
   ```typescript
   import { ethers } from 'ethers';
   import { Ticket } from '@/shared/models/ticket.model';
   import { Transaction } from '@/shared/models/transaction.model';
   import { TicketUsedEvent, ParsedEventLog } from '../listener.types';
   import { getBlockTimestamp } from '../utils/blockTimestamp';

   export async function handleTicketUsed(
     event: ParsedEventLog,
     provider: ethers.Provider
   ): Promise<void> {
     const { tokenId, eventId } = event.args as TicketUsedEvent;
     const { transactionHash: txHash, blockNumber } = event;

     const tokenIdStr = tokenId.toString();

     // Idempotency check
     const existingTx = await Transaction.findOne({ txHash, type: 'redeem' });
     if (existingTx) {
       console.log(`[TicketUsed] Already processed tokenId=${tokenIdStr}, txHash=${txHash}`);
       return;
     }

     // Get block timestamp
     const blockTimestamp = await getBlockTimestamp(provider, blockNumber);

     // Update Ticket redemption status
     const ticket = await Ticket.findOneAndUpdate(
       { tokenId: tokenIdStr },
       {
         isUsed: true,
         usedAt: new Date(blockTimestamp * 1000),
         isListed: false,
         resalePrice: null,
         listingTxHash: '',
       },
       { new: true }
     );

     if (!ticket) {
       console.error(`[TicketUsed] Ticket not found: tokenId=${tokenIdStr}`);
       throw new Error(`Ticket ${tokenIdStr} not found in database`);
     }

     // Create Transaction audit log (type: 'redeem')
     await Transaction.create({
       txHash,
       type: 'redeem',
       tokenId: tokenIdStr,
       fromWallet: ticket.ownerWallet,
       toWallet: ticket.ownerWallet,
       price: 0,
       timestamp: new Date(blockTimestamp * 1000),
       status: 'SUCCESS',
     });

     console.log(`[TicketUsed] Processed tokenId=${tokenIdStr}, eventId=${eventId}, block=${blockNumber}, txHash=${txHash}`);
   }
   ```

2. **Create `ticketUsed.handler.test.ts`** (similar structure to previous tests).

**Testing:**
```bash
npm test -- ticketUsed.handler.test.ts
```

**Commit Message:**
```
feat(listener): implement TicketUsed event handler

- Mark Ticket as isUsed and set usedAt timestamp
- Clear resale listing status on redemption
- Create Transaction audit log with type 'redeem'
- Add unit tests for redemption logic and idempotency
```

---

### **Task 6: Core Listener Service — Catch-Up Recovery**

**Duration:** 2 hours

**Files to Create:**
- `backend/src/features/listener/listener.service.ts` (partial)

**Implementation Steps:**

1. **Create `listener.service.ts`** with catch-up logic:
   ```typescript
   import { ethers } from 'ethers';
   import { env } from '@/config/env';
   import { SyncState } from '@/shared/models/syncState.model';
   import { EVENT_TICKET_NFT_ABI } from '@/shared/services/blockchain.service';
   import { handleTicketMinted } from './handlers/ticketMinted.handler';
   import { handleTicketTransferred } from './handlers/ticketTransferred.handler';
   import { handleTicketUsed } from './handlers/ticketUsed.handler';
   import { ParsedEventLog } from './listener.types';

   export class ListenerService {
     private provider!: ethers.WebSocketProvider | ethers.JsonRpcProvider;
     private contract!: ethers.Contract;
     private isListening: boolean = false;

     constructor() {}

     async start(): Promise<void> {
       console.log('[Listener] Starting Event Listener Service...');
       
       await this.connectProvider();
       await this.catchUpFromLastCheckpoint();
       await this.subscribeToEvents();

       console.log('[Listener] Service is now running and listening for events.');
     }

     private async connectProvider(): Promise<void> {
       try {
         // Prefer WebSocket for real-time, fallback to HTTP
         if (env.WS_RPC_URL) {
           this.provider = new ethers.WebSocketProvider(env.WS_RPC_URL);
         } else {
           this.provider = new ethers.JsonRpcProvider(env.RPC_URL);
         }

         this.contract = new ethers.Contract(
           env.CONTRACT_ADDRESS,
           EVENT_TICKET_NFT_ABI,
           this.provider
         );

         // Test connection
         await this.provider.getBlockNumber();
         console.log('[Listener] Connected to blockchain provider');
       } catch (error) {
         console.error('[Listener] Failed to connect to provider:', error);
         throw error;
       }
     }

     private async catchUpFromLastCheckpoint(): Promise<void> {
       console.log('[Listener] Starting catch-up from last checkpoint...');

       const syncState = await SyncState.findOne({});
       const fromBlock = syncState?.lastProcessedBlock ?? env.CONTRACT_DEPLOYMENT_BLOCK;
       const toBlock = await this.provider.getBlockNumber();

       console.log(`[Listener] Catch-up range: block ${fromBlock} to ${toBlock}`);

       if (fromBlock >= toBlock) {
         console.log('[Listener] Already up-to-date, no catch-up needed.');
         return;
       }

       const BATCH_SIZE = env.LISTENER_BATCH_SIZE;

       for (let start = fromBlock + 1; start <= toBlock; start += BATCH_SIZE) {
         const end = Math.min(start + BATCH_SIZE - 1, toBlock);

         console.log(`[Listener] Querying logs from block ${start} to ${end}...`);

         try {
           const [mintedLogs, transferredLogs, usedLogs] = await Promise.all([
             this.contract.queryFilter('TicketMinted', start, end),
             this.contract.queryFilter('TicketTransferred', start, end),
             this.contract.queryFilter('TicketUsed', start, end),
           ]);

           // Merge and sort all logs by blockNumber, then logIndex
           const allLogs = [...mintedLogs, ...transferredLogs, ...usedLogs]
             .map(log => this.parseEventLog(log))
             .sort((a, b) => {
               if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
               return a.logIndex - b.logIndex;
             });

           console.log(`[Listener] Processing ${allLogs.length} events...`);

           // Process each log sequentially
           for (const log of allLogs) {
             await this.processEvent(log);
           }

           // Update checkpoint
           await SyncState.findOneAndUpdate(
             {},
             { lastProcessedBlock: end },
             { upsert: true }
           );

           console.log(`[Listener] Checkpoint updated to block ${end}`);
         } catch (error) {
           console.error(`[Listener] Error processing blocks ${start}-${end}:`, error);
           throw error;
         }
       }

       console.log('[Listener] Catch-up complete.');
     }

     private parseEventLog(log: ethers.EventLog): ParsedEventLog {
       return {
         eventName: log.eventName!,
         args: log.args as any,
         blockNumber: log.blockNumber,
         blockHash: log.blockHash,
         transactionHash: log.transactionHash,
         logIndex: log.index,
       };
     }

     private async processEvent(log: ParsedEventLog): Promise<void> {
       try {
         if (log.eventName === 'TicketMinted') {
           await handleTicketMinted(log, this.provider);
         } else if (log.eventName === 'TicketTransferred') {
           await handleTicketTransferred(log, this.provider);
         } else if (log.eventName === 'TicketUsed') {
           await handleTicketUsed(log, this.provider);
         }
       } catch (error) {
         console.error(`[Listener] Error processing ${log.eventName} event:`, error);
         throw error;
       }
     }

     private async subscribeToEvents(): Promise<void> {
       // Placeholder for Task 7
       console.log('[Listener] Real-time subscription not yet implemented.');
     }

     async stop(): Promise<void> {
       console.log('[Listener] Stopping listener service...');
       this.contract.removeAllListeners();
       if (this.provider && typeof (this.provider as any).destroy === 'function') {
         (this.provider as any).destroy();
       }
       this.isListening = false;
       console.log('[Listener] Listener service stopped.');
     }
   }
   ```

**Testing:**
- Manual test with local Hardhat node or Optimism Sepolia testnet.
- Verify logs show correct catch-up range and processed events.

**Commit Message:**
```
feat(listener): implement startup catch-up recovery mechanism

- Query historical logs from lastProcessedBlock to current block
- Process events in chronological order (blockNumber, logIndex)
- Update SyncState checkpoint every batch
- Add provider connection and contract initialization
```

---

### **Task 7: Core Listener Service — Real-Time Subscription**

**Duration:** 1.5 hours

**Files to Modify:**
- `backend/src/features/listener/listener.service.ts`

**Implementation Steps:**

1. **Extend `subscribeToEvents()` method**:
   ```typescript
   private async subscribeToEvents(): Promise<void> {
     console.log('[Listener] Starting real-time event subscription...');

     let lastCheckpointBlock = await this.provider.getBlockNumber();

     this.contract.on('TicketMinted', async (...args) => {
       const event = args[args.length - 1] as ethers.EventLog;
       try {
         await this.processEvent(this.parseEventLog(event));
         await this.updateCheckpointThrottled(event.blockNumber);
       } catch (error) {
         console.error('[TicketMinted] Real-time handler error:', error);
       }
     });

     this.contract.on('TicketTransferred', async (...args) => {
       const event = args[args.length - 1] as ethers.EventLog;
       try {
         await this.processEvent(this.parseEventLog(event));
         await this.updateCheckpointThrottled(event.blockNumber);
       } catch (error) {
         console.error('[TicketTransferred] Real-time handler error:', error);
       }
     });

     this.contract.on('TicketUsed', async (...args) => {
       const event = args[args.length - 1] as ethers.EventLog;
       try {
         await this.processEvent(this.parseEventLog(event));
         await this.updateCheckpointThrottled(event.blockNumber);
       } catch (error) {
         console.error('[TicketUsed] Real-time handler error:', error);
       }
     });

     this.isListening = true;
     console.log('[Listener] Real-time subscription active.');
   }

   private lastCheckpointUpdate = 0;
   private async updateCheckpointThrottled(blockNumber: number): Promise<void> {
     const now = Date.now();
     const CHECKPOINT_INTERVAL_MS = 30000; // 30 seconds

     if (now - this.lastCheckpointUpdate > CHECKPOINT_INTERVAL_MS) {
       await SyncState.findOneAndUpdate(
         {},
         { lastProcessedBlock: blockNumber },
         { upsert: true }
       );
       this.lastCheckpointUpdate = now;
       console.log(`[Listener] Checkpoint updated to block ${blockNumber}`);
     }
   }
   ```

**Testing:**
- Deploy test contract, emit events, verify listener processes them within 5 seconds.

**Commit Message:**
```
feat(listener): implement real-time event subscription

- Subscribe to TicketMinted, TicketTransferred, TicketUsed events
- Throttle checkpoint updates (every 30 seconds)
- Add error handling for real-time event processing
```

---

### **Task 8: Listener Entry Point & CLI Script**

**Duration:** 30 minutes

**Files to Create:**
- `backend/src/features/listener/index.ts`

**Files to Modify:**
- `backend/package.json`

**Implementation Steps:**

1. **Create `index.ts`**:
   ```typescript
   import { connectDB } from '@/shared/db/connect';
   import { ListenerService } from './listener.service';

   async function main() {
     console.log('[Listener] Initializing Event Listener Service...');

     try {
       await connectDB();
       console.log('[Listener] MongoDB connected.');

       const listener = new ListenerService();
       await listener.start();

       // Graceful shutdown
       process.on('SIGINT', async () => {
         console.log('\n[Listener] Received SIGINT, shutting down gracefully...');
         await listener.stop();
         process.exit(0);
       });

       process.on('SIGTERM', async () => {
         console.log('\n[Listener] Received SIGTERM, shutting down gracefully...');
         await listener.stop();
         process.exit(0);
       });
     } catch (error) {
       console.error('[Listener] Fatal error during initialization:', error);
       process.exit(1);
     }
   }

   main();
   ```

2. **Add npm script to `package.json`**:
   ```json
   {
     "scripts": {
       "dev": "tsx watch src/server.ts",
       "listener": "tsx src/features/listener/index.ts",
       "listener:watch": "tsx watch src/features/listener/index.ts",
       "build": "tsc",
       "start": "node dist/server.js",
       "test": "jest",
       "test:watch": "jest --watch"
     }
   }
   ```

**Testing:**
```bash
npm run listener:watch
```
- Verify startup logs, catch-up, and real-time subscription.

**Commit Message:**
```
feat(listener): add entry point and npm scripts

- Create index.ts with MongoDB connection and graceful shutdown
- Add 'listener' and 'listener:watch' npm scripts
- Handle SIGINT and SIGTERM for clean shutdown
```

---

### **Task 9: Integration Testing**

**Duration:** 2 hours

**Files to Create:**
- `backend/src/features/listener/listener.integration.test.ts`

**Implementation Steps:**

1. **Create integration test** using Hardhat local node or mock provider:
   ```typescript
   // Test scenarios:
   // 1. Full catch-up from deployment block
   // 2. Real-time event processing
   // 3. Listener restart and recovery
   // 4. Idempotency (replay same events)
   ```

**Testing:**
```bash
npm test -- listener.integration.test.ts
```

**Commit Message:**
```
test(listener): add integration tests for end-to-end scenarios

- Test full catch-up recovery from deployment block
- Test real-time event processing
- Test listener restart and replay
- Verify idempotency guarantees
```

---

### **Task 10: Update Transaction Model for 'redeem' Type**

**Duration:** 15 minutes

**Files to Modify:**
- `backend/src/shared/models/transaction.model.ts`

**Implementation Steps:**

1. **Update `type` enum**:
   ```typescript
   type: {
     type: String,
     enum: ['mint', 'transfer', 'resell', 'redeem'],
     required: true,
   },
   ```

**Testing:**
- TypeScript compilation should succeed.
- Run existing Transaction model tests.

**Commit Message:**
```
feat(models): add 'redeem' type to Transaction model

- Extend Transaction.type enum to include 'redeem' for TicketUsed events
- Update TypeScript interface ITransaction
```

---

### **Task 11: Documentation & Operational Runbook**

**Duration:** 1 hour

**Files to Create:**
- `backend/README-LISTENER.md`

**Implementation Steps:**

1. **Create operational documentation**:
   - How to start/stop listener.
   - How to check sync status (`db.syncstates.findOne()`).
   - How to manually trigger catch-up (restart with lower `CONTRACT_DEPLOYMENT_BLOCK`).
   - Troubleshooting common errors (RPC connection, MongoDB failures).

**Commit Message:**
```
docs(listener): add operational runbook for event listener service

- Document startup, shutdown, and monitoring procedures
- Add troubleshooting guide for common errors
- Include example queries for checking sync status
```

---

## 4. Testing Checklist

Before marking TASK-BE-09 complete:

- [ ] All unit tests pass (`npm test`).
- [ ] Integration tests pass (catch-up, real-time, restart).
- [ ] Manual test: Start listener, mint ticket on-chain, verify appears in MongoDB within 5 seconds.
- [ ] Manual test: Stop listener, mint ticket, restart listener, verify catch-up works.
- [ ] Verify `SyncState.lastProcessedBlock` updates correctly.
- [ ] Verify `Transaction` records created for all event types.
- [ ] Verify idempotency (replay same events, no duplicates).
- [ ] Code review: check error handling, logging, and TypeScript types.

---

## 5. Git Workflow

```bash
# Create feature branch
git checkout -b feature/be-09-event-listener

# Commit after each task (use commit messages from plan)
git add .
git commit -m "feat(config): add event listener environment variables"

# Push to remote
git push origin feature/be-09-event-listener

# Create pull request
# Title: "feat: TASK-BE-09 Blockchain Event Listener & Recovery Engine"
# Description: Link to design spec, list all implemented features
```

---

## 6. Deployment Notes

**Development:**
```bash
# Terminal 1: Express API
npm run dev

# Terminal 2: Event Listener
npm run listener:watch
```

**Production (Docker Compose — Future TASK-DO-01):**
```yaml
services:
  api:
    command: npm start
  listener:
    command: npm run listener
    restart: always
```

---

## 7. Success Criteria

TASK-BE-09 is complete when:

1. ✅ Listener service starts and connects to MongoDB and RPC provider.
2. ✅ Startup catch-up replays all historical events from last checkpoint.
3. ✅ Real-time subscription processes events within 5 seconds.
4. ✅ `SyncState` checkpoint updates correctly every batch/interval.
5. ✅ All 3 event handlers (Minted, Transferred, Used) work correctly.
6. ✅ Idempotency guarantees prevent duplicate records.
7. ✅ Graceful shutdown (SIGINT/SIGTERM) cleans up listeners.
8. ✅ Unit and integration tests achieve >90% coverage.
9. ✅ Documentation (README-LISTENER.md) is complete.
10. ✅ Code review approved and merged to `master`.

---

**Status:** Ready for Execution  
**Estimated Total Duration:** 8-12 hours  
**Next Task After Completion:** TASK-BE-10 (Rate Limiting & Security Hardening)
