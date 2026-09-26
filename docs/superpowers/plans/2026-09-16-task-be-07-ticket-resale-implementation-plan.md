# TASK-BE-07: Ticket Resale API & Lifecycle Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the secondary ticket resale API, ownership transfer synchronization, and user ticket lifecycle endpoints (`GET /api/tickets/my`, `POST /api/tickets/resell`, `DELETE /api/tickets/resell/:tokenId`, `POST /api/tickets/resell/purchase`, `GET /api/tickets/resale`) backed by on-chain receipt verification on Optimism Sepolia.

**Architecture:** Extend `features/tickets/` with modular controllers, Zod validation, and business service logic. Synchronize MongoDB `Ticket` and `Transaction` models with `EventTicketNFT.sol` contract receipts parsed via ethers.js v6 in `BlockchainService`.

**Tech Stack:** Node.js, Express 4, TypeScript 5, Mongoose 8, Ethers.js v6, Zod, Jest, Supertest, MongoDB Memory Server.

## Global Constraints

- Strictly adhere to `EventTicketNFT.sol` contract interface (`ListingCreated`, `ListingCancelled`, `ListingSold`, `TicketTransferred`).
- Enforce anti-scalping: resale price must never exceed `event.maxResalePrice`.
- Enforce deadline: resale listing must not be created after `event.saleDeadline`.
- Enforce single entry: used tickets (`isUsed: true`) can never be listed.
- Prevent receipt hijacking: verify sender/buyer in on-chain transaction receipt against authenticated wallet.
- All wallet addresses must be lowercased and trimmed.
- Strict TDD: tests written and confirmed failing before implementation.

---

### Task 1: Model & Schema Update (`Ticket` Model)

**Files:**
- Modify: `backend/src/shared/models/ticket.model.ts`
- Test: `backend/src/shared/models/ticket.model.test.ts`

**Interfaces:**
- Consumes: `IEvent` from `backend/src/shared/models/event.model.ts`
- Produces: Updated `ITicket` interface and `Ticket` Mongoose model containing `isListed: boolean`, `resalePrice: number | null`, `listingTxHash: string`.

- [ ] **Step 1: Write the failing test**

Add assertions in `backend/src/shared/models/ticket.model.test.ts` testing default values for `isListed`, `resalePrice`, `listingTxHash` and explicit assignment.

```typescript
it('should set default values for resale listing fields', async () => {
  const ticket = await Ticket.create({
    tokenId: '99',
    eventId: testEventId,
    ownerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    tokenURI: 'ipfs://QmTest',
    mintTxHash: '0x123',
    blockNumber: 100,
  });

  expect(ticket.isListed).toBe(false);
  expect(ticket.resalePrice).toBeNull();
  expect(ticket.listingTxHash).toBe('');
});

it('should allow setting resale listing fields', async () => {
  const ticket = await Ticket.create({
    tokenId: '100',
    eventId: testEventId,
    ownerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    tokenURI: 'ipfs://QmTest',
    mintTxHash: '0x123',
    blockNumber: 100,
    isListed: true,
    resalePrice: 0.06,
    listingTxHash: '0xabc',
  });

  expect(ticket.isListed).toBe(true);
  expect(ticket.resalePrice).toBe(0.06);
  expect(ticket.listingTxHash).toBe('0xabc');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shared/models/ticket.model.test.ts`
Expected: FAIL with missing properties or undefined values.

- [ ] **Step 3: Update `Ticket` model implementation**

Update `backend/src/shared/models/ticket.model.ts`:
```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITicket extends Document {
  tokenId: string;
  eventId: Types.ObjectId;
  ownerWallet: string;
  tokenURI: string;
  mintTxHash: string;
  lastTransferTxHash: string;
  blockNumber: number;
  isUsed: boolean;
  usedAt: Date | null;
  isListed: boolean;
  resalePrice: number | null;
  listingTxHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    ownerWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    tokenURI: {
      type: String,
      required: true,
    },
    mintTxHash: {
      type: String,
      required: true,
    },
    lastTransferTxHash: {
      type: String,
      default: '',
    },
    blockNumber: {
      type: Number,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    isListed: {
      type: Boolean,
      default: false,
    },
    resalePrice: {
      type: Number,
      default: null,
    },
    listingTxHash: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

ticketSchema.index({ eventId: 1, ownerWallet: 1 });
ticketSchema.index({ isListed: 1, eventId: 1 });
ticketSchema.index({ ownerWallet: 1, isListed: 1, isUsed: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- shared/models/ticket.model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/models/ticket.model.ts backend/src/shared/models/ticket.model.test.ts
git commit -m "feat(models): add resale listing fields and indexes to Ticket schema"
```

---

### Task 2: Blockchain Service Extensions (`BlockchainService`)

**Files:**
- Modify: `backend/src/shared/services/blockchain.service.ts`
- Modify: `backend/src/shared/services/blockchain.service.test.ts`

**Interfaces:**
- Consumes: `EVENT_TICKET_NFT_ABI`, `ethers.Contract`, `env`
- Produces:
  - `verifyListingCreatedOnChain(params: { txHash: string; tokenId: string; sellerWallet: string; expectedPriceWei: bigint }): Promise<{ blockNumber: number }>`
  - `verifyListingCancelledOnChain(params: { txHash: string; tokenId: string; sellerWallet: string }): Promise<{ blockNumber: number }>`
  - `verifyListingSoldOnChain(params: { txHash: string; tokenId: string; buyerWallet: string }): Promise<{ sellerWallet: string; priceWei: bigint; blockNumber: number }>`

- [ ] **Step 1: Write failing tests for blockchain verification methods**

In `backend/src/shared/services/blockchain.service.test.ts`, add test cases for `verifyListingCreatedOnChain`, `verifyListingCancelledOnChain`, and `verifyListingSoldOnChain` testing successful parsing, receipt revert check (`status !== 1`), missing logs, and mismatched wallet addresses.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shared/services/blockchain.service.test.ts`
Expected: FAIL with `blockchainService.verifyListingCreatedOnChain is not a function`.

- [ ] **Step 3: Implement blockchain service methods**

Update `backend/src/shared/services/blockchain.service.ts`:
1. Add ABI entries for `ListingCreated`, `ListingCancelled`, `ListingSold`, `TicketTransferred`, `ownerOf`, and `resaleListings`.
2. Implement:
```typescript
async verifyListingCreatedOnChain(params: {
  txHash: string;
  tokenId: string;
  sellerWallet: string;
  expectedPriceWei: bigint;
}): Promise<{ blockNumber: number }> {
  const provider = this.contract.runner?.provider as ethers.Provider;
  if (!provider) throw createError('RPC Provider not configured', 500);

  const receipt = await provider.getTransactionReceipt(params.txHash);
  if (!receipt || receipt.status !== 1) {
    throw createError('Transaction failed or was not mined on-chain', 502);
  }

  let found = false;
  for (const log of receipt.logs) {
    try {
      const parsed = this.contract.interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (parsed && parsed.name === 'ListingCreated') {
        const tokenIdStr = parsed.args.tokenId.toString();
        const seller = (parsed.args.seller as string).toLowerCase();
        const price = BigInt(parsed.args.price);

        if (tokenIdStr === params.tokenId && seller === params.sellerWallet.toLowerCase()) {
          if (price !== params.expectedPriceWei) {
            throw createError('On-chain listing price does not match specified price', 400);
          }
          found = true;
          break;
        }
      }
    } catch (err: any) {
      if (err.statusCode) throw err;
    }
  }

  if (!found) {
    throw createError('ListingCreated event not found or parameters do not match', 502);
  }

  return { blockNumber: receipt.blockNumber };
}
```
3. Implement `verifyListingCancelledOnChain` checking `ListingCancelled` log.
4. Implement `verifyListingSoldOnChain` checking `ListingSold` and `TicketTransferred` logs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- shared/services/blockchain.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/services/blockchain.service.ts backend/src/shared/services/blockchain.service.test.ts
git commit -m "feat(blockchain): implement resale receipt verification methods"
```

---

### Task 3: Validation Schemas & Business Service Logic

**Files:**
- Create: `backend/src/features/tickets/tickets.validation.ts`
- Modify: `backend/src/features/tickets/tickets.service.ts`
- Modify: `backend/src/features/tickets/tickets.service.test.ts`

**Interfaces:**
- Consumes: `Ticket`, `Event`, `Transaction`, `blockchainService`, `createError`
- Produces:
  - `getMyTicketsService(walletAddress: string, query: { status?: string; page?: number; limit?: number })`
  - `createResaleListingService(sellerWallet: string, data: { tokenId: string; price: number; txHash: string })`
  - `cancelResaleListingService(sellerWallet: string, tokenId: string, txHash: string)`
  - `fulfillResalePurchaseService(buyerWallet: string, data: { tokenId: string; txHash: string })`
  - `getResaleMarketplaceService(query: { eventId?: string; sortBy?: string; page?: number; limit?: number })`

- [ ] **Step 1: Write failing service tests**

In `backend/src/features/tickets/tickets.service.test.ts`:
- Test `getMyTicketsService` returns tickets owned by wallet and handles `status` filters (`active`, `resale`, `used`).
- Test `createResaleListingService` fails if ticket not owned, already listed, already used, or price exceeds cap. Succeeds and updates DB on valid receipt.
- Test `cancelResaleListingService` fails if not listed or wrong owner. Succeeds on valid receipt.
- Test `fulfillResalePurchaseService` fails if not listed. Succeeds on valid receipt, transferring `ownerWallet` and logging `Transaction`.
- Test `getResaleMarketplaceService` filters by `eventId` and sorts by `price_asc`, `price_desc`, `newest`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- features/tickets/tickets.service.test.ts`
Expected: FAIL with missing functions.

- [ ] **Step 3: Create validation schemas in `tickets.validation.ts`**

Create `backend/src/features/tickets/tickets.validation.ts` with Zod schemas:
- `createResaleListingSchema`: `z.object({ tokenId: z.string().min(1), price: z.number().positive(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) })`
- `cancelResaleListingSchema`: `z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) })`
- `fulfillResalePurchaseSchema`: `z.object({ tokenId: z.string().min(1), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) })`
- `myTicketsQuerySchema`: `z.object({ status: z.enum(['all', 'active', 'resale', 'used']).optional().default('all'), page: z.coerce.number().int().min(1).optional().default(1), limit: z.coerce.number().int().min(1).max(50).optional().default(10) })`
- `resaleMarketplaceQuerySchema`: `z.object({ eventId: z.string().optional(), sortBy: z.enum(['price_asc', 'price_desc', 'newest']).optional().default('newest'), page: z.coerce.number().int().min(1).optional().default(1), limit: z.coerce.number().int().min(1).max(50).optional().default(20) })`

- [ ] **Step 4: Implement ticket service methods**

Add the 5 service functions in `backend/src/features/tickets/tickets.service.ts`.
Enforce atomic MongoDB updates (`findOneAndUpdate`), price conversion (`ethers.parseEther`), and `Transaction` logging with `type: 'resell'`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- features/tickets/tickets.service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/features/tickets/tickets.validation.ts backend/src/features/tickets/tickets.service.ts backend/src/features/tickets/tickets.service.test.ts
git commit -m "feat(tickets): implement resale and ticket lifecycle service logic and schemas"
```

---

### Task 4: Controller, Routing & Integration Test Suite

**Files:**
- Modify: `backend/src/features/tickets/tickets.controller.ts`
- Modify: `backend/src/features/tickets/tickets.routes.ts`
- Create: `backend/src/features/tickets/tickets.resale.test.ts`

**Interfaces:**
- Consumes: `authenticateJWT`, `validateRequest` (or inline Zod parsing), `sendSuccess`, `sendError`
- Produces:
  - `GET /api/tickets/my`
  - `POST /api/tickets/resell`
  - `DELETE /api/tickets/resell/:tokenId`
  - `POST /api/tickets/resell/purchase`
  - `GET /api/tickets/resale`

- [ ] **Step 1: Write integration tests in `tickets.resale.test.ts`**

Write supertest tests against Express app covering:
1. `GET /api/tickets/my` (401 unauth, 200 with populated event and status filters).
2. `POST /api/tickets/resell` (401 unauth, 400 validation, 403 not owner, 400 price cap, 400 used, 409 listed, 200 success).
3. `DELETE /api/tickets/resell/:tokenId` (401 unauth, 403 not owner, 400 not listed, 200 success).
4. `POST /api/tickets/resell/purchase` (401 unauth, 400 not listed, 200 success with ownership change).
5. `GET /api/tickets/resale` (200 public access, event filter, price sorting).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- features/tickets/tickets.resale.test.ts`
Expected: FAIL with 404 Route Not Found.

- [ ] **Step 3: Implement controller and routes**

1. Update `backend/src/features/tickets/tickets.controller.ts`:
   - `getMyTicketsHandler`
   - `createResaleListingHandler`
   - `cancelResaleListingHandler`
   - `fulfillResalePurchaseHandler`
   - `getResaleMarketplaceHandler`
2. Update `backend/src/features/tickets/tickets.routes.ts`:
```typescript
import { Router } from 'express';
import { authenticateJWT } from '@/features/auth/auth.middleware';
import {
  purchaseTicketHandler,
  getMyTicketsHandler,
  createResaleListingHandler,
  cancelResaleListingHandler,
  fulfillResalePurchaseHandler,
  getResaleMarketplaceHandler,
} from './tickets.controller';

const router = Router();

// Primary purchase
router.post('/purchase', authenticateJWT, purchaseTicketHandler);

// User ticket management
router.get('/my', authenticateJWT, getMyTicketsHandler);

// Resale marketplace
router.get('/resale', getResaleMarketplaceHandler);
router.post('/resell', authenticateJWT, createResaleListingHandler);
router.delete('/resell/:tokenId', authenticateJWT, cancelResaleListingHandler);
router.post('/resell/purchase', authenticateJWT, fulfillResalePurchaseHandler);

export default router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- features/tickets/tickets.resale.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/features/tickets/tickets.controller.ts backend/src/features/tickets/tickets.routes.ts backend/src/features/tickets/tickets.resale.test.ts
git commit -m "feat(tickets): add resale and user ticket routes with integration tests"
```

---

### Task 5: Full Regression Testing, TODO & Memory Bank Updates

**Files:**
- Modify: `TODO.md`
- Modify: `MEMORYBANK.md`

- [ ] **Step 1: Run complete test suite**

Run: `npm test` across all backend test suites.
Expected: All tests pass (0 failures).

- [ ] **Step 2: Update `TODO.md` and `MEMORYBANK.md`**

Mark `TASK-BE-07: Ticket Resale API` as completed `[x]` and document passing test metrics and architecture notes.

- [ ] **Step 3: Commit**

```bash
git add TODO.md MEMORYBANK.md
git commit -m "docs: complete TASK-BE-07 ticket resale api in TODO and MEMORYBANK"
```
