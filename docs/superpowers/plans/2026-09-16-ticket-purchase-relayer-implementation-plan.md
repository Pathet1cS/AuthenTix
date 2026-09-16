# Ticket Purchase & Blockchain Relayer Service Implementation Plan (TASK-BE-06)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ticket purchase endpoint (`POST /api/tickets/purchase`) that decrements event quota, automates NFT ticket minting on Optimism Sepolia via the backend relayer, handles retries with exponential backoff, and records `PENDING_MINT` failure states with administrator alerts per PRD Section 13.

**Architecture:** A layered Express + TypeScript backend with Ethers.js v6 for smart contract interaction (`EventTicketNFT.sol`). Event registration on-chain occurs during event creation using a MongoDB atomic sequential `Counter`. The purchase service validates buyer authentication, locks quota, executes relayer minting with 3 retries, saves `Ticket` and `Transaction` records, and handles failure recovery.

**Tech Stack:** Express 4, TypeScript 5, Mongoose 8, Ethers.js v6, Zod 3, Jest 29, Supertest 7, MongoDB Memory Server.

## Global Constraints

- Runtime: Node.js 20+, TypeScript 5.4+, Express 4.19+
- Database: MongoDB 7+ via Mongoose 8 with `mongodb-memory-server` in unit/integration tests
- Blockchain: Optimism Sepolia Testnet (Chain ID 11155420) via Ethers.js v6
- Authentication: Thirdweb JWT with `authenticateJWT` middleware (`req.user.walletAddress`)
- Response envelope: `{ success: true, data: { tokenId, txHash }, message: "..." }`
- Contract methods: `createEvent(uint256,uint256,uint256,uint256)` and `mintTicket(address,uint256,string)`
- Failure rules (PRD Section 13): 3 retries on mint failure, persist as `PENDING_MINT`, alert admin via structured logging `[ADMIN_ALERT_MINT_FAILED]`

---

### Task 1: Counter Model, Event Model Update & Transaction Model Update

**Files:**
- Create: `backend/src/shared/models/counter.model.ts`
- Test: `backend/src/shared/models/counter.model.test.ts`
- Modify: `backend/src/shared/models/event.model.ts`
- Modify: `backend/src/shared/models/transaction.model.ts`
- Modify: `backend/src/shared/models/transaction.model.test.ts`

**Interfaces:**
- Produces:
  - `Counter`: Mongoose model for atomic sequence tracking
  - `getNextSequence(sequenceName: string): Promise<number>`
  - `IEvent` fields: `onChainEventId?: number`, `onChainTxHash?: string`
  - `ITransaction` fields: `status: 'SUCCESS' | 'PENDING_MINT' | 'FAILED'`

- [ ] **Step 1: Write failing test for Counter model and getNextSequence**

Create `backend/src/shared/models/counter.model.test.ts`:
```typescript
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Counter, getNextSequence } from './counter.model';

describe('Counter Model & getNextSequence', () => {
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
    await Counter.deleteMany({});
  });

  it('should start sequence at 1 when no counter exists', async () => {
    const seq = await getNextSequence('onChainEventId');
    expect(seq).toBe(1);
  });

  it('should atomically increment sequence on subsequent calls', async () => {
    const seq1 = await getNextSequence('onChainEventId');
    const seq2 = await getNextSequence('onChainEventId');
    const seq3 = await getNextSequence('onChainEventId');
    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    expect(seq3).toBe(3);
  });

  it('should track separate sequences independently', async () => {
    const eventSeq = await getNextSequence('onChainEventId');
    const ticketSeq = await getNextSequence('otherSeq');
    expect(eventSeq).toBe(1);
    expect(ticketSeq).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx jest src/shared/models/counter.model.test.ts
```
Expected: FAIL with module `./counter.model` not found.

- [ ] **Step 3: Implement Counter model and getNextSequence**

Create `backend/src/shared/models/counter.model.ts`:
```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { versionKey: false },
);

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);

export async function getNextSequence(sequenceName: string): Promise<number> {
  const result = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return result.seq;
}
```

- [ ] **Step 4: Update Event and Transaction models**

In `backend/src/shared/models/event.model.ts`, update `IEvent` interface and schema:
```typescript
export interface IEvent extends Document {
  organizerId: Types.ObjectId;
  name: string;
  description: string;
  eventDate: Date;
  ticketPrice: number;
  maxResalePrice: number;
  saleDeadline: Date;
  totalCapacity: number;
  remainingQuota: number;
  posterCID: string;
  metadataCID: string;
  onChainEventId?: number;
  onChainTxHash?: string;
  status: 'draft' | 'active' | 'soldout' | 'ended' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}
```
Add fields to `eventSchema`:
```typescript
    onChainEventId: {
      type: Number,
      sparse: true,
      index: true,
    },
    onChainTxHash: {
      type: String,
      default: '',
    },
```

In `backend/src/shared/models/transaction.model.ts`, update `ITransaction` and `transactionSchema`:
```typescript
export interface ITransaction extends Document {
  txHash: string;
  type: 'mint' | 'transfer' | 'resell';
  tokenId: string;
  fromWallet: string;
  toWallet: string;
  price: number;
  timestamp: Date;
  status: 'SUCCESS' | 'PENDING_MINT' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}
```
Add `status` to `transactionSchema`:
```typescript
    status: {
      type: String,
      enum: ['SUCCESS', 'PENDING_MINT', 'FAILED'],
      default: 'SUCCESS',
      required: true,
    },
```

In `backend/src/shared/models/transaction.model.test.ts`, update valid transaction mock to include status or verify default `SUCCESS`.

- [ ] **Step 5: Run tests to verify all model tests pass**

Run:
```bash
npx jest src/shared/models/counter.model.test.ts src/shared/models/transaction.model.test.ts src/shared/models/event.model.test.ts
```
Expected: PASS with all tests passing.

- [ ] **Step 6: Commit changes**

```bash
git add src/shared/models/counter.model.ts src/shared/models/counter.model.test.ts src/shared/models/event.model.ts src/shared/models/transaction.model.ts src/shared/models/transaction.model.test.ts
git commit -m "feat(models): add Counter model and update Event and Transaction models for on-chain state"
```

---

### Task 2: Blockchain Relayer Service

**Files:**
- Create: `backend/src/shared/services/blockchain.service.ts`
- Create: `backend/src/shared/services/blockchain.service.test.ts`

**Interfaces:**
- Consumes:
  - `env.RPC_URL`, `env.CONTRACT_ADDRESS`, `env.RELAYER_PRIVATE_KEY` from `@/config/env`
- Produces:
  - `registerEventOnChain(params: RegisterEventParams): Promise<{ txHash: string }>`
  - `mintTicketOnChain(params: MintTicketParams): Promise<{ tokenId: string, txHash: string, blockNumber: number }>`
  - `withRetry<T>(operation: () => Promise<T>, maxRetries?: number, delayMs?: number): Promise<T>`

- [ ] **Step 1: Write unit tests for BlockchainService and withRetry**

Create `backend/src/shared/services/blockchain.service.test.ts`:
```typescript
import { withRetry, BlockchainService } from './blockchain.service';
import { ethers } from 'ethers';

describe('Blockchain Service & withRetry', () => {
  describe('withRetry', () => {
    it('should resolve immediately if operation succeeds on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(mockFn, 3, 10);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry up to maxRetries times on failure and succeed if later attempt passes', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('RPC timeout'))
        .mockRejectedValueOnce(new Error('Nonce too low'))
        .mockResolvedValue('recovered');

      const result = await withRetry(mockFn, 3, 10);
      expect(result).toBe('recovered');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw last error when all retries are exhausted', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent RPC error'));
      await expect(withRetry(mockFn, 3, 10)).rejects.toThrow('Persistent RPC error');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('BlockchainService contract calls', () => {
    let mockContract: any;
    let service: BlockchainService;

    beforeEach(() => {
      mockContract = {
        createEvent: jest.fn(),
        mintTicket: jest.fn(),
        interface: {
          parseLog: jest.fn(),
        },
      };

      service = new BlockchainService(mockContract);
    });

    it('should call contract.createEvent and return txHash', async () => {
      mockContract.createEvent.mockResolvedValue({
        hash: '0xcreateEventTxHash',
        wait: jest.fn().mockResolvedValue({ status: 1 }),
      });

      const res = await service.registerEventOnChain({
        onChainEventId: 1,
        maxResalePrice: ethers.parseEther('0.05'),
        saleDeadline: Math.floor(Date.now() / 1000) + 3600,
        totalCapacity: 100,
      });

      expect(res.txHash).toBe('0xcreateEventTxHash');
      expect(mockContract.createEvent).toHaveBeenCalledWith(
        1,
        ethers.parseEther('0.05'),
        expect.any(Number),
        100,
      );
    });

    it('should call contract.mintTicket, parse TicketMinted event and return tokenId and txHash', async () => {
      const mockReceipt = {
        status: 1,
        hash: '0xmintTxHash',
        blockNumber: 123456,
        logs: [
          {
            topics: ['0xtopic'],
            data: '0xdata',
          },
        ],
      };

      mockContract.mintTicket.mockResolvedValue({
        hash: '0xmintTxHash',
        wait: jest.fn().mockResolvedValue(mockReceipt),
      });

      mockContract.interface.parseLog.mockReturnValue({
        name: 'TicketMinted',
        args: {
          tokenId: 42n,
          eventId: 1n,
          owner: '0x1234567890123456789012345678901234567890',
          tokenURI: 'ipfs://QmMetadata',
        },
      });

      const res = await service.mintTicketOnChain({
        buyerWallet: '0x1234567890123456789012345678901234567890',
        onChainEventId: 1,
        metadataURI: 'ipfs://QmMetadata',
      });

      expect(res.tokenId).toBe('42');
      expect(res.txHash).toBe('0xmintTxHash');
      expect(res.blockNumber).toBe(123456);
      expect(mockContract.mintTicket).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        1,
        'ipfs://QmMetadata',
      );
    });

    it('should throw if transaction reverts', async () => {
      mockContract.mintTicket.mockResolvedValue({
        hash: '0xfailedTx',
        wait: jest.fn().mockResolvedValue({ status: 0 }),
      });

      await expect(
        service.mintTicketOnChain({
          buyerWallet: '0x1234567890123456789012345678901234567890',
          onChainEventId: 1,
          metadataURI: 'ipfs://QmMetadata',
        }),
      ).rejects.toThrow('Transaction reverted on-chain');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx jest src/shared/services/blockchain.service.test.ts
```
Expected: FAIL with module `./blockchain.service` not found.

- [ ] **Step 3: Implement BlockchainService and withRetry**

Create `backend/src/shared/services/blockchain.service.ts`:
```typescript
import { ethers } from 'ethers';
import { env } from '@/config/env';
import { createError } from '@/shared/utils/appError';

export const EVENT_TICKET_NFT_ABI = [
  'function createEvent(uint256 eventId, uint256 maxResalePrice, uint256 saleDeadline, uint256 totalSupply) external',
  'function mintTicket(address buyer, uint256 eventId, string calldata metadataURI) external returns (uint256)',
  'event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner, string tokenURI)',
];

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500,
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

export interface RegisterEventParams {
  onChainEventId: number;
  maxResalePrice: bigint;
  saleDeadline: number;
  totalCapacity: number;
}

export interface MintTicketParams {
  buyerWallet: string;
  onChainEventId: number;
  metadataURI: string;
}

export class BlockchainService {
  private contract: ethers.Contract;

  constructor(customContract?: ethers.Contract) {
    if (customContract) {
      this.contract = customContract;
    } else {
      const provider = new ethers.JsonRpcProvider(env.RPC_URL);
      const wallet = new ethers.Wallet(env.RELAYER_PRIVATE_KEY, provider);
      this.contract = new ethers.Contract(env.CONTRACT_ADDRESS, EVENT_TICKET_NFT_ABI, wallet);
    }
  }

  async registerEventOnChain(params: RegisterEventParams): Promise<{ txHash: string }> {
    const tx = await this.contract.createEvent(
      params.onChainEventId,
      params.maxResalePrice,
      params.saleDeadline,
      params.totalCapacity,
    );

    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw createError('Failed to register event on-chain: transaction reverted', 500);
    }

    return { txHash: tx.hash };
  }

  async mintTicketOnChain(
    params: MintTicketParams,
  ): Promise<{ tokenId: string; txHash: string; blockNumber: number }> {
    const tx = await this.contract.mintTicket(
      params.buyerWallet,
      params.onChainEventId,
      params.metadataURI,
    );

    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw createError('Transaction reverted on-chain', 500);
    }

    let tokenId: string | null = null;
    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (parsed && parsed.name === 'TicketMinted') {
            tokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // Log not from this contract event interface, continue
        }
      }
    }

    if (!tokenId) {
      throw createError('TicketMinted event not found in transaction logs', 500);
    }

    return {
      tokenId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }
}

export const blockchainService = new BlockchainService();
```

- [ ] **Step 4: Run tests to verify BlockchainService tests pass**

Run:
```bash
npx jest src/shared/services/blockchain.service.test.ts
```
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit changes**

```bash
git add src/shared/services/blockchain.service.ts src/shared/services/blockchain.service.test.ts
git commit -m "feat(blockchain): implement BlockchainService with Ethers v6 and retry mechanism"
```

---

### Task 3: On-Chain Event Registration in Event Creation API

**Files:**
- Modify: `backend/src/features/events/events.service.ts`
- Modify: `backend/src/features/events/events.service.test.ts`
- Modify: `backend/src/features/events/events.controller.test.ts`

**Interfaces:**
- Consumes:
  - `getNextSequence` from `@/shared/models/counter.model`
  - `blockchainService.registerEventOnChain` from `@/shared/services/blockchain.service`
- Produces:
  - `createEventService` populates `onChainEventId` and `onChainTxHash` on newly created events

- [ ] **Step 1: Update events.service.ts to integrate on-chain registration**

In `backend/src/features/events/events.service.ts`:
```typescript
import { ethers } from 'ethers';
import { getNextSequence } from '@/shared/models/counter.model';
import { blockchainService, withRetry } from '@/shared/services/blockchain.service';
```
In `createEventService`:
```typescript
  const onChainEventId = await getNextSequence('onChainEventId');
  const maxResalePriceInWei = ethers.parseEther(params.maxResalePrice.toString());
  const saleDeadlineTimestamp = Math.floor(new Date(params.saleDeadline).getTime() / 1000);

  const { txHash: onChainTxHash } = await withRetry(() =>
    blockchainService.registerEventOnChain({
      onChainEventId,
      maxResalePrice: maxResalePriceInWei,
      saleDeadline: saleDeadlineTimestamp,
      totalCapacity: params.totalCapacity,
    }),
  );

  const newEvent = await Event.create({
    organizerId: new mongoose.Types.ObjectId(params.organizerId),
    name: params.name,
    description: params.description,
    eventDate: params.eventDate,
    ticketPrice: params.ticketPrice,
    maxResalePrice: params.maxResalePrice,
    saleDeadline: params.saleDeadline,
    totalCapacity: params.totalCapacity,
    remainingQuota: params.totalCapacity,
    posterCID,
    metadataCID,
    onChainEventId,
    onChainTxHash,
    status: 'active',
  });
```

- [ ] **Step 2: Update existing events tests with blockchain mock**

In `backend/src/features/events/events.service.test.ts` and `events.controller.test.ts`:
Add mock for `blockchainService`:
```typescript
jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    registerEventOnChain: jest.fn().mockResolvedValue({ txHash: '0xmockCreateEventTx' }),
    mintTicketOnChain: jest.fn().mockResolvedValue({ tokenId: '1', txHash: '0xmockMintTx', blockNumber: 1 }),
  },
  withRetry: jest.fn().mockImplementation((fn) => fn()),
}));
```

- [ ] **Step 3: Run event tests to verify compatibility**

Run:
```bash
npx jest src/features/events/events.service.test.ts src/features/events/events.controller.test.ts
```
Expected: PASS with all existing event tests passing and verifying `onChainEventId` is set.

- [ ] **Step 4: Commit changes**

```bash
git add src/features/events/events.service.ts src/features/events/events.service.test.ts src/features/events/events.controller.test.ts
git commit -m "feat(events): automatically register events on-chain with sequential onChainEventId"
```

---

### Task 4: Ticket Purchase Service & Failure Recovery

**Files:**
- Create: `backend/src/features/tickets/tickets.service.ts`
- Create: `backend/src/features/tickets/tickets.service.test.ts`

**Interfaces:**
- Consumes:
  - `Event`, `Ticket`, `Transaction` models
  - `blockchainService.mintTicketOnChain`, `withRetry`
- Produces:
  - `purchaseTicketService(buyerWallet: string, eventId: string): Promise<{ tokenId: string, txHash: string }>`

- [ ] **Step 1: Write unit tests for purchaseTicketService**

Create `backend/src/features/tickets/tickets.service.test.ts`:
```typescript
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { purchaseTicketService } from './tickets.service';
import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { blockchainService, withRetry } from '@/shared/services/blockchain.service';

jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    mintTicketOnChain: jest.fn(),
  },
  withRetry: jest.fn(),
}));

describe('Ticket Purchase Service', () => {
  let mongoServer: MongoMemoryServer;
  const buyerWallet = '0x1111111111111111111111111111111111111111';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Event.init();
    await Ticket.init();
    await Transaction.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Event.deleteMany({});
    await Ticket.deleteMany({});
    await Transaction.deleteMany({});
    jest.clearAllMocks();
  });

  async function createTestEvent(overrides = {}) {
    return Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      name: 'Test Concert',
      description: 'A great concert',
      eventDate: new Date(Date.now() + 86400000),
      ticketPrice: 0.05,
      maxResalePrice: 0.1,
      saleDeadline: new Date(Date.now() + 3600000),
      totalCapacity: 10,
      remainingQuota: 10,
      posterCID: 'QmPoster123',
      metadataCID: 'ipfs://QmMetadata123',
      onChainEventId: 1,
      status: 'active',
      ...overrides,
    });
  }

  it('should successfully purchase a ticket, decrement quota, mint NFT and create Ticket and Transaction records', async () => {
    const event = await createTestEvent({ remainingQuota: 5 });

    (withRetry as jest.Mock).mockResolvedValue({
      tokenId: '101',
      txHash: '0xmintSuccessHash',
      blockNumber: 12345,
    });

    const result = await purchaseTicketService(buyerWallet, event._id.toString());

    expect(result.tokenId).toBe('101');
    expect(result.txHash).toBe('0xmintSuccessHash');

    // Verify quota decremented
    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent?.remainingQuota).toBe(4);

    // Verify Ticket created
    const ticket = await Ticket.findOne({ tokenId: '101' });
    expect(ticket).toBeTruthy();
    expect(ticket?.ownerWallet).toBe(buyerWallet.toLowerCase());
    expect(ticket?.tokenURI).toBe('ipfs://QmMetadata123');

    // Verify Transaction created
    const tx = await Transaction.findOne({ txHash: '0xmintSuccessHash' });
    expect(tx).toBeTruthy();
    expect(tx?.type).toBe('mint');
    expect(tx?.status).toBe('SUCCESS');
    expect(tx?.toWallet).toBe(buyerWallet.toLowerCase());
  });

  it('should update event status to soldout when remainingQuota reaches 0', async () => {
    const event = await createTestEvent({ remainingQuota: 1 });

    (withRetry as jest.Mock).mockResolvedValue({
      tokenId: '102',
      txHash: '0xlastTicketHash',
      blockNumber: 12346,
    });

    await purchaseTicketService(buyerWallet, event._id.toString());

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent?.remainingQuota).toBe(0);
    expect(updatedEvent?.status).toBe('soldout');
  });

  it('should reject purchase when event has remainingQuota = 0', async () => {
    const event = await createTestEvent({ remainingQuota: 0, status: 'soldout' });
    await expect(purchaseTicketService(buyerWallet, event._id.toString())).rejects.toThrow('Event is sold out');
  });

  it('should reject purchase when sale deadline has passed', async () => {
    const event = await createTestEvent({ saleDeadline: new Date(Date.now() - 1000) });
    await expect(purchaseTicketService(buyerWallet, event._id.toString())).rejects.toThrow('Ticket sale deadline has passed');
  });

  it('should handle failure recovery: record PENDING_MINT and log admin alert when mint fails all 3 times', async () => {
    const event = await createTestEvent({ remainingQuota: 2 });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    (withRetry as jest.Mock).mockRejectedValue(new Error('RPC Provider unavailable'));

    await expect(purchaseTicketService(buyerWallet, event._id.toString())).rejects.toThrow(
      'Minting failed after retries. Transaction queued as PENDING_MINT for recovery.',
    );

    // Verify admin alert logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ADMIN_ALERT_MINT_FAILED]'),
      expect.anything(),
    );

    // Verify PENDING_MINT transaction created
    const pendingTx = await Transaction.findOne({ status: 'PENDING_MINT' });
    expect(pendingTx).toBeTruthy();
    expect(pendingTx?.toWallet).toBe(buyerWallet.toLowerCase());

    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx jest src/features/tickets/tickets.service.test.ts
```
Expected: FAIL with module `./tickets.service` not found.

- [ ] **Step 3: Implement purchaseTicketService**

Create `backend/src/features/tickets/tickets.service.ts`:
```typescript
import mongoose from 'express';
import { Event } from '@/shared/models/event.model';
import { Ticket, ITicket } from '@/shared/models/ticket.model';
import { Transaction, ITransaction } from '@/shared/models/transaction.model';
import { blockchainService, withRetry } from '@/shared/services/blockchain.service';
import { createError } from '@/shared/utils/appError';
import { ethers } from 'ethers';

export interface PurchaseTicketResult {
  tokenId: string;
  txHash: string;
}

export async function purchaseTicketService(
  buyerWallet: string,
  eventId: string,
): Promise<PurchaseTicketResult> {
  const normalizedWallet = buyerWallet.trim().toLowerCase();

  const event = await Event.findById(eventId);
  if (!event) {
    throw createError('Event not found', 404);
  }

  if (event.status !== 'active') {
    throw createError('Event is not active for ticket purchase', 400);
  }

  if (new Date() > new Date(event.saleDeadline)) {
    throw createError('Ticket sale deadline has passed', 400);
  }

  if (event.remainingQuota <= 0) {
    throw createError('Event is sold out', 400);
  }

  if (event.onChainEventId === undefined || event.onChainEventId === null) {
    throw createError('Event is not yet registered on-chain', 500);
  }

  // Atomically decrement quota
  const updatedEvent = await Event.findOneAndUpdate(
    { _id: event._id, remainingQuota: { $gt: 0 } },
    { $inc: { remainingQuota: -1 } },
    { new: true },
  );

  if (!updatedEvent) {
    throw createError('Event is sold out', 400);
  }

  // If quota reaches 0, mark as soldout
  if (updatedEvent.remainingQuota === 0) {
    await Event.findByIdAndUpdate(event._id, { status: 'soldout' });
  }

  // Execute relayer mint with retry
  try {
    const mintResult = await withRetry(
      () =>
        blockchainService.mintTicketOnChain({
          buyerWallet: normalizedWallet,
          onChainEventId: event.onChainEventId!,
          metadataURI: event.metadataCID,
        }),
      3,
      500,
    );

    // Success persistence
    await Ticket.create({
      tokenId: mintResult.tokenId,
      eventId: event._id,
      ownerWallet: normalizedWallet,
      tokenURI: event.metadataCID,
      mintTxHash: mintResult.txHash,
      lastTransferTxHash: '',
      blockNumber: mintResult.blockNumber,
      isUsed: false,
      usedAt: null,
    });

    await Transaction.create({
      txHash: mintResult.txHash,
      type: 'mint',
      tokenId: mintResult.tokenId,
      fromWallet: ethers.ZeroAddress,
      toWallet: normalizedWallet,
      price: event.ticketPrice,
      timestamp: new Date(),
      status: 'SUCCESS',
    });

    return {
      tokenId: mintResult.tokenId,
      txHash: mintResult.txHash,
    };
  } catch (error: any) {
    // PRD Section 13 Failure Recovery
    const placeholderTxHash = `pending_mint_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;

    console.error('[ADMIN_ALERT_MINT_FAILED] Relayer failed to mint ticket after 3 retries:', {
      buyerWallet: normalizedWallet,
      eventId: event._id.toString(),
      onChainEventId: event.onChainEventId,
      error: error?.message || error,
      timestamp: new Date().toISOString(),
      placeholderTxHash,
    });

    await Transaction.create({
      txHash: placeholderTxHash,
      type: 'mint',
      tokenId: '0',
      fromWallet: ethers.ZeroAddress,
      toWallet: normalizedWallet,
      price: event.ticketPrice,
      timestamp: new Date(),
      status: 'PENDING_MINT',
    });

    throw createError(
      'Minting failed after retries. Transaction queued as PENDING_MINT for recovery.',
      500,
    );
  }
}
```

- [ ] **Step 4: Run test to verify tickets.service tests pass**

Run:
```bash
npx jest src/features/tickets/tickets.service.test.ts
```
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit changes**

```bash
git add src/features/tickets/tickets.service.ts src/features/tickets/tickets.service.test.ts
git commit -m "feat(tickets): implement purchaseTicketService with atomic quota decrement and PENDING_MINT failure recovery"
```

---

### Task 5: Tickets Controller, Router & Integration Test

**Files:**
- Create: `backend/src/features/tickets/tickets.controller.ts`
- Modify: `backend/src/features/tickets/tickets.routes.ts`
- Create: `backend/src/features/tickets/tickets.purchase.test.ts`

**Interfaces:**
- Consumes:
  - `authenticateJWT` middleware
  - `purchaseTicketService`
- Produces:
  - `POST /api/tickets/purchase` endpoint

- [ ] **Step 1: Write integration tests for POST /api/tickets/purchase**

Create `backend/src/features/tickets/tickets.purchase.test.ts`:
```typescript
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { app } from '@/app';
import { Event } from '@/shared/models/event.model';
import { env } from '@/config/env';
import { withRetry } from '@/shared/services/blockchain.service';

jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    mintTicketOnChain: jest.fn(),
  },
  withRetry: jest.fn(),
}));

describe('POST /api/tickets/purchase Integration', () => {
  let mongoServer: MongoMemoryServer;
  const buyerWallet = '0x2222222222222222222222222222222222222222';
  let buyerToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Event.init();

    buyerToken = jwt.sign(
      {
        userId: new mongoose.Types.ObjectId().toString(),
        walletAddress: buyerWallet,
        role: 'buyer',
      },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Event.deleteMany({});
    jest.clearAllMocks();
  });

  async function createEvent(remainingQuota = 5) {
    return Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      name: 'Festival 2026',
      description: 'Electric vibes',
      eventDate: new Date(Date.now() + 86400000),
      ticketPrice: 0.1,
      maxResalePrice: 0.2,
      saleDeadline: new Date(Date.now() + 3600000),
      totalCapacity: 10,
      remainingQuota,
      posterCID: 'QmPoster',
      metadataCID: 'ipfs://QmMeta',
      onChainEventId: 1,
      status: remainingQuota > 0 ? 'active' : 'soldout',
    });
  }

  it('should return 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/api/tickets/purchase').send({ eventId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid eventId format', async () => {
    const res = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ eventId: 'invalid-id' });

    expect(res.status).toBe(400);
  });

  it('should return 201 with tokenId and txHash upon successful purchase', async () => {
    const event = await createEvent(5);

    (withRetry as jest.Mock).mockResolvedValue({
      tokenId: '1',
      txHash: '0xintegrationTxHash',
      blockNumber: 1000,
    });

    const res = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ eventId: event._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokenId).toBe('1');
    expect(res.body.data.txHash).toBe('0xintegrationTxHash');
  });

  it('should return 400 if event is sold out', async () => {
    const event = await createEvent(0);

    const res = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ eventId: event._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('sold out');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx jest src/features/tickets/tickets.purchase.test.ts
```
Expected: FAIL with 404 Route not found.

- [ ] **Step 3: Implement controller and route**

Create `backend/src/features/tickets/tickets.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { purchaseTicketService } from './tickets.service';
import { sendSuccess } from '@/shared/utils/response';
import { createError } from '@/shared/utils/appError';

const purchaseSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
});

export async function purchaseTicketController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid request body', 400);
    }

    if (!req.user || !req.user.walletAddress) {
      throw createError('Authenticated buyer wallet required', 401);
    }

    const result = await purchaseTicketService(req.user.walletAddress, parsed.data.eventId);

    sendSuccess(res, result, 'Ticket purchased and NFT minted successfully', 201);
  } catch (error) {
    next(error);
  }
}
```

Modify `backend/src/features/tickets/tickets.routes.ts`:
```typescript
import { Router } from 'express';
import { purchaseTicketController } from './tickets.controller';
import { authenticateJWT } from '@/features/auth/auth.middleware';

export const ticketsRouter = Router();

ticketsRouter.post('/purchase', authenticateJWT, purchaseTicketController);
```

- [ ] **Step 4: Run integration tests to verify they pass**

Run:
```bash
npx jest src/features/tickets/tickets.purchase.test.ts
```
Expected: PASS with all integration tests passing.

- [ ] **Step 5: Commit changes**

```bash
git add src/features/tickets/tickets.controller.ts src/features/tickets/tickets.routes.ts src/features/tickets/tickets.purchase.test.ts
git commit -m "feat(tickets): add POST /api/tickets/purchase controller, route, and integration tests"
```

---

### Task 6: Full Test Suite Verification & Documentation Update

**Files:**
- Modify: `MEMORYBANK.md`
- Modify: `TODO.md`

- [ ] **Step 1: Run full backend test suite**

Run:
```bash
npm test
```
Expected: All test suites PASS with 0 failures.

- [ ] **Step 2: Update MEMORYBANK.md and TODO.md**

In `MEMORYBANK.md`:
- Mark TASK-BE-06 completed.
- Update next focus to TASK-BE-07 (Ticket Resale API) and TASK-BE-08 (Dynamic QR Verification).

In `TODO.md`:
- Mark `[x] **TASK-BE-06: Ticket Purchase & Blockchain Relayer Service**` as completed.

- [ ] **Step 3: Commit documentation updates**

```bash
git add MEMORYBANK.md TODO.md
git commit -m "docs: mark TASK-BE-06 ticket purchase & relayer service as completed in roadmap"
```
