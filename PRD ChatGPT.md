# Product Requirements Document (PRD)

# Web3 Decentralized E-Ticketing Platform

Version: 1.0
Status: Ready for Engineering Implementation
Architecture: Hybrid Web2 + Web3
Blockchain Network: Optimism Sepolia Testnet

---

# 1. Executive Summary

## Problem Statement

Traditional ticketing systems suffer from:

* Ticket counterfeiting
* Unauthorized ticket duplication
* Automated ticket scalping
* Lack of transparent ownership tracking
* High operational overhead for ticket validation

## Proposed Solution

Develop a decentralized e-ticketing platform that uses NFT-based tickets on Optimism Sepolia while abstracting blockchain complexity from end users through embedded wallets.

The blockchain acts as the immutable source of truth for ticket ownership, while MongoDB serves as a high-performance read cache.

---

# 2. Business Objectives

## BO-01

Eliminate counterfeit tickets through blockchain-based ownership verification.

## BO-02

Reduce ticket scalping through enforced resale restrictions.

## BO-03

Provide a Web2-like user experience without requiring MetaMask or manual wallet management.

## BO-04

Enable event organizers to validate ticket ownership in real time.

---

# 3. System Architecture

## Architecture Overview

Frontend (Next.js)
↓
Backend API (Express.js)
↓
MongoDB
↓
Blockchain Service
↓
Optimism Sepolia

Event Listener Service
↓
Blockchain Events
↓
MongoDB Synchronization

IPFS Layer
↓
Pinata
↓
Metadata Storage

---

## Source of Truth

Blockchain ownership is the primary source of truth.

MongoDB acts only as:

* Read cache
* Search index
* Analytics source

If ownership data differs:

Blockchain state prevails.

---

# 4. Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* TailwindCSS
* Thirdweb React SDK

## Backend

* Node.js
* Express.js
* TypeScript

## Database

* MongoDB

## Blockchain

* Solidity
* ERC-721
* OpenZeppelin

## Storage

* IPFS
* Pinata

## Wallet Infrastructure

* Thirdweb Embedded Wallet

## Infrastructure

* Docker
* GitHub Actions

---

# 5. User Roles

## Buyer

Can:

* Register
* Purchase tickets
* View owned tickets
* Generate QR codes
* Resell tickets

Cannot:

* Create events

---

## Event Organizer

Can:

* Create events
* Configure resale rules
* Validate tickets
* View event analytics

---

## System Administrator

Can:

* Manage platform settings
* Monitor transactions
* Resolve synchronization failures

---

# 6. Functional Requirements

## FR-01 Authentication

Users authenticate using:

* Email
* Google OAuth

System automatically creates or retrieves an embedded wallet.

User must never interact with private keys.

---

## FR-02 Event Creation

Organizer submits:

* Name
* Description
* Location
* Date
* Capacity
* Ticket Price
* Resale Cap
* Sale Deadline
* Poster

System stores event in MongoDB.

---

## FR-03 Metadata Upload

Upon event creation:

1. Upload poster to IPFS.
2. Generate metadata JSON.
3. Upload metadata JSON to IPFS.
4. Store returned CID.

---

## FR-04 Ticket Purchase

Purchase flow:

1. Buyer selects ticket.
2. Payment succeeds.
3. Backend calls mintTicket().
4. NFT minted to buyer wallet.
5. Database updated through blockchain event listener.

---

## FR-05 Ticket Ownership

Each NFT represents exactly one ticket.

One token equals one entry.

NFT ownership determines ticket ownership.

---

## FR-06 Ticket Resale

Resale allowed only when:

* Price ≤ maxResalePrice
* Current time ≤ saleDeadline

Otherwise transaction reverts.

---

## FR-07 Dynamic QR Generation

QR payload:

```json
{
  "tokenId": "123",
  "walletAddress": "0x123",
  "nonce": "abc123",
  "expiresAt": 1718910000,
  "signature": "0x..."
}
```

QR validity:

30 seconds

---

## FR-08 Ticket Verification

Verification sequence:

Step 1

Verify signature.

Step 2

Verify QR not expired.

Step 3

Verify nonce unused.

Step 4

Verify ownerOf(tokenId).

Step 5

Verify ticket not used.

Step 6

Atomically mark ticket as used.

---

## FR-09 Blockchain Synchronization

Listener must monitor:

* TicketMinted
* TicketTransferred
* TicketUsed

All events must be replicated to MongoDB.

---

# 7. Non-Functional Requirements

## Performance

Ticket page load:
< 2 seconds

Ticket verification:
< 3 seconds

QR generation:
< 1 second

---

## Availability

Target uptime:

99%

---

## Scalability

Support:

* 10,000 tickets per event
* 500 concurrent scans
* 1,000 concurrent users

---

## Reliability

System must recover from missed blockchain events.

---

# 8. Smart Contract Specification

## Contract Name

EventTicketNFT

---

## Access Control

Roles:

DEFAULT_ADMIN_ROLE

ORGANIZER_ROLE

MINTER_ROLE

---

## Event Structure

```solidity
struct EventConfig {
    uint256 maxResalePrice;
    uint256 saleDeadline;
    uint256 totalSupply;
    uint256 mintedSupply;
}
```

---

## Required Functions

### createEvent

```solidity
function createEvent(...)
```

Creates event configuration.

---

### mintTicket

```solidity
function mintTicket(
    address buyer,
    string calldata tokenURI
)
```

Mints NFT ticket.

---

### createListing

```solidity
function createListing(
    uint256 tokenId,
    uint256 price
)
```

Creates resale listing.

---

### buyResoldTicket

```solidity
function buyResoldTicket(
    uint256 tokenId
)
payable
```

Transfers ticket after validation.

---

### markUsed

```solidity
function markUsed(
    uint256 tokenId
)
```

Marks ticket as redeemed.

---

### pause

```solidity
function pause()
```

Emergency stop.

---

## Smart Contract Events

```solidity
event TicketMinted(
    uint256 tokenId,
    address owner
);

event TicketTransferred(
    uint256 tokenId,
    address from,
    address to
);

event TicketUsed(
    uint256 tokenId
);
```

---

# 9. API Specification

## Authentication

### POST /api/auth/login

Returns:

```json
{
  "userId": "...",
  "walletAddress": "0x..."
}
```

---

## Events

### POST /api/events

Create event.

---

### GET /api/events

List events.

---

### GET /api/events/:id

Get event details.

---

## Tickets

### POST /api/tickets/purchase

Purchase ticket.

Request:

```json
{
  "eventId": "..."
}
```

Response:

```json
{
  "tokenId": "123",
  "txHash": "0x..."
}
```

---

### GET /api/tickets/my

Returns user-owned tickets.

---

### POST /api/tickets/resell

Create resale listing.

---

### POST /api/tickets/verify

Validate QR code.

---

# 10. Database Schema

## Users

```json
{
  "_id": "ObjectId",
  "walletAddress": "String",
  "email": "String",
  "name": "String",
  "role": "buyer|organizer",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

Constraints:

walletAddress UNIQUE

email UNIQUE

---

## Events

```json
{
  "_id": "ObjectId",
  "organizerId": "ObjectId",
  "name": "String",
  "description": "String",
  "eventDate": "Date",
  "ticketPrice": "Number",
  "maxResalePrice": "Number",
  "saleDeadline": "Date",
  "totalCapacity": "Number",
  "remainingQuota": "Number",
  "posterCID": "String",
  "status": "active|soldout|ended"
}
```

---

## Tickets

```json
{
  "_id": "ObjectId",
  "tokenId": "String",
  "eventId": "ObjectId",
  "ownerWallet": "String",
  "tokenURI": "String",
  "mintTxHash": "String",
  "lastTransferTxHash": "String",
  "blockNumber": "Number",
  "isUsed": false,
  "usedAt": null
}
```

Constraints:

tokenId UNIQUE

---

## Transactions

```json
{
  "_id": "ObjectId",
  "txHash": "String",
  "type": "mint|transfer|resell",
  "tokenId": "String",
  "fromWallet": "String",
  "toWallet": "String",
  "price": "Number",
  "timestamp": "Date"
}
```

Constraints:

txHash UNIQUE

---

# 11. Event Listener Design

## Responsibilities

Listen for:

* TicketMinted
* TicketTransferred
* TicketUsed

---

## Block Tracking

```json
{
  "lastProcessedBlock": 12345678
}
```

---

## Recovery Process

On startup:

1. Read last processed block.
2. Query logs from blockchain.
3. Replay missing events.
4. Update MongoDB.
5. Resume listening.

---

# 12. Security Requirements

## SR-01

Only organizers can create events.

## SR-02

Only backend relayer can mint tickets.

## SR-03

All APIs require JWT authentication.

## SR-04

QR codes expire after 30 seconds.

## SR-05

Nonce can only be used once.

## SR-06

Replay attacks must be rejected.

## SR-07

Rate limit:

100 requests per minute per user.

## SR-08

Smart contract must implement ReentrancyGuard.

## SR-09

Smart contract must implement Pausable.

---

# 13. Failure Recovery Rules

## Payment Success, Mint Failure

System shall:

1. Retry minting 3 times.
2. Mark transaction as PENDING_MINT.
3. Alert administrator.

---

## Mint Success, Database Failure

Blockchain listener must rebuild state from events.

---

## Listener Failure

System must replay events from last processed block.

---

# 14. Assumptions

ASSUMPTION-01

One NFT equals one ticket.

ASSUMPTION-02

Only Optimism Sepolia is supported.

ASSUMPTION-03

Embedded wallets are provided by Thirdweb.

ASSUMPTION-04

Blockchain ownership is authoritative.

ASSUMPTION-05

Users do not interact with private keys.

---

# 15. Acceptance Criteria

A release is considered successful when:

1. Organizer can create events.
2. Buyer can purchase NFT tickets.
3. NFT ownership exists on-chain.
4. MongoDB synchronizes ownership.
5. QR verification succeeds.
6. Duplicate entry is prevented.
7. Resale restrictions are enforced.
8. Event listener recovers from outages.
9. System passes end-to-end testing.
10. All critical security requirements are validated.

```
```
