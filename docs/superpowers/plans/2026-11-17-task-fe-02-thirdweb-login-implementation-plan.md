# TASK-FE-02 Thirdweb Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Thirdweb in-app wallet sign-in (email + Google, Optimism Sepolia) in the Navbar, exchanged for the backend JWT and kept as the frontend session.

**Architecture:** Pure, dependency-free helpers in `frontend/src/lib/auth/` (payload building, JWT decoding/storage, backend exchange) carry all logic and are unit-tested with Node's built-in test runner. A client `AuthProvider` wraps `ThirdwebProvider`, watches the active account, and runs the exchange; the Navbar renders Thirdweb's `ConnectButton` plus a role badge from `useAuth()`.

**Tech Stack:** Next.js 16.3 (App Router), React 19, `thirdweb` v5, Node 22 `node --test --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-17-task-fe-02-thirdweb-login-design.md`

## Global Constraints

- Signed string must equal backend `serializeLoginPayload` (`backend/src/features/auth/auth.schema.ts:59`): `JSON.stringify` with keys in order `domain, statement, address, email, name, nonce, issuedAt, expiresAt`.
- `statement` = `'Sign in to AuthenTix'`; `domain` = `window.location.host`; validity window = 5 minutes (backend max `5 * 60 * 1000`).
- Backend limits: `name` 1–100 chars, `nonce` ≤ 128 chars, `issuedAt`/`expiresAt` ISO 8601 (`toISOString()`).
- Backend response shape: `{ success: true, data: { userId, walletAddress, token } }` / `{ success: false, error: string }`.
- JWT claims: `sub`, `walletAddress` (lowercase), `role: 'buyer' | 'organizer' | 'admin'`, `exp` (seconds). Decoded client-side for display only.
- Env: `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:5000`). Backend `AUTH_DOMAIN` must equal the frontend host.
- No backend changes. Pages keep mock data. No new runtime deps besides `thirdweb`; no test-framework dep.
- Before writing React/Next code, read `frontend/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` ("Context providers": provider is a `'use client'` component rendered from `layout.tsx`).
- Files under `src/lib/auth/` use relative imports with `.ts` extensions and `import type` for type-only imports (required by Node strip-types); no `@/` alias there.

## Review Focus

1. **Page reload with a still-valid token** — user must not be asked to sign again. Pinned by `isSessionValidFor` tests (Task 1) and the provider's "stored token first" order (Task 3).
2. **Token expired** — next connect re-runs the exchange instead of using a dead token. Pinned by the expired-token test (Task 1).
3. **Different wallet connects than the stored token's** (incl. checksum vs lowercase address) — stored token not reused for another address, but same address in different case *is* reused. Pinned in Task 1.
4. **Corrupt / foreign value in localStorage, or storage throws (private mode)** — treated as signed out, no crash. Pinned by `decodeSession('garbage')` and storage try/catch (Task 1).
5. **Backend rejects login (wrong `AUTH_DOMAIN`, 409 email taken, 429 rate limit, backend down)** — user sees the backend's message (or a network message), wallet is disconnected, no token stored. Pinned by `exchangeLogin` error tests (Task 2) and provider error path (Task 3).

---

### Task 1: Test runner + payload and session helpers

**Files:**
- Modify: `frontend/package.json` (add script), `frontend/tsconfig.json` (add `"allowImportingTsExtensions": true` — valid because `noEmit` is already true)
- Create: `frontend/src/lib/auth/loginPayload.ts`, `frontend/src/lib/auth/session.ts`
- Test: `frontend/src/lib/auth/loginPayload.test.ts`, `frontend/src/lib/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `type LoginPayload = { domain; statement; address; email; name; nonce; issuedAt; expiresAt }` (all `string`)
  - `LOGIN_STATEMENT = 'Sign in to AuthenTix'`
  - `nameFromEmail(email: string): string` — local part before `@`, sliced to 100 chars; falls back to `'AuthenTix User'` if empty.
  - `buildLoginPayload(args: { address: string; email: string; domain: string; nonce: string; now: Date }): LoginPayload` — `expiresAt = now + 5 min`.
  - `serializeLoginPayload(p: LoginPayload): string` — fixed key order (Global Constraints).
  - `type Role = 'buyer' | 'organizer' | 'admin'`; `type Session = { token: string; userId: string; walletAddress: string; role: Role; expiresAt: number /* ms */ }`
  - `decodeSession(token: string): Session | null` — base64url-decode the middle segment (`-`→`+`, `_`→`/`, pad, `atob`, `JSON.parse`); return `null` on any error or missing `sub`/`walletAddress`/`role`/`exp`.
  - `isSessionValidFor(s: Session | null, address: string, nowMs: number): boolean` — non-null, `expiresAt > nowMs`, addresses equal case-insensitively.
  - `loadToken(): string | null`, `saveToken(t: string): void`, `clearToken(): void` — `localStorage` key `'authentix.jwt'`, every access in try/catch (read failure → `null`, write failure ignored).

- [ ] **Step 1: Add the test script** — `"test": "node --test --experimental-strip-types \"src/**/*.test.ts\""` in `frontend/package.json`; add `allowImportingTsExtensions` to tsconfig.

- [ ] **Step 2: Write failing tests** (`node:test` + `node:assert/strict`)

```ts
// loginPayload.test.ts
test('serializeLoginPayload uses backend key order', () => {
  const p = buildLoginPayload({ address: '0xAbC0000000000000000000000000000000000001', email: 'radja@x.io',
    domain: 'localhost:3000', nonce: 'n-1', now: new Date('2026-11-17T00:00:00.000Z') });
  assert.equal(serializeLoginPayload(p),
    '{"domain":"localhost:3000","statement":"Sign in to AuthenTix","address":"0xAbC0000000000000000000000000000000000001","email":"radja@x.io","name":"radja","nonce":"n-1","issuedAt":"2026-11-17T00:00:00.000Z","expiresAt":"2026-11-17T00:05:00.000Z"}');
});
test('nameFromEmail caps at 100 and falls back when empty', () => {
  assert.equal(nameFromEmail('a'.repeat(150) + '@x.io').length, 100);
  assert.equal(nameFromEmail('@x.io'), 'AuthenTix User');
});

// session.test.ts — build tokens with a helper:
// fakeJwt(claims) = 'h.' + base64url(JSON.stringify(claims)) + '.s'
const claims = { sub: 'u1', walletAddress: '0xabc0000000000000000000000000000000000001', role: 'organizer', exp: 2_000_000_000 };
test('decodeSession reads claims', () => assert.deepEqual(decodeSession(fakeJwt(claims)),
  { token: fakeJwt(claims), userId: 'u1', walletAddress: claims.walletAddress, role: 'organizer', expiresAt: 2_000_000_000_000 }));
test('decodeSession handles base64url chars', ...); // claims whose JSON encodes to '-' or '_' (e.g. name '??>>' in an extra field)
test('decodeSession returns null for garbage', () => { assert.equal(decodeSession('garbage'), null); assert.equal(decodeSession('a.b.c'), null); });
test('decodeSession returns null when role missing', ...);
test('valid for same address in different case', () =>
  assert.equal(isSessionValidFor(decodeSession(fakeJwt(claims)), '0xABC0000000000000000000000000000000000001', 0), true));
test('invalid for other address', ...);   // '0x...0002' → false
test('invalid when expired', ...);         // nowMs = 2_000_000_000_000 → false
test('invalid for null', ...);
```

- [ ] **Step 3: Run** `cd frontend; npm test` — Expected: FAIL (modules not found).
- [ ] **Step 4: Implement** both modules per Interfaces.
- [ ] **Step 5: Run** `npm test` → all pass; `npx tsc --noEmit` → exit 0.
- [ ] **Step 6: Commit** `feat(frontend): login payload and session helpers (TASK-FE-02)`

---

### Task 2: Backend login exchange

**Files:**
- Create: `frontend/src/lib/auth/exchangeLogin.ts`
- Test: `frontend/src/lib/auth/exchangeLogin.test.ts`

**Interfaces:**
- Consumes: `buildLoginPayload`, `serializeLoginPayload` (Task 1).
- Produces: `exchangeLogin(args: { account: { address: string; signMessage(o: { message: string }): Promise<string> }; email: string; domain: string; apiUrl: string; fetchFn?: typeof fetch; now?: Date; nonce?: string }): Promise<string>` — returns the JWT. Defaults: `fetchFn = fetch`, `now = new Date()`, `nonce = crypto.randomUUID()`. POSTs JSON `{ payload, signature }` to `${apiUrl}/api/auth/login`. On non-OK or `success !== true` throws `Error(body.error ?? 'Login failed (HTTP <status>)')`; on network failure throws `Error('Cannot reach the AuthenTix server')`.

- [ ] **Step 1: Write failing tests** with a fake account and fake `fetchFn`:
  - `signs the serialized payload and posts it` — assert `signMessage` received exactly `serializeLoginPayload(payload)`, URL is `http://api/api/auth/login`, method `POST`, header `Content-Type: application/json`, body `{ payload, signature: '0xsig' }`; returns `'jwt-1'` from `{ success: true, data: { token: 'jwt-1' } }`.
  - `surfaces backend error message` — fetch → status 401 `{ success: false, error: 'Invalid login domain' }` → rejects with message `'Invalid login domain'`.
  - `falls back to HTTP status when body has no error` — status 429, body not JSON → `'Login failed (HTTP 429)'`.
  - `reports network failure` — fetchFn throws `TypeError` → `'Cannot reach the AuthenTix server'`.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** `exchangeLogin`.
- [ ] **Step 4: Run** `npm test` → pass; `npx tsc --noEmit` → 0.
- [ ] **Step 5: Commit** `feat(frontend): exchange signed login payload for JWT (TASK-FE-02)`

---

### Task 3: Thirdweb setup and AuthProvider

**Files:**
- Modify: `frontend/package.json` (`npm install thirdweb`), `frontend/.gitignore` (add `!.env.example` after `.env*`), `frontend/src/app/layout.tsx` (wrap body content in `<AuthProvider>`)
- Create: `frontend/.env.example`, `frontend/src/lib/thirdweb.ts`, `frontend/src/components/auth/AuthProvider.tsx`

**Interfaces:**
- Consumes: Task 1 session helpers, Task 2 `exchangeLogin`.
- Produces:
  - `thirdweb.ts`: `client = createThirdwebClient({ clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID! })`, `chain = optimismSepolia` (`thirdweb/chains`), `wallets = [inAppWallet({ auth: { options: ['email', 'google'] } })]` (`thirdweb/wallets`).
  - `AuthProvider({ children })` — `'use client'`; renders `<ThirdwebProvider><AuthState>{children}</AuthState></ThirdwebProvider>`.
  - `useAuth(): { session: Session | null; status: 'signed-out' | 'signing-in' | 'signed-in'; error: string | null; logout(): void }`

- [ ] **Step 1: Install and verify API names** — `cd frontend; npm install thirdweb`. Confirm these exports exist in the installed version (grep `node_modules/thirdweb/dist/types/exports/*.d.ts`): `createThirdwebClient` (`thirdweb`), `optimismSepolia` (`thirdweb/chains`), `inAppWallet`, `getUserEmail` (`thirdweb/wallets`), `ThirdwebProvider`, `ConnectButton`, `useActiveAccount`, `useActiveWallet`, `useDisconnect` (`thirdweb/react`), and `ConnectButton` props `onDisconnect`, `theme`, `chain`, `wallets`. If a name differs, use the installed one and note it in the commit message.
- [ ] **Step 2: `.env.example`** with `NEXT_PUBLIC_THIRDWEB_CLIENT_ID=` and `NEXT_PUBLIC_API_URL=http://localhost:5000`, plus a comment: backend `AUTH_DOMAIN` must equal this app's host (e.g. `localhost:3000`). Check backend `PORT` default in `backend/src/config/env.schema.ts` and use it.
- [ ] **Step 3: Implement `thirdweb.ts` and `AuthProvider.tsx`.** `AuthState` logic, keyed on `account?.address`:
  1. No account → `session = null`, `status = 'signed-out'` (do not clear the stored token: auto-connect may not have resolved yet).
  2. Account → `decodeSession(loadToken())`; if `isSessionValidFor(s, account.address, Date.now())` → signed-in with it, no signing.
  3. Else `status = 'signing-in'`, `email = await getUserEmail({ client })`; missing email → error `'This wallet has no email; sign in with email or Google'`; else `exchangeLogin({ account, email, domain: window.location.host, apiUrl: process.env.NEXT_PUBLIC_API_URL! })` → `saveToken`, `decodeSession`, signed-in.
  4. Any error → `clearToken()`, set `error` message, disconnect the active wallet (`useDisconnect().disconnect(wallet)`), `status = 'signed-out'`.
  5. Ignore results of a run whose account changed meanwhile (cancelled flag in effect cleanup).
  - `logout()` → `clearToken()`, disconnect wallet, `session = null`, `error = null`.
- [ ] **Step 4: Wire `layout.tsx`** — `<AuthProvider>` wraps `<Navbar />`, `<main>`, `<Footer />` inside `<body>`; `layout.tsx` stays a Server Component.
- [ ] **Step 5: Verify** `npm test` → pass; `npx tsc --noEmit` → 0; `npm run build` → succeeds (needs `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` set in `.env.local`; any non-empty placeholder is fine for build).
- [ ] **Step 6: Commit** `feat(frontend): Thirdweb provider and auth session state (TASK-FE-02)`

---

### Task 4: Navbar wallet button and role badge

**Files:**
- Create: `frontend/src/components/auth/WalletButton.tsx`
- Modify: `frontend/src/components/layout/Navbar.tsx`, `MEMORYBANK.md`, `TODO.md`

**Interfaces:**
- Consumes: `client`, `chain`, `wallets` (Task 3), `useAuth()` (Task 3).
- Produces: `WalletButton()` — `<ConnectButton client chain wallets theme="dark" connectButton={{ label: 'Sign In' }} onDisconnect={logout} />`, then: when `status === 'signing-in'` a small "Signing in…" text; when `error` a one-line red message (`role="alert"`); when signed in a role badge (`Buyer`/`Organizer`/`Admin`) reusing the existing `rolesConfig` colours/icons (move `rolesConfig` here, keyed by backend role).

- [ ] **Step 1: Navbar** — delete `UserRole`, `activeRole`, role-menu state/dropdown, mobile "Role Preview" block, `isWalletConnected`, the hard-coded `walletAddress`, and both fake wallet buttons; render `<WalletButton />` in the desktop actions and the mobile drawer. Remove now-unused icon imports.
- [ ] **Step 2: Verify** `npx tsc --noEmit` → 0; `npm run lint` → no new errors; `npm run build` → succeeds.
- [ ] **Step 3: Manual check** (needs a real Thirdweb client ID with `localhost` allowed, backend running with `AUTH_DOMAIN=localhost:3000`): `npm run dev`, sign in with email OTP → badge shows `Buyer`, `localStorage['authentix.jwt']` set; reload → no second signature prompt; disconnect from the Thirdweb details modal → badge gone, key removed; stop backend and sign in → "Cannot reach the AuthenTix server", wallet disconnected. If no client ID is available, record that this step was not run.
- [ ] **Step 4: Docs** — `TODO.md`: tick TASK-FE-02. `MEMORYBANK.md`: add a TASK-FE-02 completed line (what was built, env vars, `AUTH_DOMAIN` requirement, `npm test` runner) and set Next Focus to wiring pages to the API.
- [ ] **Step 5: Commit** `feat(frontend): Thirdweb sign-in button and role badge in Navbar (TASK-FE-02)`
