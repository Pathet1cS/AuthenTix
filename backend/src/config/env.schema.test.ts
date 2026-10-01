import { envSchema } from './env.schema';

const validEnv = {
  PORT: '3001',
  MONGO_URI: 'mongodb://localhost:27017/authentix',
  JWT_SECRET: 'a'.repeat(32),
  THIRDWEB_CLIENT_ID: 'client_id',
  THIRDWEB_SECRET_KEY: 'secret_key',
  RELAYER_PRIVATE_KEY: '0xabc',
  PINATA_JWT: 'pinata_jwt_token',
  CONTRACT_ADDRESS: '0xContractAddr',
  RPC_URL: 'https://sepolia.optimism.io',
  AUTH_DOMAIN: 'localhost:3000',
  CONTRACT_DEPLOYMENT_BLOCK: '14325678',
};

describe('envSchema', () => {
  it('accepts all valid env vars', () => {
    expect(envSchema.safeParse(validEnv).success).toBe(true);
  });

  it('defaults PORT to "3001" when not provided', () => {
    const { PORT: _, ...withoutPort } = validEnv;
    const result = envSchema.safeParse(withoutPort);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe('3001');
  });

  it('rejects when MONGO_URI is missing', () => {
    const { MONGO_URI: _, ...without } = validEnv;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it('rejects when JWT_SECRET is missing', () => {
    const { JWT_SECRET: _, ...without } = validEnv;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(envSchema.safeParse({ ...validEnv, JWT_SECRET: 'a'.repeat(31) }).success).toBe(false);
  });

  it('rejects a one-character JWT_SECRET', () => {
    expect(envSchema.safeParse({ ...validEnv, JWT_SECRET: 'x' }).success).toBe(false);
  });

  it('accepts a JWT_SECRET of exactly 32 characters', () => {
    expect(envSchema.safeParse({ ...validEnv, JWT_SECRET: 'a'.repeat(32) }).success).toBe(true);
  });

  it('rejects an invalid RPC_URL', () => {
    expect(envSchema.safeParse({ ...validEnv, RPC_URL: 'not-a-url' }).success).toBe(false);
  });

  it('rejects when AUTH_DOMAIN is missing', () => {
    const { AUTH_DOMAIN: _, ...without } = validEnv;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it('rejects an empty AUTH_DOMAIN', () => {
    expect(envSchema.safeParse({ ...validEnv, AUTH_DOMAIN: '' }).success).toBe(false);
  });

  it('rejects when PINATA_JWT is missing', () => {
    const { PINATA_JWT: _, ...without } = validEnv;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it('rejects an empty PINATA_JWT', () => {
    expect(envSchema.safeParse({ ...validEnv, PINATA_JWT: '' }).success).toBe(false);
  });

  it('defaults PINATA_GATEWAY to an empty string', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PINATA_GATEWAY).toBe('');
  });

  it('accepts an explicit PINATA_GATEWAY', () => {
    const result = envSchema.safeParse({ ...validEnv, PINATA_GATEWAY: 'x.mypinata.cloud' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PINATA_GATEWAY).toBe('x.mypinata.cloud');
  });

  it('rejects when CONTRACT_DEPLOYMENT_BLOCK is missing', () => {
    const { CONTRACT_DEPLOYMENT_BLOCK: _, ...without } = validEnv;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it('rejects a non-numeric CONTRACT_DEPLOYMENT_BLOCK', () => {
    expect(
      envSchema.safeParse({ ...validEnv, CONTRACT_DEPLOYMENT_BLOCK: 'not-a-number' }).success,
    ).toBe(false);
  });

  it('transforms CONTRACT_DEPLOYMENT_BLOCK to a number', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CONTRACT_DEPLOYMENT_BLOCK).toBe(14325678);
      expect(typeof result.data.CONTRACT_DEPLOYMENT_BLOCK).toBe('number');
    }
  });

  it('accepts CONTRACT_DEPLOYMENT_BLOCK of 0', () => {
    expect(
      envSchema.safeParse({ ...validEnv, CONTRACT_DEPLOYMENT_BLOCK: '0' }).success,
    ).toBe(true);
  });

  it('defaults LISTENER_BATCH_SIZE to 1000', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.LISTENER_BATCH_SIZE).toBe(1000);
  });

  it('rejects LISTENER_BATCH_SIZE above 5000', () => {
    expect(
      envSchema.safeParse({ ...validEnv, LISTENER_BATCH_SIZE: '5001' }).success,
    ).toBe(false);
  });

  it('defaults LISTENER_CHECKPOINT_INTERVAL to 10', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.LISTENER_CHECKPOINT_INTERVAL).toBe(10);
  });

  it('accepts an optional WS_RPC_URL', () => {
    const result = envSchema.safeParse({ ...validEnv, WS_RPC_URL: 'wss://sepolia.optimism.io' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.WS_RPC_URL).toBe('wss://sepolia.optimism.io');
  });

  it('allows WS_RPC_URL to be omitted', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.WS_RPC_URL).toBeUndefined();
  });
});
