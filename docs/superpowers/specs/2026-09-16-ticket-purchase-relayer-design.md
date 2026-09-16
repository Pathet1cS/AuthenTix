# Design Specification: Ticket Purchase & Blockchain Relayer Service (TASK-BE-06)

> **Platform:** AuthenTix (Web3 Decentralized E-Ticketing)  
> **Phase:** Phase 2 — Backend API & Event Listener (`backend/`)  
> **Target Contract:** `EventTicketNFT.sol` on Optimism Sepolia  
> **Status:** Approved Design  
> **Date:** 2026-09-16  

---

## 1. Executive Summary

TASK-BE-06 implements the core ticket purchasing and automated minting workflow for AuthenTix. When an authenticated buyer purchases a ticket via `POST /api/tickets/purchase`, the backend relayer automatically invokes the `EventTicketNFT.mintTicket` function on Optimism Sepolia, records the transaction in MongoDB, handles transient RPC retry attempts, and manages failure recovery (`PENDING_MINT` state and administrator alerting) in compliance with PRD Section 13.

Additionally, to ensure the smart contract's `require(events[eventId].exists, "Event does not exist")` check passes, event creation is updated so that events are registered on-chain via `createEvent` when created by organizers.

---

## 2. Architecture & Data Flow

```
[Buyer Client]
      │
      │ 1. POST /api/tickets/purchase { eventId } + Bearer JWT
      ▼
[Express ticketsRouter -> authenticateJWT]
      │
      ▼
[purchaseTicketService]
      │
      ├── 2. Validate event exists, status === 'active', deadline not passed, remainingQuota > 0
      │
      ├── 3. Atomic MongoDB Decrement:
      │      Event.findOneAndUpdate({ _id, remainingQuota: { $gt: 0 } }, { $inc: { remainingQuota: -1 } })
      │
      ├── 4. Relayer Mint Call (BlockchainService):
      │      contract.mintTicket(buyerWallet, event.onChainEventId, event.metadataCID)
      │      - Wrapped in retry logic (up to 3 attempts with exponential backoff)
      │      - Awaits 1 confirmation and parses `TicketMinted` event for `tokenId`
      │
      ├── 5a. On Mint Success:
      │       - Insert Ticket document (tokenId, ownerWallet, tokenURI, mintTxHash, blockNumber)
      │       - Insert Transaction document (type: 'mint', status: 'SUCCESS', txHash)
      │       - Return HTTP 201 { success: true, data: { tokenId, txHash } }
      │
      └── 5b. On Failure after 3 Retries (PRD Section 13):
              - Log critical alert: [ADMIN_ALERT_MINT_FAILED]
              - Insert Transaction document (type: 'mint', status: 'PENDING_MINT')
              - Return HTTP 500 / 202 with detailed error response for administrative recovery
```

---

## 3. Data Models & Schemas

### 3.1 Counter Model (`backend/src/shared/models/counter.model.ts`)
Tracks atomic sequential numbers for on-chain integer IDs.
```typescript
export interface ICounter extends Document {
  _id: string; // Identifier key, e.g. 'onChainEventId'
  seq: number;
}
```
Helper function `getNextSequence(counterKey: string): Promise<number>` uses:
```typescript
await Counter.findByIdAndUpdate(
  counterKey,
  { $inc: { seq: 1 } },
  { new: true, upsert: true }
);
```

### 3.2 Event Model Updates (`backend/src/shared/models/event.model.ts`)
Add on-chain registration tracking fields:
* `onChainEventId`: `Number` (optional, unique sparse index)
* `onChainTxHash`: `String` (optional)

### 3.3 Transaction Model Updates (`backend/src/shared/models/transaction.model.ts`)
Support failure states and pending mint states:
* `status`: `'SUCCESS' | 'PENDING_MINT' | 'FAILED'` (required, default: `'SUCCESS'`)
* `txHash`: `String` (required for 'SUCCESS'; allows placeholder identifier e.g. `pending_<id>` if mint failed)

---

## 4. Blockchain Relayer Service (`backend/src/shared/services/blockchain.service.ts`)

Encapsulates Ethers.js v6 interaction with the deployed `EventTicketNFT` contract:

### 4.1 Interface & Configuration
* Uses `env.RPC_URL`, `env.CONTRACT_ADDRESS`, and `env.RELAYER_PRIVATE_KEY`.
* Relayer wallet must hold `MINTER_ROLE` and `ORGANIZER_ROLE`.

### 4.2 Contract ABI Definition
Exports minimal required ABI:
* `createEvent(uint256 eventId, uint256 maxResalePrice, uint256 saleDeadline, uint256 totalSupply) external`
* `mintTicket(address buyer, uint256 eventId, string calldata metadataURI) external returns (uint256)`
* Event `TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner, string tokenURI)`

### 4.3 Methods
1. `registerEventOnChain(params)`:
   * Formats `maxResalePrice` to Wei (BigInt).
   * Formats `saleDeadline` to Unix timestamp in seconds.
   * Calls `contract.createEvent` and awaits 1 receipt confirmation. Returns `txHash`.
2. `mintTicketOnChain(params)`:
   * Calls `contract.mintTicket(params.buyerWallet, params.onChainEventId, params.metadataURI)`.
   * Awaits 1 receipt confirmation.
   * Extracts `tokenId` from parsed `TicketMinted` event.
   * Returns `{ tokenId: string, txHash: string, blockNumber: number }`.
3. `withRetry<T>(operation: () => Promise<T>, maxRetries = 3, initialDelayMs = 500): Promise<T>`:
   * Executes the operation, retrying up to `maxRetries` times with exponential backoff on transient RPC/network errors.

---

## 5. Event Creation Integration Hook

Update `createEventService` in `backend/src/features/events/events.service.ts`:
1. Upload poster and metadata to Pinata IPFS (existing behavior).
2. Obtain next sequential `onChainEventId` using `getNextSequence('onChainEventId')`.
3. Relayer executes `registerEventOnChain({ onChainEventId, maxResalePrice, saleDeadline, totalCapacity })`.
4. Store `onChainEventId` and `onChainTxHash` into MongoDB `Event` document alongside metadata.

---

## 6. Ticket Purchase Service & API Endpoint

### 6.1 Endpoint Specification
* **Method:** `POST /api/tickets/purchase`
* **Security:** `authenticateJWT` required (authenticated buyer).
* **Request Body:**
  ```json
  {
    "eventId": "66bc1234567890abcdef1234"
  }
  ```
* **Validation (Zod Schema):**
  ```typescript
  export const purchaseTicketSchema = z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
  });
  ```

### 6.2 Business Logic & Failure Handling
1. **Pre-conditions:**
   * Event exists in MongoDB.
   * Event status is `'active'`.
   * Current time is strictly before `event.saleDeadline`.
   * `event.remainingQuota > 0`.
   * `event.onChainEventId` is set and defined.
2. **Quota Locking:**
   * Atomically decrement `remainingQuota` with condition `{ remainingQuota: { $gt: 0 } }`.
   * If result has `remainingQuota === 0`, update status to `'soldout'`.
3. **Mint Execution & Retries:**
   * Call `mintTicketOnChain` wrapped in `withRetry`.
4. **Failure Recovery (PRD Section 13):**
   * If all 3 attempts fail:
     - Log high-priority administrative alert: `[ADMIN_ALERT_MINT_FAILED]` with buyer wallet, event ID, timestamp, and error details.
     - Persist `Transaction` record with:
       ```json
       {
         "txHash": "pending_mint_<unique_id>",
         "type": "mint",
         "tokenId": "0",
         "fromWallet": "0x0000000000000000000000000000000000000000",
         "toWallet": "<buyerWallet>",
         "price": event.ticketPrice,
         "status": "PENDING_MINT"
       }
       ```
     - Throw error or return structured response indicating purchase is queued for mint recovery.
5. **Success Persistence:**
   * Create `Ticket`:
     ```json
     {
       "tokenId": tokenId,
       "eventId": event._id,
       "ownerWallet": buyerWallet,
       "tokenURI": event.metadataCID,
       "mintTxHash": txHash,
       "blockNumber": blockNumber,
       "isUsed": false
     }
     ```
   * Create `Transaction`:
     ```json
     {
       "txHash": txHash,
       "type": "mint",
       "tokenId": tokenId,
       "fromWallet": "0x0000000000000000000000000000000000000000",
       "toWallet": buyerWallet,
       "price": event.ticketPrice,
       "status": "SUCCESS"
     }
     ```
   * Return HTTP 201:
     ```json
     {
       "success": true,
       "data": {
         "tokenId": "1",
         "txHash": "0x..."
       },
       "message": "Ticket purchased and NFT minted successfully"
     }
     ```

---

## 7. Testing Strategy

1. **Unit Tests (`backend/src/shared/services/blockchain.service.test.ts`):**
   * Mock `ethers.Contract` and test `createEvent` and `mintTicket` methods.
   * Verify retry mechanism triggers and stops after 3 failed attempts.
   * Verify event parsing logic correctly extracts `tokenId` from `TicketMinted`.
2. **Integration Tests (`backend/src/features/tickets/tickets.purchase.test.ts`):**
   * Success case: valid buyer JWT, purchases ticket, quota decreases by 1, Ticket and Transaction stored, returns 201.
   * Quota exhausted: returns 400 when `remainingQuota` is 0.
   * Expired deadline: returns 400 when `saleDeadline` is in the past.
   * Unauthenticated request: returns 401.
   * Failure recovery: simulates relayer network failure, verifies `Transaction` has status `PENDING_MINT` and admin alert is output.
