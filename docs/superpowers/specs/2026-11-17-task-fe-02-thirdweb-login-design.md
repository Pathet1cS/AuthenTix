# TASK-FE-02: Thirdweb In-App Wallet Login — Design

**Date:** 2026-11-17 · **Size:** small change · **Branch:** `feature/fe-02-thirdweb-login`

## Intent
Replace the fake wallet toggle in the Navbar with a real Thirdweb in-app wallet (email + Google, Optimism Sepolia), exchange a signed login payload for the backend JWT, and keep that session in the frontend. This is the foundation the later "wire pages to the API" task builds on.

## Goals
- Users sign in with email (OTP) or Google; no raw private keys.
- After the wallet connects, the frontend obtains a JWT from `POST /api/auth/login` and keeps it.
- Navbar shows the real wallet address and the real role from the JWT.
- Logout disconnects the wallet and clears the JWT.

## Non-goals
- Replacing mock data in pages (events, purchase, my-tickets) with API calls — next task.
- Route guards for organizer/admin pages.
- Backend changes.

## Anti-goals
- A session where the wallet looks connected but no valid JWT exists (or vice versa) without the UI showing it.
- Building a payload the backend rejects because key order or fields drift from `serializeLoginPayload`.

## Approaches
1. **Thirdweb `ConnectButton` (in-app wallet) + our own login exchange — chosen.** Least code; Thirdweb owns OTP, OAuth and wallet session. Modal is Thirdweb's, themed dark.
2. Custom sign-in UI on Thirdweb's lower-level hooks. Full design control, ~3–4x code and error states we own. Not worth it for now.
3. `ConnectButton`'s built-in `auth` (SIWE). Rejected: signs Thirdweb's message format, backend expects its own JSON string.

## Design
- **Dependency:** `thirdweb` (v5) in `frontend/`.
- **Config:** `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (+ `.env.example`). Chain `optimismSepolia` from `thirdweb/chains`.
- **Provider:** `ThirdwebProvider` wrapping the app in `layout.tsx` (client component boundary).
- **Navbar:** the fake wallet button becomes `ConnectButton` with `inAppWallet({ auth: { options: ['email', 'google'] } })`, dark theme, on desktop and mobile.
- **Login exchange (on wallet connect, when no valid JWT for that address):**
  - payload `{domain: window.location.host, statement: 'Sign in to AuthenTix', address, email, name, nonce: random, issuedAt: now, expiresAt: now+5min}`, serialised in exactly the backend key order.
  - `email` from Thirdweb's `getUserEmail`; `name` = email local part.
  - `account.signMessage(serialised)` → `POST /api/auth/login {payload, signature}` → store JWT.
- **Session:** JWT in `localStorage`; role/expiry decoded from it client-side (display only — backend stays the authority). Cleared on logout, on expiry, or when the connected address differs from the token's.
- **Role in Navbar:** real role badge from the JWT replaces the role-preview switcher.
- **Errors:** login failure shows a short message and leaves the user signed out of the backend (wallet disconnected), with a retry by connecting again.

## Constraints
- Backend `AUTH_DOMAIN` must equal the frontend host (e.g. `localhost:3000`) or login 401s — documented in `.env.example`.
- Frontend's Next.js version differs from training data: read `node_modules/next/dist/docs/` before writing code.

## Left to the builder
File layout under `src/lib/` / `src/components/auth/`, hook vs context for session state, exact Thirdweb theme values, test approach for the payload serialiser and token helpers.
