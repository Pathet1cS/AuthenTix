# Project TODO & Development Roadmap

> **Platform:** Web3 Decentralized E-Ticketing Platform (AuthenTix)  
> **Architecture:** Hybrid Web2 + Web3 (Optimism Sepolia Testnet + Express Backend + MongoDB + Next.js)  
> **Source of Truth:** PRD (`PRD ChatGPT.md`)

This file tracks all remaining tasks for engineers and AI agents working on this codebase. Tasks are divided into clear domain sections (**Blockchain**, **Backend**, **Frontend**, **DevOps & Testing**). Mark completed tasks with `[x]`.

---

## 📌 Project Overview & Structure

```
AuthenTix/
├── contracts/          # Smart Contracts (Hardhat / Foundry, Solidity, OpenZeppelin)
├── backend/            # Express.js, TypeScript, MongoDB, Event Listener
├── frontend/           # Next.js, React, TailwindCSS, Thirdweb SDK
└── TODO.md             # This task tracking document
```

---

## 🌐 1. Blockchain & Smart Contracts (`contracts/`)

- [x] **TASK-BC-01: Project Setup & Hardhat Environment**
  - Initialize `contracts/` package with Hardhat/Foundry, TypeScript, Ethers.js v6 / Viem.
  - Configure Optimism Sepolia testnet connection in `hardhat.config.ts`.
  - Install `@openzeppelin/contracts` dependency.

- [x] **TASK-BC-02: Implement `EventTicketNFT.sol` Smart Contract**
  - Inherit `ERC721Enumerable`, `AccessControl`, `Pausable`, `ReentrancyGuard`.
  - Define roles: `DEFAULT_ADMIN_ROLE`, `ORGANIZER_ROLE`, `MINTER_ROLE`.
  - Define struct `EventConfig`:
    ```solidity
    struct EventConfig {
        uint256 maxResalePrice;
        uint256 saleDeadline;
        uint256 totalSupply;
        uint256 mintedSupply;
    }
    ```
  - Implement `createEvent(...)` to initialize event config (restricted to `ORGANIZER_ROLE`).
  - Implement `mintTicket(address buyer, string calldata tokenURI)` (restricted to `MINTER_ROLE`).
  - Implement `createListing(uint256 tokenId, uint256 price)` (enforce `price <= maxResalePrice` and `block.timestamp <= saleDeadline`).
  - Implement `buyResoldTicket(uint256 tokenId)` (payable, transfer ownership, validate status).
  - Implement `markUsed(uint256 tokenId)` (restricted to backend relayer / `ORGANIZER_ROLE`).
  - Implement emergency `pause()` and `unpause()`.
  - Emit events: `TicketMinted`, `TicketTransferred`, `TicketUsed`.

- [x] **TASK-BC-03: Smart Contract Unit Tests**
  - Write tests covering event creation by organizers.
  - Test ticket minting with `MINTER_ROLE` authority only.
  - Test resale rules enforcement (fails if price > `maxResalePrice` or after `saleDeadline`).
  - Test ticket redemption with `markUsed()`.
  - Test `Pausable` and `ReentrancyGuard` protection.
  - Achieve 100% test coverage for access control and transaction boundaries.

- [x] **TASK-BC-04: Deployment & Verification Script**
  - Write deployment script to Optimism Sepolia testnet.
  - Export contract ABI and deployed address to backend and frontend shared config.
  - Verify contract source code on Etherscan / Blockscout.

---

## ⚙️ 2. Backend API & Event Listener (`backend/`)

- [x] **TASK-BE-01: Backend Architecture & Server Setup**
  - Initialize Node.js + Express + TypeScript project structure.
  - Set up environment variable validation (`dotenv` / `zod`).
  - Connect to MongoDB database with Mongoose.
  - Configure global error handling and response formatter middleware.

- [x] **TASK-BE-02: Database Models & Schemas**
  - Define `User` schema (`walletAddress` [unique], `email` [unique], `name`, `role`).
  - Define `Event` schema (`organizerId`, `name`, `description`, `eventDate`, `ticketPrice`, `maxResalePrice`, `saleDeadline`, `totalCapacity`, `remainingQuota`, `posterCID`, `status`).
  - Define `Ticket` schema (`tokenId` [unique], `eventId`, `ownerWallet`, `tokenURI`, `mintTxHash`, `lastTransferTxHash`, `blockNumber`, `isUsed`, `usedAt`).
  - Define `Transaction` schema (`txHash` [unique], `type` [mint|transfer|resell], `tokenId`, `fromWallet`, `toWallet`, `price`, `timestamp`).
  - Define `SyncState` schema (`lastProcessedBlock`).

- [x] **TASK-BE-03: Authentication & Thirdweb Embedded Wallet Integration**
  - Implement `POST /api/auth/login` (verify Thirdweb auth payload/signature).
  - Issue JWT tokens on successful authentication.
  - Create auth middleware (`authenticateJWT`, `authorizeRole('organizer')`, `authorizeRole('admin')`).
  - Bind the signed payload to a domain (`AUTH_DOMAIN`) and statement to prevent cross-site signature replay.
  - Verify the claimed email against Thirdweb (`getUser`) on first signup before creating the user.

- [x] **TASK-BE-04: IPFS Metadata Upload Service**
  - Integrate Pinata SDK (`pinata@2`, JWT auth) as a shared IPFS service.
  - Implement validated poster upload (5MB cap, JPEG/PNG/WebP allowlist, magic-byte check).
  - Implement ERC-721 metadata JSON builder and upload; store `metadataCID` on the event.

- [x] **TASK-BE-05: Event Management API**
  - `POST /api/events`: Create new event, upload metadata to IPFS, and store in MongoDB.
  - `GET /api/events`: List active events with filtering, pagination, and search.
  - `GET /api/events/:id`: Retrieve single event details.

- [x] **TASK-BE-06: Ticket Purchase & Blockchain Relayer Service**
  - `POST /api/tickets/purchase`:
    1. Validate payment / order details.
    2. Backend relayer wallet invokes smart contract `mintTicket(buyerWallet, tokenURI)`.
    3. Handle failure recovery: retry minting up to 3 times; if still failing, mark transaction as `PENDING_MINT` and notify admin (FR-13 / failure rules).
    4. Return `tokenId` and `txHash`.

- [x] **TASK-BE-07: Ticket Resale API**
  - `GET /api/tickets/my`: Authenticated user ticket catalog with status filtering (`all`, `active`, `resale`, `used`) and pagination.
  - `POST /api/tickets/resell`: Create resale listing, validate anti-scalping price cap (`<= maxResalePrice`), check deadline, and verify on-chain `ListingCreated` event.
  - `DELETE /api/tickets/resell/:tokenId`: Cancel resale listing and verify on-chain `ListingCancelled` event.
  - `POST /api/tickets/resell/purchase`: Fulfill secondary purchase, transfer ownership, verify `ListingSold` event, and log `resell` transaction.
  - `GET /api/tickets/resale`: Public secondary marketplace catalog with sorting and pagination.

- [ ] **TASK-BE-08: Dynamic QR & Verification Engine**
  - Implement verification logic for `POST /api/tickets/verify`:
    - **Step 1:** Verify cryptographic signature using owner's wallet address.
    - **Step 2:** Verify QR code timestamp (must not be expired, < 30 seconds validity).
    - **Step 3:** Verify nonce has not been used (prevent replay attacks).
    - **Step 4:** Query blockchain `ownerOf(tokenId)` to verify current owner.
    - **Step 5:** Verify ticket status is not already `isUsed`.
    - **Step 6:** Atomically update ticket status to `isUsed = true` and call `markUsed(tokenId)` on-chain.

- [ ] **TASK-BE-09: Blockchain Event Listener & Recovery Engine**
  - Implement standalone background listener service watching Optimism Sepolia logs:
    - `TicketMinted`
    - `TicketTransferred`
    - `TicketUsed`
  - Maintain `SyncState` with `lastProcessedBlock`.
  - Replicate all on-chain events into MongoDB cache.
  - Implement startup catch-up & recovery process: query missing logs from `lastProcessedBlock` up to `latestBlock` on startup.

- [ ] **TASK-BE-10: Rate Limiting & Security Hardening**
  - Implement rate limiting middleware (100 requests per minute per IP/user).
  - Implement CORS, Helmet, and input validation for all endpoints.

---

## 🎨 3. Frontend Application (`frontend/`)

- [x] **TASK-FE-01: Next.js Scaffolding & Design System**
  - Initialize Next.js (TypeScript, React) app with TailwindCSS.
  - Establish cohesive color palette, modern typography, dark mode options, and glassmorphism styling.
  - Set up component library (Buttons, Cards, Modals, Badges, Toast Notifications).

- [ ] **TASK-FE-02: Thirdweb SDK & Embedded Wallet Integration**
  - Configure `ThirdwebProvider` with Optimism Sepolia testnet setup.
  - Implement Embedded Wallet authentication component (Email & Google OAuth login without raw private keys).
  - Handle session state and JWT storage.

- [x] **TASK-FE-03: Buyer Portal - Homepage & Event Explorer**
  - Build responsive landing page featuring active events banner.
  - Build event catalog page with search, category filtering, and sorting.
  - Build event detail view displaying event poster, schedule, location, remaining tickets, and price.

- [x] **TASK-FE-04: Buyer Portal - Ticket Purchase & Management**
  - Build interactive ticket purchase modal and transaction status indicator.
  - Build "My Tickets" page listing all owned tickets fetched via API/blockchain.
  - Build ticket detail view with ownership provenance history.

- [x] **TASK-FE-05: Dynamic QR Code Generator Component**
  - Build component generating dynamic QR code for ticket entry:
    - Payload format:
      ```json
      {
        "tokenId": "...",
        "walletAddress": "...",
        "nonce": "...",
        "expiresAt": 1718910000,
        "signature": "0x..."
      }
      ```
    - Auto-regenerate QR code every 30 seconds with fresh nonce and valid signature.
    - Display visual countdown timer bar (30s ticker).

- [x] **TASK-FE-06: Ticket Resale Marketplace UI**
  - Build ticket resale listing interface (enforce resale price cap UI validation).
  - Build ticket resale marketplace tab allowing buyers to purchase resold tickets.

- [x] **TASK-FE-07: Organizer Portal - Event Creation & Management**
  - Build Event Creation wizard form:
    - Image poster uploader (previews & triggers IPFS upload).
    - Inputs for name, description, date, total capacity, ticket price, resale cap, sale deadline.
  - Build Organizer Dashboard showing sales analytics, remaining quota, and event status.

- [x] **TASK-FE-08: Organizer Portal - Ticket Verification Scanner UI**
  - Build mobile-friendly camera-based QR Code Scanner page.
  - Send scanned QR payload to `POST /api/tickets/verify`.
  - Display real-time verification feedback (Success: Green / Invalid: Red / Already Used: Yellow) with audio-visual cues.

- [x] **TASK-FE-09: Admin Dashboard UI**
  - Build platform monitoring view for system admins.
  - Display real-time sync status, transaction logs, and manual resync button.

---

## 🛠️ 4. DevOps, Infrastructure & Testing (`devops/`)

- [ ] **TASK-DO-01: Containerization with Docker**
  - Write `Dockerfile` for `backend` and `frontend`.
  - Write `docker-compose.yml` orchestrating MongoDB, Backend API, Event Listener, and Frontend.

- [ ] **TASK-DO-02: CI/CD Pipeline**
  - Create `.github/workflows/ci.yml` for automated linting, smart contract testing, backend API testing, and frontend build verification.

- [ ] **TASK-DO-03: End-to-End System Testing & Verification**
  - Write E2E test script testing full flow:
    1. Authenticate user.
    2. Create event as Organizer.
    3. Purchase ticket as Buyer.
    4. Verify NFT minted on Optimism Sepolia & synced in MongoDB.
    5. Generate dynamic QR code.
    6. Verify QR code as Organizer (check `isUsed` state updated).
    7. Verify duplicate scanning is rejected.
