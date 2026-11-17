// Must run before any module imports `@/config/env`. Hardhat account #0 is the
// relayer (admin + organizer + minter); the key is the publicly known test key.
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://placeholder/overridden-by-test',
  JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
  THIRDWEB_CLIENT_ID: 'e2e',
  THIRDWEB_SECRET_KEY: 'e2e',
  RELAYER_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  PINATA_JWT: 'e2e',
  CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // overwritten after deploy
  RPC_URL: 'http://127.0.0.1:8546',
  AUTH_DOMAIN: 'localhost:3000',
  CONTRACT_DEPLOYMENT_BLOCK: '0',
  LISTENER_BATCH_SIZE: '50',
});
