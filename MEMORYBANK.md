# Project Memory Bank (`MEMORYBANK.md`)

> **Application:** Web3 Decentralized E-Ticketing Platform (AuthenTix)  
> **Current Phase:** Phase 2 — Backend API & Event Listener (`backend/`)  
> **Last Updated:** 2026-08-04

---

## 🎯 Current Status / Active Task

- **Focus:** Phase 2 - Backend API (`backend/`) — **IN PROGRESS**
- **Status:** TASK-BE-01 (Server Setup) and TASK-BE-02 (Database Models) completed. 48 backend tests passing.
- **Next Focus:** TASK-BE-03 (Authentication & Thirdweb Embedded Wallet Integration).

---

## ✅ What Has Been Done

- [x] **PRD Analysis & Task Decomposition:** Parsed `PRD ChatGPT.md` requirements and mapped architecture (Hybrid Web2 + Web3 on Optimism Sepolia).
- [x] **Project Roadmap Creation:** Generated `TODO.md` breaking down system into 4 distinct phases (Blockchain, Backend API & Listener, Frontend Next.js App, DevOps & E2E).
- [x] **Architecture Alignment:** Bottom-Up execution strategy starting with Phase 1 (Smart Contracts).
- [x] **Hardhat & TypeScript Environment Setup:** Configured `contracts/package.json`, `tsconfig.json`, and `contracts/hardhat.config.ts` (`evmVersion: "cancun"`) targeting Optimism Sepolia testnet (Chain ID `11155420`).
- [x] **Smart Contract Implementation (`EventTicketNFT.sol`):**
  - Built ERC-721 token with OpenZeppelin `ERC721URIStorage`, `AccessControl`, `Pausable`, and `ReentrancyGuard`.
  - Roles: `DEFAULT_ADMIN_ROLE`, `ORGANIZER_ROLE`, `MINTER_ROLE`.
  - Core methods: `createEvent`, `mintTicket`, `createListing`, `cancelListing`, `buyResoldTicket`, `markUsed`, `pause`, `unpause`.
  - On-chain Events: `EventCreated`, `TicketMinted`, `TicketTransferred`, `TicketUsed`, `ListingCreated`, `ListingSold`, `ListingCancelled`.
- [x] **Unit Testing Suite (`contracts/test/EventTicketNFT.test.ts`):** Complete Chai + Hardhat tests covering deployment, role checks, event creation, ticket minting, resale caps enforcement, entry verification, and emergency pause.
- [x] **Deployment Script (`contracts/scripts/deploy.ts`):** Automated deployment script for Optimism Sepolia exporting contract addresses and deployment JSON metadata.
- [x] **Verification:** Executed `npx hardhat test` — **All 13 tests PASSED**.
- [x] **TASK-BE-01: Backend Architecture & Server Setup:** Express 4 + TypeScript 5 + Mongoose 8 scaffold. Zod env validation, global error handler, response helpers (`sendSuccess`/`sendError`), MongoDB connection with single retry, `app.ts`/`server.ts` separation for testability, health endpoint, feature router stubs (`/api/auth`, `/api/events`, `/api/tickets`). 16 tests passing.
- [x] **TASK-BE-02: Database Models & Schemas:** 5 Mongoose models (`User`, `Event`, `Ticket`, `Transaction`, `SyncState`) with validation, unique constraints, indexes, and type-safe interfaces aligned with PRD Section 10. `mongodb-memory-server` test infrastructure. 32 model tests (48 total).

---

## ⏳ What Needs to be Done Next

### **Phase 2: Backend API & Event Listener (`backend/`) — IN PROGRESS**
- [x] Initialize Express + TypeScript project & MongoDB Mongoose connection.
- [x] Implement database models (`User`, `Event`, `Ticket`, `Transaction`, `SyncState`).
- [ ] Implement Thirdweb Embedded Wallet authentication & JWT middleware.
- [ ] Implement IPFS / Pinata metadata upload service.
- [ ] Implement Event Management APIs (`POST /api/events`, `GET /api/events`).
- [ ] Implement Ticket Purchase & Relayer Minting service with retry logic.
- [ ] Implement Dynamic 30s QR Verification Engine (`POST /api/tickets/verify`).
- [ ] Implement Blockchain Event Listener & catch-up block sync engine.

---

### **Phase 3: Frontend Application (`frontend/`) — UPCOMING**
- [ ] Initialize Next.js app with TailwindCSS & Thirdweb SDK.
- [ ] Implement Embedded Wallet Login (Email / Google OAuth).
- [ ] Implement Buyer UI (Event catalogue, Ticket purchase, My Tickets page).
- [ ] Implement Dynamic QR Code Generator (30s ticker, signed payload).
- [ ] Implement Resale Marketplace UI.
- [ ] Implement Organizer UI (Event creation form & mobile QR scanner).
- [ ] Implement Admin Monitoring Dashboard.

---

### **Phase 4: DevOps, Infrastructure & Testing (`devops/`) — FINAL**
- [ ] Docker containerization (`docker-compose.yml`).
- [ ] GitHub Actions CI/CD setup.
- [ ] End-to-end integration test execution.
