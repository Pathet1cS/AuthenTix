# Design Specification: TASK-BE-08 Dynamic QR & Verification Engine

- **Document Version:** 1.0.0
- **Date:** 2026-09-28
- **Status:** Approved / Ready for Implementation
- **Target Component:** `backend/src/features/tickets/`, `backend/src/features/auth/`, `backend/src/shared/models/`, `backend/src/shared/services/`
- **Related Requirements:** PRD FR-07 (Dynamic QR Generation), FR-08 (Ticket Verification), Section 9 (`POST /api/tickets/verify`), Section 12 Security Requirements SR-04/SR-05/SR-06, Section 8 (`markUsed`).

---

## 1. Executive Summary

This specification defines `POST /api/tickets/verify`, the gate-scanning endpoint organizers use to redeem a ticket. The buyer's wallet signs a short-lived QR payload; the organizer's device scans it and forwards it to the backend, authenticated as an organizer/admin. The backend verifies the buyer's signature, the QR's freshness, single-use nonce, on-chain ownership, and un-redeemed status, then atomically marks the ticket used both in MongoDB and on-chain via the relayer's `markUsed(tokenId)` call.

It also closes a documented gap from TASK-BE-03: `auth.service.ts`'s `login()` validates payload expiry/domain/statement/signature but never persists the SIWE `nonce`, so a captured login payload is replayable until it expires (up to 5 minutes). This task introduces a shared, scope-tagged nonce store and wires it into both flows.

---

## 2. System Architecture & Component Interactions

```
 +---------------------------------------------------------------------------------+
 |                    Organizer Scanner (Next.js, authenticated)                   |
 +--------------------------------------+--------------------------------------+
                                        |
                                        | POST /api/tickets/verify
                                        | Authorization: Bearer <organizer JWT>
                                        | Body: { tokenId, walletAddress, nonce, expiresAt, signature }
                                        v
 +-----------------------------------------------------------------------------------+
 |                          Express Backend — tickets.controller.ts                  |
 |  authenticateJWT -> authorizeRole('organizer','admin') -> verifyTicketController  |
 +--------------------------------------+--------------------------------------------+
                                        v
 +-----------------------------------------------------------------------------------+
 |                      tickets.service.ts :: verifyTicketService                    |
 |  1. Timestamp window check (cheap, local)                                         |
 |  2. consumeNonce({ scope: 'qr-verify', ... })  --------> nonce.service.ts          |
 |  3. verifyWalletSignature(payload, signature)  -------> shared/utils/signature.ts |
 |  4. Ticket.findOne + isUsed guard (Mongo)                                         |
 |  5. Optimistic lock: findOneAndUpdate(isUsed:false -> true)                       |
 |  6. blockchainService.ownerOfOnChain(tokenId)  -------> Optimism Sepolia RPC      |
 |  7. withRetry(markUsedOnChain(tokenId))        -------> relayer wallet tx         |
 |     on exhausted failure: roll back step 5, Transaction(status: FAILED)           |
 +-----------------------------------------------------------------------------------+
```

---

## 3. Nonce Store (shared, cross-feature)

### 3.1 Why a shared store

MEMORYBANK.md (TASK-BE-03 entry): *"Known gap: login replay within the 5-minute payload window is still open until TASK-BE-08 builds the nonce store required by SR-05/SR-06."* The store must therefore serve both:
- `auth.service.ts` login (`scope: 'login'`, ~5 minute window, existing payload already carries `nonce`)
- `tickets.service.ts` QR verify (`scope: 'qr-verify'`, 30 second window)

### 3.2 Model — `backend/src/shared/models/nonce.model.ts`

```typescript
export interface IUsedNonce extends Document {
  scope: 'login' | 'qr-verify';
  nonce: string;
  walletAddress: string;
  expiresAt: Date;
  createdAt: Date;
}
```

- Unique compound index `{ scope: 1, nonce: 1 }` — the atomicity primitive. A second insert with the same `(scope, nonce)` hits MongoDB's duplicate-key error (`code 11000`), which is how replay is detected.
- TTL index `{ expiresAt: 1 }` with `expireAfterSeconds: 0` — MongoDB reaps the document once its own `expiresAt` passes, so the collection self-cleans without a cron job. A nonce is only ever meaningful up to its payload's `expiresAt`; after that the payload itself is rejected by the timestamp check regardless of nonce state.

### 3.3 Service — `backend/src/shared/services/nonce.service.ts`

```typescript
export async function consumeNonce(params: {
  scope: 'login' | 'qr-verify';
  nonce: string;
  walletAddress: string;
  expiresAt: Date;
}): Promise<void>
```

Attempts `UsedNonce.create(...)`. On success, the nonce is now spent. On duplicate-key error, throws `createError('Nonce has already been used', 401)`. Any other error propagates.

`isDuplicateKeyError` is extracted from `auth.service.ts` into `backend/src/shared/utils/mongoErrors.ts` so both call sites share one type guard instead of two copies.

### 3.4 Ordering: nonce consumption before signature verification

Both flows consume the nonce **before** calling `verifyWalletSignature`. `verifyWalletSignature` may hit an RPC for ERC-6492/1271 smart-account signatures, and cheap checks should reject garbage before paying for that. This mirrors the domain/statement-before-signature ordering already used in `auth.service.ts` (see comment there). Consequence: a request with a replayed nonce is rejected on the nonce check alone, and a same-nonce retry after a *failed* signature check is also rejected — which is correct, since the client should mint a fresh nonce for every signing attempt, never resubmit one.

### 3.5 Auth integration (closes the TASK-BE-03 gap)

In `auth.service.ts`'s `login()`, insert `await consumeNonce({ scope: 'login', nonce: payload.nonce, walletAddress: payload.address.toLowerCase(), expiresAt: new Date(payload.expiresAt) })` immediately after the domain/statement checks and before `verifyWalletSignature`. No schema change to the login payload — it already carries `nonce`.

---

## 4. `POST /api/tickets/verify`

- **Authentication:** Bearer JWT, `authorizeRole('organizer', 'admin')`. The JWT authenticates *who is scanning* (gate staff); the signature inside the body authenticates *whose ticket this is* (the buyer). These are deliberately different principals — TODO.md's TASK-FE-08 ("Organizer Portal - Ticket Verification Scanner UI") confirms the caller is the organizer's scanner, not the buyer's own session.
- **Route:** `POST /api/tickets/verify`
- **Request Body** (matches PRD FR-07 / TODO.md TASK-FE-05 verbatim, `expiresAt` is Unix **seconds**, not an ISO string — unlike the login payload):
  ```json
  {
    "tokenId": "1",
    "walletAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "nonce": "abc123",
    "expiresAt": 1718910000,
    "signature": "0x..."
  }
  ```
- **Validation (`verifyTicketSchema`, `tickets.validation.ts`, `.strict()`):**
  - `tokenId`: non-empty string.
  - `walletAddress`: `^0x[a-fA-F0-9]{40}$`.
  - `nonce`: 1–128 chars (mirrors `loginPayloadSchema.nonce`).
  - `expiresAt`: positive integer (Unix seconds).
  - `signature`: `^0x([a-fA-F0-9]{2})+$`, max 10000 chars (mirrors `loginRequestSchema.signature`).

### 4.1 Signed message

A canonical serializer mirrors `serializeLoginPayload`'s fixed-key-order pattern:

```typescript
export function serializeQrPayload(payload: {
  tokenId: string; walletAddress: string; nonce: string; expiresAt: number;
}): string {
  return JSON.stringify({
    tokenId: payload.tokenId,
    walletAddress: payload.walletAddress,
    nonce: payload.nonce,
    expiresAt: payload.expiresAt,
  });
}
```

Lives in `tickets.validation.ts` next to the schema, matching where `auth.schema.ts` keeps `serializeLoginPayload` next to `loginPayloadSchema`.

### 4.2 Business logic (`verifyTicketService`, executed in this order)

Cheap/local checks first, then nonce (DB), then signature (possible RPC), then chain reads, then chain write — same cheap-to-expensive ordering principle as `login()`.

1. **Timestamp window (SR-04).** Let `nowMs = Date.now()`, `expMs = payload.expiresAt * 1000`.
   - `expMs <= nowMs` → `createError('QR code has expired', 401)`.
   - `expMs > nowMs + QR_VALIDITY_MS + CLOCK_SKEW_MS` (30_000 + 5_000) → `createError('Invalid QR code timestamp', 401)`.
   - The upper bound matters: without it, a validly-signed payload with a far-future `expiresAt` would stay "not yet expired" indefinitely, defeating the 30-second freshness requirement. The payload carries no `issuedAt`, so bounding how far ahead `expiresAt` may legally be *is* the freshness check.
2. **Nonce (SR-05/SR-06).** `consumeNonce({ scope: 'qr-verify', nonce: payload.nonce, walletAddress: payload.walletAddress.toLowerCase(), expiresAt: new Date(expMs) })`.
3. **Signature (FR-08 step 1).** `verifyWalletSignature({ address: payload.walletAddress, message: serializeQrPayload(payload), signature })`; `false` → `createError('Invalid signature', 401)`.
4. **Ticket lookup + used guard (FR-08 step 5, fast path).** `Ticket.findOne({ tokenId: payload.tokenId })`; missing → 404. `ticket.isUsed` → `createError('Ticket has already been used', 409)`.
5. **Optimistic lock.** `Ticket.findOneAndUpdate({ tokenId, isUsed: false }, { isUsed: true, usedAt: new Date() }, { new: true })`. Null result → someone else redeemed it between steps 4 and 5 → `createError('Ticket has already been used', 409)`. This claims the ticket in Mongo *before* spending gas, so two concurrent scans of the same ticket can't both reach the chain call.
6. **On-chain ownership (FR-08 step 4).** `blockchainService.ownerOfOnChain(payload.tokenId)`; compare (lowercased) to `payload.walletAddress`. Mismatch → roll back step 5 (`isUsed:false, usedAt:null`) and `createError('On-chain owner does not match ticket holder', 403)`. The contract, not MongoDB, is authoritative for current ownership (a resale the backend hasn't indexed yet must not be treated as invalid).
7. **On-chain redemption (FR-08 step 6).** `withRetry(() => blockchainService.markUsedOnChain(payload.tokenId), 3, 500)`.
   - Success → `Transaction.create({ txHash, type: 'redeem', tokenId, fromWallet: payload.walletAddress, toWallet: payload.walletAddress, price: 0, timestamp: new Date(), status: 'SUCCESS' })`, return `{ tokenId, isUsed: true, usedAt, txHash }`.
   - Exhausted retries → roll back step 5, `Transaction.create({ ..., status: 'FAILED' })`, `console.error('[ADMIN_ALERT_MARK_USED_FAILED]', ...)` (mirrors the existing `[ADMIN_ALERT_MINT_FAILED]` pattern in `purchaseTicketService`), `createError('Failed to record redemption on-chain after retries', 502)`.

### 4.3 Idempotent double-redeem on-chain

The contract's own `markUsed` guard (`require(!isTicketUsed[tokenId], "Ticket already used")`) is a real outcome a retry can hit: if attempt 1's transaction actually lands after a timeout that made the client think it failed, attempt 2 reverts with that exact string. `markUsedOnChain` detects this specific revert reason and returns success with no new `txHash` (idempotent) instead of throwing, so a transient-timeout retry doesn't spuriously fail a redemption that already happened on-chain.

### 4.4 Transaction model change

`ITransaction.type` enum gains `'redeem'` alongside the existing `'mint' | 'transfer' | 'resell'`.

---

## 5. Blockchain Service Extensions

`EVENT_TICKET_NFT_ABI` gains:
```typescript
'function markUsed(uint256 tokenId) external',
'event TicketUsed(uint256 indexed tokenId, uint256 indexed eventId)',
```
(`ownerOf` is already present.) The two-arg `TicketUsed` event matches the deployed `EventTicketNFT.sol` (`emit TicketUsed(tokenId, ticketEventId[tokenId]);`), not the PRD's simplified single-arg prose — the contract is the source of truth.

New methods on `BlockchainService`:

```typescript
async ownerOfOnChain(tokenId: string): Promise<string>
// this.contract.ownerOf(tokenId) — read call, no .wait(); lowercases the result.
// Failure (RPC error, nonexistent token) -> createError('Failed to query ticket owner on-chain', 502).

async markUsedOnChain(tokenId: string): Promise<{ txHash: string; blockNumber: number; alreadyUsed: boolean }>
// await this.contract.markUsed(tokenId); await tx.wait(1); receipt.status !== 1 -> createError('Transaction reverted on-chain', 500).
// Catches the "Ticket already used" revert specifically (see §4.3) and returns { txHash: '', blockNumber: 0, alreadyUsed: true } instead of throwing.
```

Both follow the existing constructor-injection test pattern (`new BlockchainService(mockContract)`).

---

## 6. Files Touched

| File | Change |
|---|---|
| `backend/src/shared/models/nonce.model.ts` | New — `UsedNonce` model |
| `backend/src/shared/models/index.ts` | Export `UsedNonce`, `IUsedNonce` |
| `backend/src/shared/services/nonce.service.ts` | New — `consumeNonce` |
| `backend/src/shared/utils/mongoErrors.ts` | New — `isDuplicateKeyError` (extracted from `auth.service.ts`) |
| `backend/src/shared/services/blockchain.service.ts` | Add `markUsed`/`TicketUsed` ABI entries, `ownerOfOnChain`, `markUsedOnChain` |
| `backend/src/shared/models/transaction.model.ts` | `type` enum gains `'redeem'` |
| `backend/src/features/tickets/tickets.validation.ts` | Add `verifyTicketSchema`, `serializeQrPayload` |
| `backend/src/features/tickets/tickets.service.ts` | Add `verifyTicketService` |
| `backend/src/features/tickets/tickets.controller.ts` | Add `verifyTicketController` |
| `backend/src/features/tickets/tickets.routes.ts` | Add `POST /verify` route (`authenticateJWT`, `authorizeRole('organizer','admin')`) |
| `backend/src/features/auth/auth.service.ts` | Wire `consumeNonce({ scope: 'login', ... })`; use extracted `isDuplicateKeyError` |

---

## 7. Security & Edge Cases

1. **Replay (SR-05/SR-06):** closed by the unique `(scope, nonce)` index for both QR verification and login.
2. **Stale-but-signed QR (SR-04):** closed by bounding `expiresAt` both below (not yet expired) and above (not signed too far in the future), since the payload has no `issuedAt`.
3. **Resale not yet indexed:** ownership is checked on-chain (`ownerOfOnChain`), not against MongoDB's `ownerWallet`, so a ticket resold moments ago still verifies correctly even if `fulfillResalePurchaseService` hasn't been called yet for that transfer.
4. **Concurrent double-scan:** the Mongo optimistic lock in step 5 runs before the on-chain call, so only one concurrent request per ticket reaches the relayer.
5. **Partial failure (Mongo used, chain not confirmed):** rolled back on exhausted on-chain retries so the ticket remains scannable; audited via a `FAILED` `Transaction` row and an admin-alert log line, mirroring the existing `PENDING_MINT` pattern's spirit without introducing a new `Transaction.status` value that nothing else in the codebase reads.
6. **Idempotent retry:** a `markUsed` retry that lands on-chain after the client already timed out is not misreported as a failure (§4.3).

---

## 8. Testing Strategy

1. **Unit — `nonce.service.test.ts`:** first `consumeNonce` call succeeds; second call with same `(scope, nonce)` throws 401; different `scope` with the same `nonce` string succeeds independently.
2. **Unit — `blockchain.service.test.ts` additions:** `ownerOfOnChain` returns lowercased address / propagates 502 on RPC failure; `markUsedOnChain` happy path, reverted-status path, and the `"Ticket already used"` idempotent path.
3. **Unit — `tickets.service.test.ts` additions (`verifyTicketService`):** expired timestamp, timestamp too far in the future, replayed nonce, invalid signature, ticket not found, already used (Mongo fast path), already used (optimistic-lock race), owner mismatch (with rollback assertion), successful redemption, exhausted-retry rollback + `FAILED` transaction.
4. **Integration — `tickets.verify.test.ts`:** supertest against the Express app with `mongodb-memory-server`; 401 without a JWT, 403 for a buyer-role JWT, 200 for an organizer JWT with a valid signed payload (mocked `blockchainService`), and the failure-status mappings above end-to-end through the route.
5. **Auth regression — `auth.service.test.ts` addition:** replaying the same login payload/signature twice now yields 401 on the second attempt.
