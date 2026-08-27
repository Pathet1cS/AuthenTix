# Design Document: AuthenTix Frontend UI & Design System

> **Date:** 2026-08-19  
> **Status:** Approved for UI Implementation  
> **Scope:** Pure Presentational Frontend UI (Next.js 14 App Router + Tailwind CSS + Lucide Icons + Framer Motion)

---

## 1. Overview & Objectives

AuthenTix is a Web3 Decentralized E-Ticketing Platform built on Optimism Sepolia testnet with Thirdweb embedded wallets.  
This specification covers the initial **Frontend UI Phase**, focusing on building a high-fidelity, responsive, glassmorphic visual interface covering all user roles (Buyer, Organizer, Admin) with static/presentational mock data.

---

## 2. Design System & Visual Aesthetics

- **Color Palette (Dark Web3 Theme):**
  - Background: Obsidian Black (`#0B0F17` / `#111827`) with glowing ambient mesh gradients.
  - Primary Action / Verified: Neon Emerald to Cyan (`#10B981` → `#06B6D4`).
  - Web3 / Wallet Accents: Violet to Electric Blue (`#6366F1` → `#8B5CF6`).
  - Warning / Resale: Amber (`#F59E0B`).
  - Danger / Used: Crimson (`#EF4444`).
- **Surface & Cards:** Glassmorphism style (`backdrop-blur-lg bg-white/5 border border-white/10`) with subtle hover transitions and glow effects.
- **Typography:** Sans-serif font family (Inter / System default), crisp metadata hierarchy.
- **Icons & Motion:** `lucide-react` icons, `framer-motion` for page transitions, modal drop-ins, and 30-second QR ticker animations.

---

## 3. Component Architecture & Page Layouts

### 3.1 Global Shell (`app/layout.tsx` & `components/Navbar.tsx`)
- Navigation header with AuthenTix logo.
- Page navigation: **Explore Events**, **Resale Marketplace**, **My Tickets**, **Organizer Studio**, **Admin Dashboard**.
- Header widgets: Role indicator toggle and "Connect Wallet" button preview.

### 3.2 Buyer Portal Pages
1. **Homepage / Event Explorer (`app/page.tsx`):**
   - Hero banner with Web3 ticketing value proposition and quick platform stats.
   - Search bar and category filter pills (Concerts, Sports, Tech Conferences, Festivals).
   - Responsive grid of `EventCard` components showing poster, price, venue, and quota progress.
2. **Event Detail Page (`app/events/[id]/page.tsx`):**
   - Detailed view with event poster, organizer details, schedule, location map preview, ticket price, and resale cap rules.
   - "Buy Ticket" call-to-action button opening the purchase modal.
3. **Ticket Purchase Modal (`components/events/PurchaseTicketModal.tsx`):**
   - Summary of ticket pricing, gasless relayer indicator, and "Confirm Purchase" preview.
4. **My Tickets Gallery (`app/my-tickets/page.tsx`):**
   - Grid of owned NFT tickets with status badges (`ACTIVE`, `USED`, `RESALE`).
5. **Ticket Detail & Provenance (`app/my-tickets/[id]/page.tsx`):**
   - Individual ticket NFT showcase, metadata attributes, on-chain provenance timeline, and "Show Entry QR Code" button.
6. **Dynamic 30s QR Code Modal (`components/tickets/DynamicQRModal.tsx`):**
   - Display dynamic QR code with live 30-second visual progress timer bar, auto-refreshing ticker preview, and security warning notice.

### 3.3 Organizer Portal Pages
1. **Event Creation Form (`app/organizer/events/new/page.tsx`):**
   - Multi-section wizard form: Basic details, image poster dropzone upload preview, pricing & ticket supply, resale cap rule configuration.
2. **Organizer Dashboard (`app/organizer/dashboard/page.tsx`):**
   - Analytics cards (Total Revenue, Tickets Sold, Attendance Check-in Rate).
   - Event management list with status toggle (Draft / Live / Completed).
3. **Mobile Ticket Verification Scanner (`app/organizer/scanner/page.tsx`):**
   - Mobile-optimized QR scanner UI with camera viewfinder overlay, manual token ID fallback input, and animated verification feedback result cards (Success Green / Duplicate Red / Expired Yellow).

### 3.4 Admin Dashboard Page
1. **Platform Monitor (`app/admin/dashboard/page.tsx`):**
   - System health status cards (Optimism Sepolia node connection, MongoDB sync, Pinata IPFS gateway).
   - Recent transaction audit log table.

---

## 4. Verification & Testing Criteria

- Scaffolding completes cleanly with zero TypeScript / build errors (`npm run build`).
- Responsive layout verified across desktop (1280px+), tablet (768px), and mobile (375px) viewports.
- All pages render with high visual polish, correct color system tokens, and interactive Framer Motion states.
