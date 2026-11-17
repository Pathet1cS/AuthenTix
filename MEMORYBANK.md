# Project Memory Bank (`MEMORYBANK.md`)

> **Application:** Web3 Decentralized E-Ticketing Platform (AuthenTix)  
> **Current Phase:** Phase 2 — Backend API & Event Listener (`backend/`)  
> **Last Updated:** 2026-11-17

---

## 🎯 Current Status / Active Task

- **Open audit findings:** a whole-repo audit on 2026-11-16 found 8 must-fix and 11 smaller issues (AUDIT-08 fixed 2026-11-17). See **🔍 Audit Findings** below. Fix AUDIT-01 to AUDIT-07 next. BE-09 and BE-10 were merged first, so some audit file/line references may have shifted.
- **Focus:** Phase 2 - Backend API (`backend/`) — **IN PROGRESS**
- **Status:** TASK-BE-01 through TASK-BE-10 completed (Server Setup, Database Models, Authentication, IPFS Metadata Upload, Event Management API, Ticket Purchase & Relayer Minting, Ticket Resale API & User Ticket Lifecycle, Dynamic QR Verification Engine, Blockchain Event Listener & Recovery Engine, Rate Limiting & Security Hardening via `app.ts` middleware). 336 backend tests passing across 34 suites.
- **Next Focus:** TASK-FE-02 done; wire frontend pages to the backend API (replace `lib/mockData.ts`, send the JWT), then TASK-DO-01..03. Open backend items: audit fixes (AUDIT-01 to AUDIT-07), direct-transfer gap and mint race (see "Known Gaps" below).

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

- [x] **TASK-BE-10: Rate Limiting & Security Hardening (PR #13):** Global `express-rate-limit` (100 req/min/IP, `limit` option, standard `RateLimit-*` headers, JSON error body) mounted after Helmet/CORS/`express.json()`. Review fixes: import hoisted to top of `app.ts`, deprecated `max` renamed to `limit`. Note: `trust proxy` is NOT set; behind a reverse proxy/Docker ingress add `app.set('trust proxy', 1)` or all clients share one IP and one limit.
- [x] **TASK-BE-09 review fixes (PR #12 follow-up):** (1) fresh DB catch-up now starts AT `CONTRACT_DEPLOYMENT_BLOCK` (previously skipped it); (2) catch-up runs a second time after subscribing, closing the gap for blocks mined during the first pass; (3) the live checkpoint is held below the lowest failed block and written with `$max`, so a restart retries failed events and the checkpoint never moves backwards; (4) removed a duplicate `TicketUsed` ABI line left by the BE-08 overlap.
- [x] **Local-chain E2E suite (branch `feature/e2e-local-chain`):** `npm run test:e2e` in `backend/` (config `backend/e2e/jest.e2e.config.js`, separate from `npm test`). Spawns a Hardhat node (port 8546, `contracts/` artifacts must be compiled), deploys `EventTicketNFT`, uses in-memory MongoDB, real Express app + `ListenerService`; only Pinata (`@/shared/utils/ipfs`) is mocked and JWTs are minted directly. Covers: event create -> on-chain register, purchase (no double quota decrement), resale list+buy, QR verify -> `markUsed`, and listener stop/restart recovery (only missing blocks queried, checkpoint = head). 6/6 passing.
  - **Bug found & fixed (listener):** live `contract.on` callbacks receive a `ContractEventPayload` (the log is at `payload.log`), not an `EventLog`. The listener read `transactionHash`/`blockNumber` from the wrong object, so live events had an undefined `txHash` ("txHash required" on transfers, double quota decrement on mints). Mocked unit tests hid this because their fakes used the wrong shape; fakes now pass `{ log }`.
  - **Bug found & fixed (listener):** `stop()` on the HTTP provider surfaced an unhandled "cancelled request (eth_newFilter)" from `destroy()`. It now calls `provider.removeAllListeners()`, waits 100ms, and wraps `destroy()` in try/catch.
  - **Test gotchas:** `provider.getBlockNumber()` is cached by ethers after `tx.wait()`; use raw `eth_blockNumber` for chain-head asserts. `POST /api/tickets/resell` returns 200 (not 201). Backend tests need a local `.env` (gitignored; copy values from `.env.example` with `JWT_SECRET` >= 32 chars) or env suites exit with "Missing or invalid environment variables".
- [x] **TASK-FE-02: Thirdweb In-App Wallet Login:** `thirdweb` 5.122 in `frontend/`. Navbar's fake wallet and role-preview switcher replaced by `WalletButton` (Thirdweb `ConnectButton`, email + Google in-app wallet, Optimism Sepolia) plus a real role badge. `AuthProvider` (wraps `ThirdwebProvider` in `layout.tsx`, exposes `useAuth()`) reuses a stored JWT if it is unexpired and matches the connected address; otherwise it signs the backend login payload (`src/lib/auth/loginPayload.ts` mirrors `serializeLoginPayload` key order; `name` = email local part) and calls `POST /api/auth/login`. JWT lives in `localStorage['authentix.jwt']`; on any login error the token is cleared, the wallet disconnected and the backend message shown. Env: `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `NEXT_PUBLIC_API_URL` (see `frontend/.env.example`); backend `AUTH_DOMAIN` must equal the frontend host (e.g. `localhost:3000`). Frontend unit tests: `npm test` (Node built-in runner with `--experimental-strip-types`; files in `src/lib/auth/` use relative `.ts` imports). Build gotcha: `ConnectButton` pulls `@coinbase/cdp-sdk`, whose optional `@x402/*` peers Turbopack cannot resolve — aliased to `src/lib/optionalPeerStub.js` in `next.config.ts` (Turbopack only). Pages still use mock data. Open follow-ups for API wiring: read the JWT via `useAuth().session?.token` (never `loadToken()` — a token can outlive a failed Thirdweb auto-connect); session expiry is only re-checked on wallet change (add a timer); in-app wallet login needs a secure context (`localhost` or HTTPS — a phone demo over `http://<LAN-IP>` fails); real sign-in (incl. Google `getUserEmail`) not yet verified with a live client ID.

### Known Gaps (found by E2E, NOT yet fixed)
- **Direct wallet-to-wallet transfers are invisible to the listener:** `EventTicketNFT` emits `TicketTransferred` only on mint and `buyResoldTicket`; a plain ERC721 `transferFrom` emits only the standard `Transfer`, so MongoDB keeps the old `ownerWallet`. `/api/tickets/verify` is unaffected (it reads `ownerOf` on-chain). Fix options: listen to ERC721 `Transfer`, or override `_update` in the contract to emit `TicketTransferred`.
- **Possible purchase/listener race:** both `purchaseTicketService` and the listener's mint handler decrement `remainingQuota`; the only guard is "ticket already exists with same `mintTxHash`". If the listener sees the mint before the API's `Ticket.create`, quota is decremented twice and the API's create can fail (surfacing as a failed mint). Not triggered in the E2E run (timing dependent). Prefer a single owner of the quota decrement.
- **`LISTENER_CHECKPOINT_INTERVAL` is unused:** defined in env (documented as blocks) but the service hardcodes a 30s checkpoint throttle.
- **Not covered:** WebSocket provider path, reorg handling, live Optimism Sepolia RPC. Mint handler is non-atomic (a crash between ticket upsert and quota decrement skips the decrement on retry).

---

## 🔍 Audit Findings (2026-11-16) — all OPEN

Whole-repo audit at commit `da46902`. Found by reading the code; nothing below is fixed yet. All 336 backend tests and 13 contract tests pass, because no test covers these cases. Each fix needs one test that fails without it. Mark an item `[x]` when it is fixed and tested.

**Order of work:**
- AUDIT-02, AUDIT-10 and AUDIT-15 change the contract. Do them together: one redeploy, then update `CONTRACT_ADDRESS`.
- AUDIT-16 first, then AUDIT-03 goes into the new shared helper (one place, not three).
- AUDIT-06 before AUDIT-05: both touch how `BlockchainService` sends transactions.
- The rest are independent.

### Must fix

- [ ] **AUDIT-01 — Tickets are free and unlimited.** `backend/src/features/tickets/tickets.service.ts` `purchaseTicketService` (L16-58).
  - Problem: no payment step (PRD FR-04 step 2 "Payment succeeds") and no limit per wallet. A logged-in user can loop `POST /api/tickets/purchase`, take every seat for free and burn relayer gas.
  - Fix: before the quota decrement, count `Ticket` rows for `{ eventId, ownerWallet }` and reject above a small limit with 400. Real payment is a product decision for the human owner: ask before building it. Until then, document that payment is simulated.

- [ ] **AUDIT-02 — Resale price cap can be bypassed by a direct transfer.** `contracts/src/EventTicketNFT.sol`.
  - Problem: standard ERC-721 `transferFrom` / `safeTransferFrom` are open, so a scalper takes payment off-platform and transfers the ticket, skipping `maxResalePrice` and `saleDeadline` (breaks PRD FR-06).
  - Fix (OpenZeppelin 5.6.1 is installed): override `_update(address to, uint256 tokenId, address auth)` with `require(auth == address(0), "Use marketplace"); return super._update(to, tokenId, auth);`. `_safeMint` and the internal `_transfer` used by `buyResoldTicket` pass `address(0)`; public transfers pass the caller. Add a test: direct `transferFrom` by the owner reverts; mint and `buyResoldTicket` still work.

- [ ] **AUDIT-03 — Resale endpoints accept event logs from any contract.** `backend/src/shared/services/blockchain.service.ts` L170-300 (`verifyListingCreatedOnChain`, `verifyListingCancelledOnChain`, `verifyListingSoldOnChain`).
  - Problem: logs are parsed by topic only; `log.address` is never checked. An attacker deploys a contract that emits `ListingSold(tokenId, x, attacker, price)`, sends that tx hash to `POST /api/tickets/resell/purchase`, and MongoDB makes them the owner of a listed ticket. The gate check uses on-chain `ownerOf`, so entry is safe, but the database is corrupted.
  - Fix: skip any log where `log.address.toLowerCase() !== env.CONTRACT_ADDRESS.toLowerCase()`. Test: a receipt with a matching event from another address is rejected.

- [ ] **AUDIT-04 — An old sale tx hash can be sent again.** `tickets.service.ts` `fulfillResalePurchaseService` (L311-344) and `createResaleListingService` (L228-247).
  - Problem: the ticket is updated before `Transaction.create` (unique `txHash`). A sells to B, B sells to C, C relists; B re-sends the first sale hash and MongoDB gives the ticket back to B. The duplicate-key error comes after the damage and returns 500.
  - Fix: call `Transaction.create` first; map a duplicate key (`isDuplicateKeyError` in `shared/utils/mongoErrors.ts`) to a 409; then update the ticket. If the ticket update then finds nothing, delete the Transaction row just written.

- [ ] **AUDIT-05 — A retry can mint two tickets for one purchase.** `tickets.service.ts` L61-70 with `blockchain.service.ts` `mintTicketOnChain` (L92-104). Same shape in `events.service.ts` L75-82 with `registerEventOnChain`.
  - Problem: `withRetry` wraps "send transaction + `tx.wait(1)`". If the send works but the wait throws (RPC blip), the retry sends a second mint. Buyer gets two NFTs, MongoDB records one, and on-chain `mintedSupply` runs ahead of `remainingQuota`. For events, the retry reverts with "Event ID already exists" and the event stays `draft`.
  - Fix: retry only the send; call `tx.wait(1)` once, outside the retry. If the wait fails, the outcome is unknown: record `PENDING_MINT` with the real `tx.hash` (see AUDIT-09), do not mint again.

- [ ] **AUDIT-06 — Concurrent requests collide on the relayer nonce.** `blockchain.service.ts` `contract` getter (L60-67).
  - Problem: every mint and every `markUsed` is sent from one wallet. Two requests at once read the same pending nonce and one is rejected. PRD asks for 500 concurrent scans; three retries are not enough, so scans return 502 and purchases end as `PENDING_MINT`.
  - Fix: wrap the wallet: `new ethers.NonceManager(wallet)` (ethers 6.17 is installed). `NonceManager` increments before the send, so call `.reset()` when a send throws, or one failed send leaves a nonce gap that blocks every later transaction. Add a `// shortcut:` comment: this is per-process, so it only holds with one backend instance.

- [ ] **AUDIT-07 — Tickets are minted with a bare CID as `tokenURI`.** `tickets.service.ts` L66 (`metadataURI: event.metadataCID`) and L77 (`tokenURI`).
  - Problem: the value is `bafy...` with no `ipfs://`, so wallets and explorers cannot load the metadata, and it cannot be changed after mint.
  - Fix: use the existing `toIpfsUri()` from `shared/utils/ipfs.ts` in both places. Must be done before any real mint.

- [x] **AUDIT-08 — The built server cannot start.** FIXED 2026-11-17: `tsc-alias` added, `"build": "tsc && tsc-alias"`; verified `node dist/server.js` loads all modules (stops only at the missing MongoDB). `backend/package.json` L8 (`"build": "tsc"`), `backend/Dockerfile` L15-24.
  - Problem: `tsc` does not rewrite the `@/` path alias. Verified: the emitted `dist/server.js` contains `require("@/shared/db/connect")`, which Node cannot resolve. Only `npm run dev` (tsx) works.
  - Fix: add `tsc-alias` as a dev dependency and set `"build": "tsc && tsc-alias"`. Check with `npm run build && node dist/server.js`.

### Should fix

- [ ] **AUDIT-09 — Failed mints lose the seat and cannot be recovered.** `tickets.service.ts` L100-128.
  - Problem: the catch block never restores `remainingQuota` or the `soldout` status; the `PENDING_MINT` row has no event ID and a random fake hash; a MongoDB error after a successful mint lands in the same branch and is logged as "not minted".
  - Fix: add `eventId` to the `Transaction` model and store it. Store the real `tx.hash` when one exists. When nothing was sent, give the seat back (`$inc: { remainingQuota: 1 }`, status back to `active`). TASK-BE-09's recovery engine needs these fields.

- [ ] **AUDIT-10 — Relayer has no `ORGANIZER_ROLE`.** `EventTicketNFT.sol` constructor (L94-96), `contracts/scripts/deploy.ts` L15-22.
  - Problem: the backend relayer calls `createEvent` (needs `ORGANIZER_ROLE`), but the constructor grants that role only to the admin. It works today only because both addresses default to the deployer, which makes the server's hot key the contract admin.
  - Fix: add `_grantRole(ORGANIZER_ROLE, minterRelayer);` in the constructor. Then deploy with separate `ADMIN_ADDRESS` and `MINTER_RELAYER_ADDRESS`.

- [ ] **AUDIT-11 — Event search runs user text as a regex.** `backend/src/features/events/events.service.ts` L122-125.
  - Problem: `GET /api/events?search=(` throws inside `new RegExp` and returns 500; a crafted pattern burns MongoDB CPU; length is unlimited. Public endpoint.
  - Fix: escape first: `query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. Add `.max(100)` to `search` in `events.schema.ts`.

- [ ] **AUDIT-12 — A past sale deadline fails late.** `events.schema.ts` L18-35, `events.service.ts` L55-94.
  - Problem: the schema allows `saleDeadline` in the past. The poster is pinned (permanent, billed), a `draft` row is saved, the contract reverts three times, and the user gets a 500.
  - Fix: add `.refine((d) => d.saleDeadline > new Date(), ...)` to `createEventBodySchema`.

- [ ] **AUDIT-13 — Used tickets stay on the marketplace.** `tickets.service.ts` `getResaleMarketplaceService` (L359).
  - Problem: redeeming a listed ticket cancels the listing on-chain (`markUsed`) but MongoDB keeps `isListed: true`.
  - Fix: filter with `{ isListed: true, isUsed: false }`.

- [ ] **AUDIT-14 — Two organizer pages cannot load images.** `frontend/next.config.ts`, `frontend/src/app/organizer/dashboard/page.tsx` L340, `frontend/src/app/organizer/events/new/page.tsx` L501 and L561.
  - Problem: `next/image` is used with `images.unsplash.com`, which is not allowed in the config. Next's loader throws "hostname is not configured". Other pages use plain `<img>` and work.
  - Fix: add `images: { remotePatterns: [{ hostname: 'images.unsplash.com' }] }` to `next.config.ts`. Read `frontend/AGENTS.md` first: this Next.js version differs from older ones.

- [ ] **AUDIT-15 — Contract resale path is thinly tested.** `contracts/test/EventTicketNFT.test.ts`.
  - Missing tests: direct transfer reverts (AUDIT-02), sale after `saleDeadline` reverts, `cancelListing`, refund of an overpayment in `buyResoldTicket`.

- [ ] **AUDIT-16 — Three near-copies of the receipt check.** `blockchain.service.ts` L170-300.
  - Fix: one private helper that takes the tx hash, the event name and a match function, fetches the receipt, checks `status === 1`, checks `log.address` (AUDIT-03) and returns the parsed args. Keep the three public methods as thin callers so `tickets.service.ts` and its tests do not change. Keep the price-mismatch 400 in `verifyListingCreatedOnChain`.

- [ ] **AUDIT-17 — Unused code to delete** (each was checked with a whole-tree search):
  - `frontend/src/lib/mockData.ts`: `MOCK_TRANSACTIONS`, `MOCK_ANALYTICS`, `TransactionItem`, `CheckInRecord`, `OrganizerAnalytics`.
  - `frontend/src/components/ui/Card.tsx`: `CardHeader`, `CardTitle`, `CardDescription`, `CardFooter`.
  - `THIRDWEB_CLIENT_ID` in `backend/src/config/env.schema.ts`, `.env.example`, `.env.docker` and `env.schema.test.ts`: required at startup, read nowhere.
  - The `resaleListings` line in `EVENT_TICKET_NFT_ABI`.
  - The try/catch in `events.service.ts` L70-94 that only rethrows.
  - Page/limit defaults in `tickets.service.ts` L153-154 and L373-374 (zod already sets them).
  - The six `.gitkeep` files under `backend/src/` (the folders have files).

### Nice to have

- [ ] **AUDIT-18 — Oversized poster returns 500.** `events.routes.ts` L11-13, `shared/middleware/errorHandler.ts`. Multer's error has no `statusCode`. Fix: in `errorHandler`, map `err.name === 'MulterError'` to 400.
- [ ] **AUDIT-19 — Bad `eventId` filter returns 500.** `tickets.validation.ts` L25. Fix: validate with the 24-hex regex already used by `purchaseSchema`.

### Full test pass (2026-11-17, after pulling BE-09/BE-10)
- Contracts 13/13, backend 370/370 (38 suites, passes with no `.env`), `tsc --noEmit` clean, frontend `next build` passes.
- Fixed: `listener.service.test.ts` now mocks `@/config/env` (it used the real `env.ts`, which calls `process.exit(1)` without a `.env` and aborted the whole Jest run; one test also depended on `CONTRACT_DEPLOYMENT_BLOCK` being large).
- **Deferred, not fixed — frontend lint errors (3):** `npm run lint` fails with 3 errors and 53 warnings (mostly unused imports and `<img>`, overlaps AUDIT-17).
  - `no-explicit-any` at `frontend/src/app/organizer/events/new/page.tsx:141` and `frontend/src/app/page.tsx:256`: replace `any` with a real type.
  - setState called synchronously inside an effect at `frontend/src/components/tickets/DynamicQRModal.tsx:72`: needs a restructure of the effect. Riskier, because it touches the 30s QR countdown, so review the modal first.
- Not tested: nothing ran against real Optimism Sepolia, Thirdweb or Pinata. AUDIT-14 (`next/image` host) not reproduced.

### Seen, not written up
- Any organizer can redeem tickets of another organizer's event (`verifyTicketService` does not check the event's `organizerId`).
- Events never move to `ended`.
- Prices below 1e-7 ETH make `ethers.parseEther(price.toString())` throw (number prints as `1e-7`).
- MongoDB has no password in `docker-compose.yml` (dev only).
- `GET /api/events/:id` returns `draft` events to anyone.
- Rate limiting was added in TASK-BE-10 (not re-audited).

---

## ⏳ What Needs to be Done Next

### **Phase 2: Backend API & Event Listener (`backend/`) — IN PROGRESS**
- [ ] Fix audit findings AUDIT-01 to AUDIT-07 (AUDIT-08 done; see **🔍 Audit Findings** above).
- [x] Initialize Express + TypeScript project & MongoDB Mongoose connection.
- [x] Implement database models (`User`, `Event`, `Ticket`, `Transaction`, `SyncState`).
- [x] Implement Thirdweb Embedded Wallet authentication & JWT middleware.
- [x] Implement IPFS / Pinata metadata upload service.
- [x] Implement Event Management APIs (`POST /api/events`, `GET /api/events`, `GET /api/events/:id`).
- [x] Implement Ticket Purchase & Relayer Minting service with retry logic.
- [x] Implement Ticket Resale API & Marketplace Lifecycle.
- [x] Implement Dynamic 30s QR Verification Engine (`POST /api/tickets/verify`).
- [x] Implement Blockchain Event Listener & catch-up block sync engine.
- [x] Implement Rate Limiting & Security Hardening.
- [x] Local-chain end-to-end test suite (Hardhat).

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
