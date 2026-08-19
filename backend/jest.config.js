/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
  // Every DB-touching suite starts its own MongoMemoryServer; running them in
  // parallel makes the concurrent startups exceed the timeout and the suite
  // goes red. Serialise so a bare `npm test` (as CI runs it) passes.
  maxWorkers: 1,
};
