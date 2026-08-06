# Project Memory Bank (`MEMORYBANK.md`)

> **Application:** Web3 Decentralized E-Ticketing Platform (AuthenTix)  
> **Current Phase:** Phase 2 — Backend API & Event Listener (`backend/`)  
> **Last Updated:** 2026-08-05

---

## 🎯 Current Status / Active Task

- **Focus:** Phase 2 - Backend API (`backend/`) — **IN PROGRESS**
- **Status:** TASK-BE-01 (Server Setup), TASK-BE-02 (Database Models), TASK-BE-03 (Authentication), and TASK-BE-04 (IPFS Metadata Upload) completed. 206 backend tests passing.
- **Next Focus:** TASK-BE-05 (Event Management API).

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
- [x] **TASK-BE-03: Authentication & Thirdweb Embedded Wallet Integration:** `POST /api/auth/login` verifying a client-signed payload via `verifySignature` from `thirdweb/auth` (handles both EOA and smart-account wallets). The signed message is domain-bound — it carries `domain` and `statement` fields checked against `AUTH_DOMAIN` and `LOGIN_STATEMENT`, so a signature harvested by another site cannot be replayed here. On first signup the claimed email is verified against Thirdweb via `getUser` before the `User` is created, closing an email-squatting hole; returning logins skip that call and stay network-free. Users are always seeded as `buyer`, with duplicate-key handling (concurrent same-wallet signup resolves idempotently; an email already tied to another wallet returns 409). Issues a 7-day JWT. Ships `authenticateJWT` and variadic `authorizeRole(...)`, the latter re-reading the stored role for organizer/admin gates so a demotion takes effect immediately. 105 tests. Known gap: login replay within the 5-minute payload window is still open until TASK-BE-08 builds the nonce store required by SR-05/SR-06.
- [x] **Security hardening (from BE-03 review):** global error handler no longer echoes internal error text to clients, `JWT_SECRET` requires 32+ characters, all login payload fields are length-bounded, and the Jest suite runs serially so `npm test` is green by default.
- [x] **TASK-BE-04: IPFS Metadata Upload Service:** Pinata SDK v2 wired through `config/pinata.ts` with JWT auth (`PINATA_JWT`/`PINATA_GATEWAY` replace the legacy key/secret pair). `shared/utils/ipfs.ts` is the single path to Pinata: the private `pinFile` does serialisation, the size cap, name sanitisation and transport, so validation — not just error mapping — has one choke point. Every payload is capped at 5MB, poster and metadata alike; the poster path keeps its own earlier check for the documented 400 `Poster exceeds 5MB limit`, while any other oversize payload gets a 400 `Upload exceeds 5MB limit` (nothing upstream bounds an event name or description, and a pin is permanent and billed). Posters allow only JPEG/PNG/WebP and are checked MIME → size → magic bytes, so a script-bearing SVG cannot masquerade as an image on a public gateway. Caller-supplied file names are sanitised to `[A-Za-z0-9._-]` and capped at 100 characters on both paths. The outbound call is raced against a 30s timeout — `PinataConfig` exposes no timeout hook and undici's ~300s default would otherwise pin an Express worker to a stalled Pinata — with the timer always cleared on settle. Every Pinata failure — thrown error, timeout, unserialisable payload, or a response with no CID — becomes a flat 502 `IPFS upload failed`, with the original logged server-side only. `features/events/event.metadata.ts` builds the ERC-721 document (dates as Unix seconds, `image` as `ipfs://<posterCID>`); an Invalid Date is rejected as a 400 rather than serialised to `null` in a document that is immutable once pinned, and `uploadEventAssets` re-checks both dates before the poster upload so a bad one costs no pin. `uploadEventAssets` runs the FR-03 sequence, returning both CIDs. Metadata is per-event: every ticket of an event shares one `tokenURI`, and uniqueness lives in the on-chain `tokenId`. Fail fast, no retry, no unpin — a failed metadata upload leaves an orphaned poster pin. `Event` gains `metadataCID`. 206 tests.

---

## ⏳ What Needs to be Done Next

### **Phase 2: Backend API & Event Listener (`backend/`) — IN PROGRESS**
- [x] Initialize Express + TypeScript project & MongoDB Mongoose connection.
- [x] Implement database models (`User`, `Event`, `Ticket`, `Transaction`, `SyncState`).
- [x] Implement Thirdweb Embedded Wallet authentication & JWT middleware.
- [x] Implement IPFS / Pinata metadata upload service.
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
