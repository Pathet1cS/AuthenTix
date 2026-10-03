# Project Memory Bank (`MEMORYBANK.md`)

> **Application:** Web3 Decentralized E-Ticketing Platform (AuthenTix)  
> **Current Phase:** Phase 2 — Backend API & Event Listener (`backend/`)  
> **Last Updated:** 2026-10-03

---

## 🎯 Current Status / Active Task

- **Focus:** Phase 2 - Backend API (`backend/`) — **IN PROGRESS**
- **Status:** TASK-BE-01 through TASK-BE-09 completed (Server Setup, Database Models, Authentication, IPFS Metadata Upload, Event Management API, Ticket Purchase & Relayer Minting, Ticket Resale API & User Ticket Lifecycle, Dynamic QR Verification Engine, Blockchain Event Listener & Recovery Engine).
- **Next Focus:** TASK-BE-10 (Rate Limiting & Security Hardening).

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
- [x] **TASK-FE-01 to TASK-FE-09: Next.js 14 Frontend UI Suite Completed:** Scaffolded Next.js 14 App Router application in `frontend/` with Tailwind CSS obsidian dark theme, Framer Motion animations, Lucide React icons, and presentation mock data layer. Built Navbar & Footer shell, Buyer Portal (Homepage, Event Explorer, Event Detail view, Purchase Modal, My Tickets gallery, Ticket Provenance detail, Dynamic 30s QR Code Modal), Organizer Studio (4-step Event Creation Wizard with Pinata IPFS preview, Analytics Dashboard, Mobile Ticket Verification Scanner with camera viewfinder simulation), and Admin System Health Dashboard. `npm run build` passing cleanly with 0 errors across 9 static/dynamic routes.
- [x] **TASK-BE-06: Ticket Purchase & Blockchain Relayer Service:** Implemented `POST /api/tickets/purchase` endpoint and relayer minting pipeline. Includes atomic quota reservation with optimistic locking (`findOneAndUpdate` on `remainingQuota > 0`), auto-incrementing sequential ticket IDs (`Counter` model), ticket metadata generation & Pinata IPFS upload, relayer transaction execution (`mintTicket`) via Ethers.js v6 on Optimism Sepolia, up to 3 automatic mint retries with exponential backoff on transient RPC errors, permanent failure handling flagging `isPendingMint: true` / `PENDING_MINT` transaction log with admin alerts. 267 backend tests passing.
- [x] **TASK-BE-07: Ticket Resale API & User Ticket Lifecycle:** Implemented 5 resale and ticket management endpoints: `GET /api/tickets/my` (catalog with `all|active|resale|used` filters), `POST /api/tickets/resell` (anti-scalping price cap verification $\le$ `maxResalePrice`, deadline check, on-chain receipt verification for `ListingCreated`, atomic listing update), `DELETE /api/tickets/resell/:tokenId` (on-chain `ListingCancelled` verification, listing rollback), `POST /api/tickets/resell/purchase` (on-chain `ListingSold` verification, buyer ownership transfer, `resell` transaction audit log), and `GET /api/tickets/resale` (public marketplace catalog with price sorting and event filter). 303 backend tests passing across 31 suites.
- [x] **TASK-BE-08: Dynamic QR & Verification Engine:** Implemented `POST /api/tickets/verify` (`authenticateJWT` + `authorizeRole('organizer','admin')` — the JWT authenticates the scanning gate staff, the signature inside the body authenticates the ticket holder). Verification pipeline runs cheap-to-expensive: timestamp window check (rejects an expired QR and, since the FR-07 payload carries no `issuedAt`, also rejects an `expiresAt` signed further than 30s+skew into the future — the only way to enforce freshness without an issuance timestamp) → nonce consumption → wallet signature check (`serializeQrPayload`, same fixed-key-order pattern as `serializeLoginPayload`) → MongoDB `isUsed` fast-path guard → an optimistic-lock `findOneAndUpdate` that claims the ticket before spending gas (blocks concurrent double-scans) → on-chain `ownerOf` check (authoritative over MongoDB's cached `ownerWallet`, so an unindexed resale still verifies) → relayer `markUsed(tokenId)` write with 3x retry. Any failure after the optimistic lock rolls it back so the ticket stays scannable; an exhausted-retry redemption logs a `FAILED` `Transaction` row and an `[ADMIN_ALERT_MARK_USED_FAILED]` console alert, mirroring the existing `PENDING_MINT` pattern. `markUsedOnChain` treats the contract's own `"Ticket already used"` revert as an idempotent success (a legitimate outcome when a retry's transaction actually lands after the caller had already timed out), rather than a failure.
  - **Shared nonce store:** new `UsedNonce` model (`backend/src/shared/models/nonce.model.ts`, unique `{scope, nonce}` index + TTL cleanup on `expiresAt`) and `consumeNonce()` service, scoped `'login' | 'qr-verify'` so one store serves both flows.
  - **Closed a TASK-BE-03 gap:** `auth.service.ts`'s `login()` validated payload expiry/domain/statement/signature but never persisted the SIWE `nonce`, so a captured login payload was replayable until its 5-minute expiry. `login()` now calls `consumeNonce({ scope: 'login', ... })` right before the signature check, closing PRD SR-05/SR-06 for both flows with one store.
  - `Transaction.type` enum gained `'redeem'`. `BlockchainService` gained `ownerOfOnChain` (read) and `markUsedOnChain` (write, idempotent on-chain-already-used detection); `EVENT_TICKET_NFT_ABI` gained `markUsed` and the two-arg `TicketUsed(tokenId, eventId)` event (the deployed contract's real signature, which differs from the PRD's simplified single-arg prose).
  - 336 backend tests passing across 34 suites (up from 303/31).
- [x] **TASK-BE-09: Blockchain Event Listener & Recovery Engine:** Implemented a standalone background process (`src/features/listener/`, run via `npm run listener`) independent from the Express API. `ListenerService` connects to Optimism Sepolia (WebSocket preferred via `WS_RPC_URL`, HTTP `JsonRpcProvider` fallback), and on startup replays all historical `TicketMinted`/`TicketTransferred`/`TicketUsed` logs from the persisted `SyncState.lastProcessedBlock` checkpoint (or `CONTRACT_DEPLOYMENT_BLOCK` on a fresh database) up to the current chain head, in `LISTENER_BATCH_SIZE`-sized block ranges, sorted chronologically by `(blockNumber, logIndex)`. The checkpoint only advances after a batch fully succeeds, so a crash mid-batch safely retries that range on restart — all three handlers (`ticketMinted`, `ticketTransferred`, `ticketUsed`) are idempotent (keyed off `mintTxHash` / `Transaction.txHash` / existing `isUsed` state) to make replay safe. After catch-up, it subscribes to the same three events live via `contract.on(...)`, throttling `SyncState` writes to once per 30s while never regressing the checkpoint. `TicketTransferred` handling is interoperable with the BE-07 resale API: a transfer whose `txHash` already has a `type: 'resell'` Transaction (written synchronously by `POST /api/tickets/resell/purchase`) is recognized as already-synchronized and skipped rather than overwritten with `type: 'transfer'`. Added `'redeem'` to `Transaction.type` and `TicketUsed` to `EVENT_TICKET_NFT_ABI` (both previously absent since no code needed them yet). New env vars: `WS_RPC_URL` (optional), `CONTRACT_DEPLOYMENT_BLOCK` (required), `LISTENER_BATCH_SIZE`, `LISTENER_CHECKPOINT_INTERVAL`. Operational runbook at `backend/README-LISTENER.md`. 334 backend tests passing across 35 suites (58 new tests added for this task, plus a `multer` dependency gap fixed via `npm install` that was blocking 6 pre-existing suites from running at all).

---

## ⏳ What Needs to be Done Next

### **Phase 2: Backend API & Event Listener (`backend/`) — IN PROGRESS**
- [x] Initialize Express + TypeScript project & MongoDB Mongoose connection.
- [x] Implement database models (`User`, `Event`, `Ticket`, `Transaction`, `SyncState`).
- [x] Implement Thirdweb Embedded Wallet authentication & JWT middleware.
- [x] Implement IPFS / Pinata metadata upload service.
- [x] Implement Event Management APIs (`POST /api/events`, `GET /api/events`, `GET /api/events/:id`).
- [x] Implement Ticket Purchase & Relayer Minting service with retry logic.
- [x] Implement Ticket Resale API & Marketplace Lifecycle.
- [x] Implement Dynamic 30s QR Verification Engine (`POST /api/tickets/verify`).
- [x] Implement Blockchain Event Listener & catch-up block sync engine.

---

### **Phase 3: Frontend Application (`frontend/`) — IN PROGRESS (UI Suite Ready)**
- [x] Initialize Next.js app with TailwindCSS, Lucide icons & Framer Motion design system.
- [x] Implement Shell Layout & Navigation (Navbar with Role Switcher & Wallet Preview, Footer).
- [x] Implement Buyer UI (Homepage catalog, Event detail, Purchase modal, My Tickets gallery).
- [x] Implement Dynamic QR Code Generator (30s ticker, countdown bar, rotating nonce).
- [x] Implement Organizer UI (4-step Event creation wizard & Mobile QR scanner interface).
- [x] Implement Admin Monitoring Dashboard & System Audit Log.
- [ ] Integrate Thirdweb Web3 SDK & REST API hooks with Backend endpoints (`/api/*`).

---

### **Phase 4: DevOps, Infrastructure & Testing (`devops/`) — FINAL**
- [ ] Docker containerization (`docker-compose.yml`).
- [ ] GitHub Actions CI/CD setup.
- [ ] End-to-end integration test execution.
