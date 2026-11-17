/** Local-chain end-to-end suite: `npm run test:e2e` (spawns a Hardhat node + in-memory MongoDB). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['<rootDir>/e2e/env.setup.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
};
