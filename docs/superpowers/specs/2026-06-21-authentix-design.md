# AuthenTix Architecture & Design Spec

## 1. Overview
AuthenTix is a Web3 Decentralized E-Ticketing Platform that eliminates counterfeit tickets and unauthorized scalping. It uses Optimism Sepolia as the source of truth for ticket ownership, wrapped in a Web2-like user experience using Thirdweb's embedded wallets. MongoDB is used as a high-performance read cache.

## 2. Codebase Structure
The project uses a simple single repository structure with distinct folders for the three main tiers.

- `/frontend`: Next.js (App Router), TailwindCSS, Thirdweb React SDK.
- `/backend`: Node.js, Express.js API, MongoDB (Mongoose), and an integrated blockchain event listener.
- `/contracts`: Hardhat environment for Solidity smart contracts, using OpenZeppelin standards (ERC-721).

## 3. Component Design

### 3.1 Smart Contracts (Hardhat)
- **Contract**: `EventTicketNFT` (ERC-721)
- **Roles**: `DEFAULT_ADMIN_ROLE`, `ORGANIZER_ROLE`, `MINTER_ROLE`.
- **Functions**: `createEvent`, `mintTicket`, `createListing`, `buyResoldTicket`, `markUsed`.
- **Enforcement**: Smart contracts strictly enforce the `maxResalePrice` and `saleDeadline`.

### 3.2 Backend (Express.js)
- **Responsibilities**: 
  - Expose REST endpoints (`/api/auth`, `/api/events`, `/api/tickets`).
  - Handle IPFS uploads via Pinata.
  - Coordinate minting transactions to the blockchain (relayer).
  - Verify QR codes and atomically mark tickets as used.
- **Background Event Listener**:
  - Runs as a worker process alongside the Express server.
  - Listens to `TicketMinted`, `TicketTransferred`, and `TicketUsed` events on Optimism Sepolia.
  - Replicates blockchain state into MongoDB.
  - Incorporates block tracking to recover missing events upon restart.

### 3.3 Frontend (Next.js)
- **Authentication**: Email and Google OAuth mapped to Thirdweb embedded wallets. Users do not handle private keys.
- **Buyer Experience**: Browse events, purchase tickets via credit card/fiat, view owned tickets, generate dynamic QR codes for entry, and list tickets for resale.
- **Organizer Experience**: Create events, define capacity/pricing/resale rules, and scan QR codes for validation.

## 4. Data Flow & Source of Truth
- **Purchasing**: User buys -> Backend initiates `mintTicket` -> Blockchain mints NFT -> Event Listener catches `TicketMinted` -> MongoDB updates cache -> Frontend reflects ownership.
- **Verification**: Frontend generates dynamic QR code (Token ID, Wallet, Nonce, Expiry, Signature) -> Organizer scans -> Backend verifies signature, expiry, nonce, owner, and used status -> Backend marks ticket as used via smart contract.
- **Source of Truth**: The Optimism Sepolia blockchain is the ultimate source of truth. MongoDB is strictly a read replica. If a database discrepancy arises, the Event Listener rebuilds state from the blockchain.

## 5. Security & Recovery
- All API endpoints are secured with JWT.
- QR codes expire in 30 seconds and utilize one-time nonces to prevent replay attacks.
- If a mint transaction fails after payment, it is retried 3 times and marked as `PENDING_MINT` for manual resolution.
- The Event Listener stores the `lastProcessedBlock` and queries logs from that block upon startup to ensure zero missed events.
