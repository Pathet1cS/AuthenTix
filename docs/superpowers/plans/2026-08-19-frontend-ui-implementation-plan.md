# AuthenTix Frontend UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, responsive, glassmorphic Next.js 14 (App Router) frontend UI for the AuthenTix Web3 ticketing platform with high visual polish and static mock data covering all user roles (Buyer, Organizer, Admin).

**Architecture:** Next.js 14 App Router (`src/app/`) with Tailwind CSS dark theme tokens, `framer-motion` for micro-animations, `lucide-react` for icons, and modular presentation components.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Tailwind CSS 3, Framer Motion 11, Lucide React icons.

## Global Constraints

- Project Root: `R:\Tugas\Skripsuy\AuthenTix`
- Frontend App Directory: `R:\Tugas\Skripsuy\AuthenTix\frontend`
- Next.js Version: 14+ with App Router and `src/` directory layout
- Styling: Tailwind CSS with dark Obsidian theme (`#0B0F17`), glassmorphic panels (`backdrop-blur-lg bg-white/5 border border-white/10`), and custom accent gradients (Emerald/Cyan, Violet/Indigo)

---

### Task 1: Next.js 14 Scaffolding & Design System Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/src/app/globals.css`

- [ ] **Step 1: Scaffold Next.js 14 project**

Run:
```bash
npx -y create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install UI dependencies**

Run:
```bash
cd frontend && npm install lucide-react framer-motion clsx tailwind-merge
```

- [ ] **Step 3: Configure Tailwind CSS dark theme & glassmorphism utilities**

In `frontend/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: '#07090E',
          800: '#0B0F17',
          700: '#111827',
          600: '#1F2937',
        },
        accent: {
          emerald: '#10B981',
          cyan: '#06B6D4',
          violet: '#8B5CF6',
          indigo: '#6366F1',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
```

In `frontend/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #07090E;
  color: #F9FAFB;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow-x: hidden;
}

.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
}

.glass-card-hover {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-card-hover:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(16, 185, 129, 0.3);
  box-shadow: 0 10px 30px -10px rgba(16, 185, 129, 0.15);
  transform: translateY(-2px);
}
```

- [ ] **Step 4: Verify build setup**

Run: `npm run build` inside `frontend/`
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit**

Run: `git add frontend && git commit -m "feat(frontend): scaffold Next.js 14 app with Tailwind CSS & Framer Motion"`

---

### Task 2: Shell Layout & Navigation Components

**Files:**
- Create: `frontend/src/components/layout/Navbar.tsx`
- Create: `frontend/src/components/layout/Footer.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Create Navbar component**

`frontend/src/components/layout/Navbar.tsx` featuring brand logo, active route highlighting, role indicator pill, and "Connect Wallet" preview button.

- [ ] **Step 2: Create Footer component**

`frontend/src/components/layout/Footer.tsx` featuring branding, quick navigation links, and Optimism Sepolia testnet status badge.

- [ ] **Step 3: Update `src/app/layout.tsx`**

Wrap pages in `Navbar` and `Footer` with a subtle dark background mesh gradient.

- [ ] **Step 4: Verify rendering**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): add Navbar and Footer layout components"`

---

### Task 3: Common UI Components & Mock Data Layer

**Files:**
- Create: `frontend/src/lib/mockData.ts`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/Card.tsx`

- [ ] **Step 1: Create `src/lib/mockData.ts`**

Export rich TypeScript mock datasets for `MOCK_EVENTS`, `MOCK_TICKETS`, `MOCK_TRANSACTIONS`, and `MOCK_ANALYTICS`.

- [ ] **Step 2: Create reusable UI components (`Button`, `Badge`, `Card`)**

Build polished React components with variant styles (primary gradient, secondary outline, glass, success, warning, danger).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): add mock data layer and reusable UI component primitives"`

---

### Task 4: Buyer Portal - Homepage & Event Catalogue

**Files:**
- Create: `frontend/src/components/events/EventCard.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Build `EventCard` component**

Display event poster, title, date, venue badge, ticket price (in ETH / USD preview), and remaining quota progress bar.

- [ ] **Step 2: Build Homepage (`app/page.tsx`)**

Hero section with Web3 gradient headline ("Decentralized Ticketing Without Friction"), quick platform stats bar, search input, category filter buttons, and responsive grid of `EventCard`s.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): build homepage hero and event catalogue view"`

---

### Task 5: Buyer Portal - Event Detail & Ticket Purchase Modal

**Files:**
- Create: `frontend/src/app/events/[id]/page.tsx`
- Create: `frontend/src/components/events/PurchaseTicketModal.tsx`

- [ ] **Step 1: Build Event Detail page (`app/events/[id]/page.tsx`)**

Detailed event banner, poster preview, organizer info, schedule, location map box, resale cap policy info badge, and "Buy Ticket" button.

- [ ] **Step 2: Build `PurchaseTicketModal` component**

Glassmorphic modal displaying ticket summary, price breakdown, gasless relayer indicator ("0 Gas Fee for Buyers"), and simulated "Confirm Purchase" button.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): add event detail page and ticket purchase modal"`

---

### Task 6: Buyer Portal - My Tickets & Dynamic 30s QR Code Modal

**Files:**
- Create: `frontend/src/components/tickets/TicketCard.tsx`
- Create: `frontend/src/app/my-tickets/page.tsx`
- Create: `frontend/src/app/my-tickets/[id]/page.tsx`
- Create: `frontend/src/components/tickets/DynamicQRModal.tsx`

- [ ] **Step 1: Build `TicketCard` component**

Show NFT token ID (`#1042`), event name, date, venue, and vibrant status badge (`ACTIVE`, `USED`, `LISTED`).

- [ ] **Step 2: Build My Tickets page (`app/my-tickets/page.tsx`)**

Grid of user's NFT tickets with status filter tabs (All, Active, Resale, History).

- [ ] **Step 3: Build Ticket Detail page (`app/my-tickets/[id]/page.tsx`)**

Ticket NFT metadata showcase, ownership provenance timeline (Minted → Transferred → Verified), resale listing button, and "Show Entry QR Code" button.

- [ ] **Step 4: Build `DynamicQRModal` component**

Dynamic QR code display featuring live 30-second progress bar ticker, auto-refreshing nonce indicator, and security notice ("Screenshots are invalid - QR rotates every 30s").

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): add My Tickets gallery, ticket provenance, and dynamic 30s QR modal"`

---

### Task 7: Organizer Portal - Event Creation Wizard & Dashboard

**Files:**
- Create: `frontend/src/app/organizer/events/new/page.tsx`
- Create: `frontend/src/app/organizer/dashboard/page.tsx`

- [ ] **Step 1: Build Event Creation wizard form (`app/organizer/events/new/page.tsx`)**

Form steps: Basic Event Info, Image Poster drag-and-drop uploader preview, Capacity & Pricing, Resale Rules (Price Cap & Deadline).

- [ ] **Step 2: Build Organizer Dashboard (`app/organizer/dashboard/page.tsx`)**

Analytics cards (Total Revenue, Tickets Sold, Attendance Rate) and event management list.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): add organizer event creation wizard and analytics dashboard"`

---

### Task 8: Organizer Portal - Mobile Ticket Verification Scanner

**Files:**
- Create: `frontend/src/app/organizer/scanner/page.tsx`

- [ ] **Step 1: Build Scanner UI page (`app/organizer/scanner/page.tsx`)**

Mobile-optimized scanner layout featuring camera viewfinder simulation, torch/flash toggle button, manual token ID fallback search input, and interactive test buttons for simulating scan results (Valid Entry Green alert / Already Used Red alert / Expired Yellow alert).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): add mobile ticket verification scanner page"`

---

### Task 9: Admin Dashboard - System Health & Audit Log

**Files:**
- Create: `frontend/src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Build Admin Dashboard (`app/admin/dashboard/page.tsx`)**

System health status grid (Optimism Sepolia Node, MongoDB Sync, Pinata IPFS Gateway) and real-time transaction audit log table.

- [ ] **Step 2: Verify full frontend build**

Run: `npm run build`
Expected: Successful compilation with all static routes generated.

- [ ] **Step 3: Commit**

Run: `git add frontend/src && git commit -m "feat(frontend): add admin dashboard and complete frontend UI suite"`
