# Design Specification: TASK-BE-07 Ticket Resale & User Ticket Lifecycle Management

- **Document Version:** 1.0.0
- **Date:** 2026-09-16
- **Status:** Approved / Ready for Implementation
- **Target Component:** `backend/src/features/tickets/`, `backend/src/shared/models/`, `backend/src/shared/services/`
- **Related Requirements:** PRD Sections 6 (FR-06 Ticket Resale), 9 (API Specifications: `POST /api/tickets/resell`, `GET /api/tickets/my`), and 7 (Non-Functional Requirements).

---

## 1. Executive Summary

This specification defines the architecture, API contracts, data model updates, on-chain verification mechanisms, and testing strategy for **TASK-BE-07: Ticket Resale API & Ticket Management**.

In AuthenTix, secondary ticket resales are governed on-chain by the `EventTicketNFT.sol` smart contract to prevent ticket scalping. The contract enforces price ceilings (`price <= maxResalePrice`), sales deadlines (`block.timestamp <= saleDeadline`), and prevents redeemed tickets (`!isTicketUsed`) from entering circulation.

Because `createListing`, `cancelListing`, and `buyResoldTicket` require the owner/buyer's signature (`ownerOf(tokenId) == msg.sender` or `msg.value`), transactions are submitted directly from user wallets. The backend serves as a high-performance verification, indexing, and management engine that cryptographically verifies on-chain transaction receipts on Optimism Sepolia and synchronizes ticket states in MongoDB for instant querying and filtering.

---

## 2. System Architecture & Component Interactions

```
 +-----------------------------------------------------------------------------------+
 |                               Next.js Frontend Client                             |
 +--------+-----------------------+--------------------+---------------------+-------+
          |                       |                    |                     |
          | 1. GET /my            | 2. POST /resell    | 3. DELETE /resell   | 4. POST /resell/purchase
          | (Fetch owned tickets) | (Index listing)    | (Cancel listing)    | (Sync resale transfer)
          v                       v                    v                     v
 +-----------------------------------------------------------------------------------+
 |                                Express Backend API                                |
 |                            (features/tickets/routes.ts)                           |
 +--------+-----------------------+--------------------+---------------------+-------+
          |                       |                    |                     |
          |                       | [Receipt Verify]   | [Receipt Verify]    | [Receipt Verify]
          |                       +----------+---------+----------+----------+
          |                                  |                    |
          |                                  v                    v
          |                         +-----------------------------------+
          |                         |      BlockchainService            |
          |                         |  (Optimism Sepolia RPC Provider)  |
          |                         +-----------------+-----------------+
          |                                           |
          |                                           | Query getTransactionReceipt
          |                                           v
          |                         +-----------------------------------+
          |                         |   EventTicketNFT Smart Contract   |
          |                         +-----------------------------------+
          |
          v
 +-----------------------------------------------------------------------------------+
 |                                MongoDB Database                                   |
 |         - Ticket: update isListed, resalePrice, ownerWallet                       |
 |         - Transaction: audit log (type: 'resell')                                 |
 +-----------------------------------------------------------------------------------+
```

---

## 3. Database Schema Extensions

### 3.1 `Ticket` Model (`backend/src/shared/models/ticket.model.ts`)
Add three new fields to track resale listing status and indexing:

```typescript
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
  // NEW RESALE FIELDS:
  isListed: boolean;
  resalePrice: number | null; // In decimal ETH (e.g., 0.05 ETH)
  listingTxHash: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Field Specifications:
- `isListed`: `Boolean`, default `false`, indexed. Indicates whether ticket is actively listed in the secondary marketplace.
- `resalePrice`: `Number`, default `null`. Represents resale price in decimal ETH.
- `listingTxHash`: `String`, default `""`. The on-chain transaction hash that created the active listing.

#### Indexes:
- Compound Index: `{ isListed: 1, eventId: 1 }` — for rapid filtering and sorting in public marketplace endpoints.
- Compound Index: `{ ownerWallet: 1, isListed: 1, isUsed: 1 }` — for status filtering in `GET /api/tickets/my`.

---

## 4. API Endpoints Specification

### 4.1 `GET /api/tickets/my`
Retrieve all tickets owned by the authenticated wallet.

- **Authentication:** Bearer JWT required (`authenticateJWT`).
- **HTTP Method:** `GET`
- **Route:** `/api/tickets/my`
- **Query Parameters:**
  - `status`: Optional enum `all | active | resale | used` (default: `all`).
    - `all`: All tickets where `ownerWallet == req.user.walletAddress`.
    - `active`: `{ ownerWallet: req.user.walletAddress, isUsed: false, isListed: false }`.
    - `resale`: `{ ownerWallet: req.user.walletAddress, isListed: true }`.
    - `used`: `{ ownerWallet: req.user.walletAddress, isUsed: true }`.
  - `page`: Optional integer $\ge 1$ (default: `1`).
  - `limit`: Optional integer between $1$ and $50$ (default: `10`).
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "tickets": [
        {
          "tokenId": "1",
          "eventId": {
            "_id": "66e8541a947d519b517df4a0",
            "name": "Web3 Summit 2026",
            "eventDate": "2026-10-15T09:00:00.000Z",
            "ticketPrice": 0.05,
            "maxResalePrice": 0.075,
            "posterCID": "ipfs://QmPoster...",
            "status": "active",
            "saleDeadline": "2026-10-14T23:59:59.000Z"
          },
          "ownerWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
          "tokenURI": "ipfs://QmMetadata...",
          "mintTxHash": "0x123...",
          "lastTransferTxHash": "",
          "blockNumber": 1234567,
          "isUsed": false,
          "usedAt": null,
          "isListed": true,
          "resalePrice": 0.06,
          "listingTxHash": "0xabc...",
          "createdAt": "2026-09-16T12:00:00.000Z",
          "updatedAt": "2026-09-16T12:05:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

---

### 4.2 `POST /api/tickets/resell`
Validate and index an on-chain resale listing created by the seller.

- **Authentication:** Bearer JWT required (`authenticateJWT`).
- **HTTP Method:** `POST`
- **Route:** `/api/tickets/resell`
- **Request Body:**
  ```json
  {
    "tokenId": "1",
    "price": 0.06,
    "txHash": "0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef"
  }
  ```
- **Validation Rules (Zod):**
  - `tokenId`: string, non-empty.
  - `price`: positive number, $> 0$.
  - `txHash`: string matching `^0x[a-fA-F0-9]{64}$`.
- **Business Logic:**
  1. Find ticket by `tokenId` in MongoDB; verify exists (else `404`).
  2. Verify `ticket.ownerWallet === req.user.walletAddress.toLowerCase()` (else `403 Forbidden`).
  3. Verify `!ticket.isUsed` (else `400 Bad Request: Ticket is already redeemed`).
  4. Verify `!ticket.isListed` (else `409 Conflict: Ticket is already listed for resale`).
  5. Find parent `Event`; verify `price <= event.maxResalePrice` (else `400 Bad Request: Price exceeds max resale cap`).
  6. Verify `new Date() <= event.saleDeadline` (else `400 Bad Request: Event sale deadline has passed`).
  7. Convert price to wei: `expectedPriceWei = ethers.parseEther(price.toString())`.
  8. Call `blockchainService.verifyListingCreatedOnChain({ txHash, tokenId, sellerWallet: req.user.walletAddress, expectedPriceWei })`.
     - Validates receipt `status === 1`.
     - Parses `ListingCreated` log emitted by `EventTicketNFT`.
     - Validates emitted `tokenId`, `seller`, and `price`.
  9. Atomically update `Ticket`:
     - `isListed: true`
     - `resalePrice: price`
     - `listingTxHash: txHash`
  10. Create audit `Transaction` record:
      - `txHash`: `txHash`
      - `type`: `'resell'`
      - `tokenId`: `tokenId`
      - `fromWallet`: `req.user.walletAddress.toLowerCase()`
      - `toWallet`: `ethers.ZeroAddress` (escrow / marketplace state)
      - `price`: `price`
      - `timestamp`: `new Date()`
      - `status`: `'SUCCESS'`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Resale listing indexed successfully",
    "data": {
      "tokenId": "1",
      "isListed": true,
      "resalePrice": 0.06,
      "listingTxHash": "0x9876..."
    }
  }
  ```

---

### 4.3 `DELETE /api/tickets/resell/:tokenId`
Validate and index an on-chain listing cancellation.

- **Authentication:** Bearer JWT required (`authenticateJWT`).
- **HTTP Method:** `DELETE`
- **Route:** `/api/tickets/resell/:tokenId`
- **Request Body:**
  ```json
  {
    "txHash": "0x5555555555abcdef5555555555abcdef5555555555abcdef5555555555abcdef"
  }
  ```
- **Business Logic:**
  1. Find ticket by `tokenId` in MongoDB; verify exists (else `404`).
  2. Verify `ticket.ownerWallet === req.user.walletAddress.toLowerCase()` (else `403 Forbidden`).
  3. Verify `ticket.isListed === true` (else `400 Bad Request: Ticket is not currently listed`).
  4. Call `blockchainService.verifyListingCancelledOnChain({ txHash, tokenId, sellerWallet: req.user.walletAddress })`.
     - Validates receipt `status === 1`.
     - Parses `ListingCancelled` log from contract.
     - Confirms `tokenId` and `seller`.
  5. Atomically update `Ticket`:
     - `isListed: false`
     - `resalePrice: null`
     - `listingTxHash: ""`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Resale listing cancelled successfully",
    "data": {
      "tokenId": "1",
      "isListed": false,
      "resalePrice": null
    }
  }
  ```

---

### 4.4 `POST /api/tickets/resell/purchase`
Validate and synchronize ownership following an on-chain `buyResoldTicket` purchase.

- **Authentication:** Bearer JWT required (`authenticateJWT`).
- **HTTP Method:** `POST`
- **Route:** `/api/tickets/resell/purchase`
- **Request Body:**
  ```json
  {
    "tokenId": "1",
    "txHash": "0x7777777777abcdef7777777777abcdef7777777777abcdef7777777777abcdef"
  }
  ```
- **Business Logic:**
  1. Find ticket by `tokenId` in MongoDB; verify exists (else `404`).
  2. Verify `ticket.isListed === true` (else `400 Bad Request: Ticket is not listed for resale`).
  3. Call `blockchainService.verifyListingSoldOnChain({ txHash, tokenId, buyerWallet: req.user.walletAddress })`.
     - Validates receipt `status === 1`.
     - Parses `ListingSold` and `TicketTransferred` logs.
     - Confirms `buyer === req.user.walletAddress.toLowerCase()`.
     - Extracts `seller` and `priceWei`.
  4. Convert `priceWei` to decimal ETH: `Number(ethers.formatEther(priceWei))`.
  5. Atomically update `Ticket`:
     - `ownerWallet: req.user.walletAddress.toLowerCase()`
     - `isListed: false`
     - `resalePrice: null`
     - `listingTxHash: ""`
     - `lastTransferTxHash: txHash`
  6. Create audit `Transaction` record:
     - `txHash`: `txHash`
     - `type`: `'resell'`
     - `tokenId`: `tokenId`
     - `fromWallet`: `sellerWallet`
     - `toWallet`: `req.user.walletAddress.toLowerCase()`
     - `price`: `priceEth`
     - `timestamp`: `new Date()`
     - `status`: `'SUCCESS'`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Resale purchase synchronized successfully",
    "data": {
      "tokenId": "1",
      "ownerWallet": "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f",
      "isListed": false,
      "lastTransferTxHash": "0x7777..."
    }
  }
  ```

---

### 4.5 `GET /api/tickets/resale`
Public marketplace query for active secondary ticket listings.

- **Authentication:** Public (no auth required).
- **HTTP Method:** `GET`
- **Route:** `/api/tickets/resale`
- **Query Parameters:**
  - `eventId`: Optional string (MongoDB ObjectId of the event).
  - `sortBy`: Optional enum `price_asc | price_desc | newest` (default: `newest`).
  - `page`: Optional integer $\ge 1$ (default: `1`).
  - `limit`: Optional integer between $1$ and $50$ (default: `20`).
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "listings": [
        {
          "tokenId": "1",
          "eventId": {
            "_id": "66e8541a947d519b517df4a0",
            "name": "Web3 Summit 2026",
            "eventDate": "2026-10-15T09:00:00.000Z",
            "ticketPrice": 0.05,
            "maxResalePrice": 0.075,
            "posterCID": "ipfs://QmPoster...",
            "status": "active"
          },
          "ownerWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
          "resalePrice": 0.06,
          "listingTxHash": "0x9876...",
          "updatedAt": "2026-09-16T12:05:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

---

## 5. Blockchain Service Specification

Extend `BlockchainService` (`backend/src/shared/services/blockchain.service.ts`):

```typescript
export const EVENT_TICKET_NFT_ABI = [
  // Existing:
  'function createEvent(uint256 eventId, uint256 maxResalePrice, uint256 saleDeadline, uint256 totalSupply) external',
  'function mintTicket(address buyer, uint256 eventId, string calldata metadataURI) external returns (uint256)',
  'event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner, string tokenURI)',
  // Added for Resale:
  'event ListingCreated(uint256 indexed tokenId, address indexed seller, uint256 price)',
  'event ListingCancelled(uint256 indexed tokenId, address indexed seller)',
  'event ListingSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)',
  'event TicketTransferred(uint256 indexed tokenId, address indexed from, address indexed to)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function resaleListings(uint256 tokenId) external view returns (address seller, uint256 price, bool isActive)',
];
```

### 5.1 Verification Methods
1. `verifyListingCreatedOnChain(params: { txHash: string; tokenId: string; sellerWallet: string; expectedPriceWei: bigint }): Promise<{ blockNumber: number }>`
2. `verifyListingCancelledOnChain(params: { txHash: string; tokenId: string; sellerWallet: string }): Promise<{ blockNumber: number }>`
3. `verifyListingSoldOnChain(params: { txHash: string; tokenId: string; buyerWallet: string }): Promise<{ sellerWallet: string; priceWei: bigint; blockNumber: number }>`

Each method:
- Queries `provider.getTransactionReceipt(txHash)`.
- Validates `receipt && receipt.status === 1`.
- Iterates over logs, parsing through `contract.interface.parseLog`.
- Asserts that the contract address matches `env.CONTRACT_ADDRESS`.
- Validates matching parameters and addresses (case-insensitive checksum comparison).
- Throws descriptive `AppError` (`502 Bad Gateway` or `400/403`).

---

## 6. Security, Anti-Scalping & Edge Cases

1. **Anti-Scalping Enforcement:** The API strictly validates `price <= event.maxResalePrice` both in Express pre-checks and on-chain event receipt parsing. Any price manipulation attempt is rejected.
2. **Double-Listing Prevention:** `Ticket.findOneAndUpdate({ tokenId, isListed: false }, ...)` prevents race conditions and concurrent duplicate listings.
3. **Receipt Hijacking Prevention:** Every verification method validates that the transaction sender/buyer/seller matches `req.user.walletAddress.toLowerCase()`. An attacker cannot replay or claim another user's on-chain transaction.
4. **Redeemed Ticket Guard:** Tickets marked `isUsed: true` are blocked from resale listing at both the DB and contract verification level.
5. **Reentrancy & Front-Running:** On-chain contract uses OpenZeppelin `ReentrancyGuard` and marks `listing.isActive = false` prior to funds transfer. The backend records final settled receipts.

---

## 7. Testing Strategy

1. **Unit Tests (`blockchain.service.test.ts`):**
   - Mock RPC receipt parser for `ListingCreated`, `ListingCancelled`, `ListingSold`, and `TicketTransferred`.
   - Verify handling of reverted transactions (`status === 0`).
   - Verify handling of parameter mismatches (`seller`, `buyer`, `priceWei`, `tokenId`).

2. **Integration Tests (`tickets.resale.test.ts`):**
   - Full REST test suite with `mongodb-memory-server` and supertest.
   - Authentication gates (`401 Unauthorized`).
   - `GET /api/tickets/my` status filtering (`active`, `resale`, `used`) and pagination.
   - `POST /api/tickets/resell` happy path, cap violation, deadline passed, already used, already listed.
   - `DELETE /api/tickets/resell/:tokenId` happy path and unauthorized cancel.
   - `POST /api/tickets/resell/purchase` ownership handoff and `Transaction` audit creation.
   - `GET /api/tickets/resale` marketplace queries and sorting.
