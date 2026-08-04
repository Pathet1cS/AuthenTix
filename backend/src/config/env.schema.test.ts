import { envSchema } from './env.schema';

const validEnv = {
  PORT: '3001',
  MONGO_URI: 'mongodb://localhost:27017/authentix',
  JWT_SECRET: 'supersecret',
  THIRDWEB_CLIENT_ID: 'client_id',
  THIRDWEB_SECRET_KEY: 'secret_key',
  RELAYER_PRIVATE_KEY: '0xabc',
  PINATA_API_KEY: 'pinata_key',
  PINATA_SECRET_KEY: 'pinata_secret',
  CONTRACT_ADDRESS: '0xContractAddr',
  RPC_URL: 'https://sepolia.optimism.io',
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

  it('rejects an invalid RPC_URL', () => {
    expect(envSchema.safeParse({ ...validEnv, RPC_URL: 'not-a-url' }).success).toBe(false);
  });
});
