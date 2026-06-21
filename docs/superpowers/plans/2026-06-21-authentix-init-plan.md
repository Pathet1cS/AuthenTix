# AuthenTix Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the base directories, boilerplate, and initial tests for the frontend (Next.js), backend (Express), and contracts (Hardhat) to establish the working monorepo foundation.

**Architecture:** A single repository containing three separate Node/TS projects (`/frontend`, `/backend`, `/contracts`), each with its own package configuration.

**Tech Stack:** Next.js, Express.js, Hardhat, TypeScript, Jest.

## Global Constraints

- Architecture: Hybrid Web2 + Web3
- Blockchain Network: Optimism Sepolia Testnet
- Source of truth: Blockchain ownership is primary source of truth.

---

### Task 1: Initialize Backend

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.js`
- Create: `backend/tests/health.test.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`

**Interfaces:**
- Consumes: None
- Produces: Base Express server exposing `GET /api/health` returning `{"status": "ok"}`

- [ ] **Step 1: Scaffolding and Dependencies**

```bash
mkdir -p backend/src backend/tests
cd backend
npm init -y
npm install express
npm install -D typescript @types/node @types/express jest ts-jest @types/jest supertest @types/supertest
npx tsc --init
```

Update `backend/tsconfig.json` to have `"outDir": "./dist"`.

Update `backend/package.json` scripts:
```json
"scripts": {
  "test": "jest",
  "build": "tsc",
  "start": "node dist/server.js",
  "dev": "ts-node src/server.ts"
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/health.test.ts`:
```typescript
import request from 'supertest';
import app from '../src/app';

describe('Health Check', () => {
    it('should return 200 and status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });
});
```

Create `backend/jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && npx jest tests/health.test.ts
```
Expected: FAIL because `../src/app` does not exist.

- [ ] **Step 4: Write minimal implementation**

Create `backend/src/app.ts`:
```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

export default app;
```

Create `backend/src/server.ts`:
```typescript
import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npm test
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "chore(backend): initialize express backend with health check"
```

---

### Task 2: Initialize Smart Contracts

**Files:**
- Create: `contracts/package.json`
- Create: `contracts/hardhat.config.ts`
- Create: `contracts/tsconfig.json`
- Create: `contracts/contracts/EventTicketNFT.sol`
- Create: `contracts/test/EventTicketNFT.test.ts`

**Interfaces:**
- Consumes: None
- Produces: Base Hardhat environment with OpenZeppelin and a skeleton `EventTicketNFT` contract.

- [ ] **Step 1: Scaffolding and Dependencies**

```bash
mkdir -p contracts/contracts contracts/test
cd contracts
npm init -y
npm install -D hardhat @nomicfoundation/hardhat-toolbox typescript ts-node @types/node @types/mocha @types/chai chai@4 ethers
npm install @openzeppelin/contracts
```

Create `contracts/hardhat.config.ts`:
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
};

export default config;
```

Create `contracts/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist"
  },
  "include": ["hardhat.config.ts", "./test", "./typechain-types"],
  "files": ["./hardhat.config.ts"]
}
```

- [ ] **Step 2: Write the failing test**

Create `contracts/test/EventTicketNFT.test.ts`:
```typescript
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EventTicketNFT", function () {
  it("Should deploy successfully and have right name", async function () {
    const EventTicketNFT = await ethers.getContractFactory("EventTicketNFT");
    const nft = await EventTicketNFT.deploy();
    expect(await nft.name()).to.equal("AuthenTix");
    expect(await nft.symbol()).to.equal("ATX");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd contracts && npx hardhat test
```
Expected: FAIL ("HardhatError: HH700: Artifact for contract "EventTicketNFT" not found")

- [ ] **Step 4: Write minimal implementation**

Create `contracts/contracts/EventTicketNFT.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract EventTicketNFT is ERC721 {
    constructor() ERC721("AuthenTix", "ATX") {}
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd contracts && npx hardhat test
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add contracts/
git commit -m "chore(contracts): initialize hardhat with EventTicketNFT skeleton"
```

---

### Task 3: Initialize Frontend

**Files:**
- Create: `frontend/...` (Next.js default files)
- Modify: `frontend/package.json`
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: None
- Produces: Base Next.js app running.

- [ ] **Step 1: Scaffolding and Dependencies**

```bash
npx create-next-app@14 ./frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd frontend
npm install thirdweb
```

- [ ] **Step 2: Add initial homepage**

Modify `frontend/src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">AuthenTix Web3 Ticketing</h1>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```
Expected: PASS (Successfully compiles)

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "chore(frontend): initialize next.js with thirdweb"
```
