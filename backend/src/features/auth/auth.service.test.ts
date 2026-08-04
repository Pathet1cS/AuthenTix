jest.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-jwt-secret', THIRDWEB_SECRET_KEY: 'test-thirdweb-secret' },
}));

import { Wallet } from 'ethers';
import { setupTestDB, teardownTestDB, clearCollections } from '@/shared/models/__tests__/setup';
import { User } from '@/shared/models';
import { verifyToken } from '@/shared/utils/jwt';
import * as signatureUtil from '@/shared/utils/signature';
import { serializeLoginPayload, LoginPayload, LoginRequest } from './auth.schema';
import { login } from './auth.service';

beforeAll(async () => { await setupTestDB(); }, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); jest.restoreAllMocks(); });

async function buildRequest(
  overrides: Partial<LoginPayload> = {},
  wallet = Wallet.createRandom(),
): Promise<LoginRequest> {
  const now = Date.now();
  const payload: LoginPayload = {
    address: wallet.address,
    email: 'user@example.com',
    name: 'Alice',
    nonce: 'a1b2c3',
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 4 * 60 * 1000).toISOString(),
    ...overrides,
  };
  const signature = await wallet.signMessage(serializeLoginPayload(payload));
  return { payload, signature };
}

describe('login — success', () => {
  it('creates a new user with role buyer and returns the PRD fields', async () => {
    const req = await buildRequest();
    const result = await login(req);

    expect(result.walletAddress).toBe(req.payload.address.toLowerCase());
    expect(result.userId).toEqual(expect.any(String));
    expect(result.token).toEqual(expect.any(String));

    const user = await User.findOne({ walletAddress: result.walletAddress });
    expect(user).not.toBeNull();
    expect(user?.role).toBe('buyer');
    expect(user?.email).toBe('user@example.com');
    expect(user?.name).toBe('Alice');
  });

  it('embeds userId, walletAddress and role in the token', async () => {
    const req = await buildRequest();
    const result = await login(req);
    const claims = verifyToken(result.token);

    expect(claims.sub).toBe(result.userId);
    expect(claims.walletAddress).toBe(result.walletAddress);
    expect(claims.role).toBe('buyer');
  });

  it('does not duplicate the user on a second login', async () => {
    const wallet = Wallet.createRandom();
    const first = await login(await buildRequest({}, wallet));
    const second = await login(await buildRequest({ nonce: 'different' }, wallet));

    expect(second.userId).toBe(first.userId);
    expect(await User.countDocuments()).toBe(1);
  });

  it('ignores a changed email on a returning wallet', async () => {
    const wallet = Wallet.createRandom();
    await login(await buildRequest({}, wallet));
    await login(await buildRequest({ email: 'attacker@evil.com' }, wallet));

    const user = await User.findOne({ walletAddress: wallet.address.toLowerCase() });
    expect(user?.email).toBe('user@example.com');
  });

  it('preserves an elevated role on a returning wallet', async () => {
    const wallet = Wallet.createRandom();
    const first = await login(await buildRequest({}, wallet));
    await User.findByIdAndUpdate(first.userId, { role: 'organizer' });

    const second = await login(await buildRequest({ nonce: 'next' }, wallet));
    expect(verifyToken(second.token).role).toBe('organizer');
  });
});

describe('login — rejection', () => {
  it('rejects an expired payload', async () => {
    const now = Date.now();
    const req = await buildRequest({
      issuedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(now - 60 * 1000).toISOString(),
    });
    await expect(login(req)).rejects.toThrow('Login payload expired');
  });

  it('rejects an issuedAt beyond the clock-skew allowance', async () => {
    const now = Date.now();
    const req = await buildRequest({
      issuedAt: new Date(now + 5 * 60 * 1000).toISOString(),
      expiresAt: new Date(now + 6 * 60 * 1000).toISOString(),
    });
    await expect(login(req)).rejects.toThrow('Invalid login payload timestamps');
  });

  it('rejects a validity window longer than five minutes', async () => {
    const now = Date.now();
    const req = await buildRequest({
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    });
    await expect(login(req)).rejects.toThrow('Login payload validity window too long');
  });

  it('rejects a signature that does not verify', async () => {
    jest.spyOn(signatureUtil, 'verifyWalletSignature').mockResolvedValue(false);
    await expect(login(await buildRequest())).rejects.toThrow('Invalid signature');
  });

  it('does not create a user when the signature is rejected', async () => {
    jest.spyOn(signatureUtil, 'verifyWalletSignature').mockResolvedValue(false);
    await expect(login(await buildRequest())).rejects.toThrow();
    expect(await User.countDocuments()).toBe(0);
  });

  it('attaches statusCode 401 to rejections', async () => {
    jest.spyOn(signatureUtil, 'verifyWalletSignature').mockResolvedValue(false);
    await expect(login(await buildRequest())).rejects.toMatchObject({ statusCode: 401 });
  });
});
