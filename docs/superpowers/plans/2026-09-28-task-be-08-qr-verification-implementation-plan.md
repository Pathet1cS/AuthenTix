# TASK-BE-08: Dynamic QR & Verification Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /api/tickets/verify` (signature + timestamp + nonce + on-chain ownership + on-chain redemption), backed by a new shared nonce store, and close the TASK-BE-03-documented login-replay gap by wiring the same nonce store into `auth.service.ts`.

**Architecture:** New shared `nonce.model.ts`/`nonce.service.ts`. Extend `BlockchainService` with `ownerOfOnChain`/`markUsedOnChain`. Extend `features/tickets/` with a new validation schema, service function, controller, and route following the exact conventions of `TASK-BE-07`. Extend `Transaction.type` with `'redeem'`.

**Tech Stack:** Node.js, Express 4, TypeScript 5, Mongoose 8, Ethers.js v6, Zod, Jest, Supertest, MongoDB Memory Server.

## Global Constraints

- Strict TDD: write the failing test, confirm it fails, implement, confirm it passes, commit.
- Cheap checks before RPC calls: timestamp window → nonce consumption → signature verification → on-chain reads → on-chain write.
- On-chain ownership (`ownerOf`) is authoritative over MongoDB's `ownerWallet` for the verify flow.
- Roll back the Mongo optimistic lock (`isUsed:false`) on any failure after it is set, so a ticket never gets stuck "used" without an on-chain redemption.
- All wallet addresses lowercased/trimmed before comparison or persistence.
- Full `npm test` must stay green after every task.

---

### Task 1: Shared Nonce Store (Model + Service)

**Files:**
- Create: `backend/src/shared/models/nonce.model.ts`
- Create: `backend/src/shared/models/nonce.model.test.ts`
- Modify: `backend/src/shared/models/index.ts`
- Create: `backend/src/shared/utils/mongoErrors.ts`
- Create: `backend/src/shared/services/nonce.service.ts`
- Create: `backend/src/shared/services/nonce.service.test.ts`

**Interfaces produced:**
- `UsedNonce` Mongoose model, `IUsedNonce` interface.
- `isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError`
- `consumeNonce(params: { scope: 'login' | 'qr-verify'; nonce: string; walletAddress: string; expiresAt: Date }): Promise<void>`

- [ ] **Step 1: Write failing model test**

`nonce.model.test.ts`: creating a `UsedNonce` sets fields; a second `create` with the same `scope`+`nonce` rejects with a duplicate-key error (`code === 11000`); same `nonce` under a different `scope` succeeds.

- [ ] **Step 2: Run test, confirm fail** — `npm test -- shared/models/nonce.model.test.ts` (module doesn't exist yet).

- [ ] **Step 3: Implement `nonce.model.ts`**

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export type NonceScope = 'login' | 'qr-verify';

export interface IUsedNonce extends Document {
  scope: NonceScope;
  nonce: string;
  walletAddress: string;
  expiresAt: Date;
  createdAt: Date;
}

const usedNonceSchema = new Schema<IUsedNonce>(
  {
    scope: { type: String, enum: ['login', 'qr-verify'], required: true },
    nonce: { type: String, required: true },
    walletAddress: { type: String, required: true, lowercase: true, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

usedNonceSchema.index({ scope: 1, nonce: 1 }, { unique: true });
usedNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UsedNonce = mongoose.model<IUsedNonce>('UsedNonce', usedNonceSchema);
```

Export `UsedNonce, IUsedNonce` from `models/index.ts`.

- [ ] **Step 4: Run test, confirm pass.**

- [ ] **Step 5: Write failing `mongoErrors.ts` + `nonce.service.ts` tests**

`nonce.service.test.ts` (against `mongodb-memory-server`, same pattern as other model/service tests): `consumeNonce` resolves on first call; second call with identical `{scope, nonce}` rejects with a `401` `AppError` whose message is `'Nonce has already been used'`; a different `walletAddress` with the same `{scope, nonce}` still rejects (the index is on `scope+nonce` only, not wallet — a nonce is single-use regardless of who claims it).

- [ ] **Step 6: Run test, confirm fail.**

- [ ] **Step 7: Implement**

`mongoErrors.ts`:
```typescript
export interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

export function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}
```

`nonce.service.ts`:
```typescript
import { UsedNonce } from '@/shared/models';
import { NonceScope } from '@/shared/models/nonce.model';
import { createError } from '@/shared/utils/appError';
import { isDuplicateKeyError } from '@/shared/utils/mongoErrors';

export async function consumeNonce(params: {
  scope: NonceScope;
  nonce: string;
  walletAddress: string;
  expiresAt: Date;
}): Promise<void> {
  try {
    await UsedNonce.create({
      scope: params.scope,
      nonce: params.nonce,
      walletAddress: params.walletAddress,
      expiresAt: params.expiresAt,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw createError('Nonce has already been used', 401);
    }
    throw err;
  }
}
```

- [ ] **Step 8: Run test, confirm pass.**

- [ ] **Step 9: Commit**

```bash
git add backend/src/shared/models/nonce.model.ts backend/src/shared/models/nonce.model.test.ts backend/src/shared/models/index.ts backend/src/shared/utils/mongoErrors.ts backend/src/shared/services/nonce.service.ts backend/src/shared/services/nonce.service.test.ts
git commit -m "feat(shared): add scope-tagged nonce store for replay protection"
```

---

### Task 2: Blockchain Service — `ownerOfOnChain` & `markUsedOnChain`

**Files:**
- Modify: `backend/src/shared/services/blockchain.service.ts`
- Modify: `backend/src/shared/services/blockchain.service.test.ts`

**Interfaces produced:**
- `ownerOfOnChain(tokenId: string): Promise<string>`
- `markUsedOnChain(tokenId: string): Promise<{ txHash: string; blockNumber: number; alreadyUsed: boolean }>`

- [ ] **Step 1: Write failing tests**

Add to `blockchain.service.test.ts` (extend the existing `mockContract` with `ownerOf: jest.fn()` and `markUsed: jest.fn()`):
- `ownerOfOnChain` returns the lowercased address on success; throws 502 when the mock rejects.
- `markUsedOnChain` happy path returns `{ txHash, blockNumber, alreadyUsed: false }` from a mocked `tx.wait(1)` receipt with `status: 1`.
- `markUsedOnChain` throws 500 when receipt `status !== 1`.
- `markUsedOnChain` returns `{ txHash: '', blockNumber: 0, alreadyUsed: true }` when `this.contract.markUsed` rejects with an error whose message contains `"Ticket already used"`.

- [ ] **Step 2: Run test, confirm fail** — `markUsedOnChain`/`ownerOfOnChain` are not functions yet.

- [ ] **Step 3: Implement**

ABI additions:
```typescript
'function markUsed(uint256 tokenId) external',
'event TicketUsed(uint256 indexed tokenId, uint256 indexed eventId)',
```

```typescript
async ownerOfOnChain(tokenId: string): Promise<string> {
  try {
    const owner: string = await this.contract.ownerOf(tokenId);
    return owner.toLowerCase();
  } catch {
    throw createError('Failed to query ticket owner on-chain', 502);
  }
}

async markUsedOnChain(
  tokenId: string,
): Promise<{ txHash: string; blockNumber: number; alreadyUsed: boolean }> {
  let tx;
  try {
    tx = await this.contract.markUsed(tokenId);
  } catch (error: any) {
    const reason = error?.reason ?? error?.shortMessage ?? error?.message ?? '';
    if (typeof reason === 'string' && reason.includes('Ticket already used')) {
      return { txHash: '', blockNumber: 0, alreadyUsed: true };
    }
    throw createError('Failed to submit redemption transaction', 500);
  }

  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw createError('Transaction reverted on-chain', 500);
  }

  return { txHash: tx.hash, blockNumber: receipt.blockNumber, alreadyUsed: false };
}
```

- [ ] **Step 4: Run test, confirm pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/services/blockchain.service.ts backend/src/shared/services/blockchain.service.test.ts
git commit -m "feat(blockchain): add ownerOf read and idempotent markUsed write methods"
```

---

### Task 3: Validation Schema & `verifyTicketService`

**Files:**
- Modify: `backend/src/features/tickets/tickets.validation.ts`
- Modify: `backend/src/features/tickets/tickets.service.ts`
- Modify: `backend/src/features/tickets/tickets.service.test.ts`
- Modify: `backend/src/shared/models/transaction.model.ts` (add `'redeem'` to `type` enum)

**Interfaces produced:**
- `verifyTicketSchema` (Zod), `serializeQrPayload(payload): string`
- `verifyTicketService(payload: VerifyTicketPayload): Promise<{ tokenId: string; isUsed: true; usedAt: Date; txHash: string }>`

- [ ] **Step 1: Write failing service tests**

In `tickets.service.test.ts`, mock `@/shared/utils/signature`'s `verifyWalletSignature` and `@/shared/services/blockchain.service`'s `blockchainService`/`withRetry` (same mocking pattern already used for the resale tests in this file). Cover:
1. `expMs <= now` → 401 "QR code has expired".
2. `expMs > now + 35_000` → 401 "Invalid QR code timestamp".
3. Nonce already consumed → 401 (mock `consumeNonce` to throw).
4. `verifyWalletSignature` returns `false` → 401 "Invalid signature".
5. Ticket not found → 404.
6. `ticket.isUsed === true` (fast path) → 409.
7. Optimistic lock returns null (race) → 409, and asserts no chain call was attempted.
8. `ownerOfOnChain` returns a different address → 403, and asserts the ticket was rolled back to `isUsed:false`.
9. `markUsedOnChain` (via `withRetry`) throws after retries exhausted → 502, ticket rolled back, a `Transaction` with `status: 'FAILED'` was created.
10. Happy path → returns `{ tokenId, isUsed: true, usedAt, txHash }`, and a `Transaction` with `type: 'redeem', status: 'SUCCESS'` was created.

- [ ] **Step 2: Run test, confirm fail.**

- [ ] **Step 3: Add `'redeem'` to `Transaction.type` enum** in `transaction.model.ts`.

- [ ] **Step 4: Implement `verifyTicketSchema` + `serializeQrPayload`** in `tickets.validation.ts`:

```typescript
export const verifyTicketSchema = z
  .object({
    tokenId: z.string().min(1, 'Token ID is required'),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a 0x-prefixed 20-byte hex string'),
    nonce: z.string().min(1, 'nonce is required').max(128, 'nonce must be at most 128 characters'),
    expiresAt: z.number().int().positive('expiresAt must be a positive unix timestamp'),
    signature: z
      .string()
      .regex(/^0x([a-fA-F0-9]{2})+$/, 'signature must be a 0x-prefixed even-length hex string')
      .max(10000),
  })
  .strict();

export type VerifyTicketPayload = z.infer<typeof verifyTicketSchema>;

export function serializeQrPayload(payload: VerifyTicketPayload): string {
  return JSON.stringify({
    tokenId: payload.tokenId,
    walletAddress: payload.walletAddress,
    nonce: payload.nonce,
    expiresAt: payload.expiresAt,
  });
}
```

- [ ] **Step 5: Implement `verifyTicketService`** in `tickets.service.ts`, following §4.2 of the design spec exactly (timestamp window → `consumeNonce` → `verifyWalletSignature` → ticket lookup/used-guard → optimistic lock → `ownerOfOnChain` w/ rollback → `withRetry(markUsedOnChain)` w/ rollback on exhaustion → `Transaction.create`).

- [ ] **Step 6: Run test, confirm pass.**

- [ ] **Step 7: Commit**

```bash
git add backend/src/features/tickets/tickets.validation.ts backend/src/features/tickets/tickets.service.ts backend/src/features/tickets/tickets.service.test.ts backend/src/shared/models/transaction.model.ts
git commit -m "feat(tickets): implement dynamic QR verification and redemption service logic"
```

---

### Task 4: Controller, Route & Integration Tests

**Files:**
- Modify: `backend/src/features/tickets/tickets.controller.ts`
- Modify: `backend/src/features/tickets/tickets.routes.ts`
- Create: `backend/src/features/tickets/tickets.verify.test.ts`

**Interfaces produced:**
- `verifyTicketController`
- `POST /api/tickets/verify` (`authenticateJWT`, `authorizeRole('organizer', 'admin')`)

- [ ] **Step 1: Write failing integration tests**

`tickets.verify.test.ts` (supertest + `mongodb-memory-server`, mocking `blockchainService` at the module boundary the way `tickets.resale.test.ts` does): 401 with no token, 403 with a buyer-role token, 400 on a malformed body, and 200 on a valid organizer-scanned payload (sign the payload with a real ethers `Wallet` in the test so `verifyWalletSignature` runs unmocked, or mock `verifyWalletSignature` directly — follow whichever pattern `auth` integration tests already use for a real signature fixture).

- [ ] **Step 2: Run test, confirm fail** — 404 route not found.

- [ ] **Step 3: Implement controller + route**

`tickets.controller.ts` — `verifyTicketController` follows the existing shape exactly: `verifyTicketSchema.safeParse(req.body)` → `createError` on failure → call `verifyTicketService` → `sendSuccess(res, result, 200)`.

`tickets.routes.ts`:
```typescript
// Dynamic QR verification (TASK-BE-08)
ticketsRouter.post('/verify', authenticateJWT, authorizeRole('organizer', 'admin'), verifyTicketController);
```

- [ ] **Step 4: Run test, confirm pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/src/features/tickets/tickets.controller.ts backend/src/features/tickets/tickets.routes.ts backend/src/features/tickets/tickets.verify.test.ts
git commit -m "feat(tickets): add POST /api/tickets/verify route with integration tests"
```

---

### Task 5: Close the Login Replay Gap (`auth.service.ts`)

**Files:**
- Modify: `backend/src/features/auth/auth.service.ts`
- Modify: `backend/src/features/auth/auth.service.test.ts`

- [ ] **Step 1: Write failing regression test**

In `auth.service.test.ts`: perform a successful `login()` with a given payload+signature, then call `login()` again with the *identical* payload+signature. Assert the second call rejects with a 401 whose message is `'Nonce has already been used'`.

- [ ] **Step 2: Run test, confirm fail** — currently the second login succeeds.

- [ ] **Step 3: Implement**

Replace the local `isDuplicateKeyError`/`MongoDuplicateKeyError` in `auth.service.ts` with the shared `@/shared/utils/mongoErrors` import. Insert, right after the `statement` check and before `verifyWalletSignature`:

```typescript
await consumeNonce({
  scope: 'login',
  nonce: payload.nonce,
  walletAddress: payload.address.toLowerCase(),
  expiresAt: new Date(payload.expiresAt),
});
```

- [ ] **Step 4: Run test, confirm pass.** Re-run the full `auth.service.test.ts` and `auth.*.test.ts` suites to confirm no existing login test relies on replaying a payload within one test file (none should, but verify).

- [ ] **Step 5: Commit**

```bash
git add backend/src/features/auth/auth.service.ts backend/src/features/auth/auth.service.test.ts
git commit -m "fix(auth): reject replayed login payloads via shared nonce store"
```

---

### Task 6: Full Regression, TODO & Memory Bank Updates

- [ ] **Step 1: Run complete test suite** — `npm test` in `backend/`. Expected: all suites pass, 0 failures.

- [ ] **Step 2: Update `TODO.md`** — mark `TASK-BE-08` `[x]`.

- [ ] **Step 3: Update `MEMORYBANK.md`** — document TASK-BE-08 completion, new test count, the nonce-store cross-feature reuse, and that the TASK-BE-03 login-replay gap is now closed. Update "Next Focus" to TASK-BE-09.

- [ ] **Step 4: Commit**

```bash
git add TODO.md MEMORYBANK.md
git commit -m "docs: complete TASK-BE-08 QR verification engine in TODO and MEMORYBANK"
```
