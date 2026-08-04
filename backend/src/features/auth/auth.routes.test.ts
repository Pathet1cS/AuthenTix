jest.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-jwt-secret', THIRDWEB_SECRET_KEY: 'test-thirdweb-secret' },
}));

import request from 'supertest';
import { Wallet } from 'ethers';
import { app } from '@/app';
import { setupTestDB, teardownTestDB, clearCollections } from '@/shared/models/__tests__/setup';
import { serializeLoginPayload, LoginPayload } from './auth.schema';

beforeAll(async () => { await setupTestDB(); }, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

async function signedBody() {
  const wallet = Wallet.createRandom();
  const now = Date.now();
  const payload: LoginPayload = {
    address: wallet.address,
    email: 'user@example.com',
    name: 'Alice',
    nonce: 'a1b2c3',
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 4 * 60 * 1000).toISOString(),
  };
  return { payload, signature: await wallet.signMessage(serializeLoginPayload(payload)) };
}

describe('POST /api/auth/login', () => {
  it('returns 200 with userId, walletAddress and token', async () => {
    const body = await signedBody();
    const res = await request(app).post('/api/auth/login').send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      userId: expect.any(String),
      walletAddress: body.payload.address.toLowerCase(),
      token: expect.any(String),
    });
  });

  it('returns 400 for a malformed body', async () => {
    const res = await request(app).post('/api/auth/login').send({ nope: true });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'Invalid login payload' });
  });

  it('returns 400 when the payload carries a role field', async () => {
    const body = await signedBody();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...body, payload: { ...body.payload, role: 'admin' } });

    expect(res.status).toBe(400);
  });

  it('returns 401 for an expired payload', async () => {
    const wallet = Wallet.createRandom();
    const now = Date.now();
    const payload: LoginPayload = {
      address: wallet.address,
      email: 'user@example.com',
      name: 'Alice',
      nonce: 'a1b2c3',
      issuedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(now - 60 * 1000).toISOString(),
    };
    const signature = await wallet.signMessage(serializeLoginPayload(payload));

    const res = await request(app).post('/api/auth/login').send({ payload, signature });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: 'Login payload expired' });
  });
});
