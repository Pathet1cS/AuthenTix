jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret',
    THIRDWEB_SECRET_KEY: 'test-thirdweb-secret',
    AUTH_DOMAIN: 'localhost:3000',
  },
}));

// Never let a test reach the Thirdweb API.
jest.mock('@/shared/utils/thirdwebUser', () => ({
  getThirdwebUserEmail: jest.fn(),
}));

import { Wallet } from 'ethers';
import { setupTestDB, teardownTestDB, clearCollections } from '@/shared/models/__tests__/setup';
import { User } from '@/shared/models';
import { verifyToken } from '@/shared/utils/jwt';
import * as signatureUtil from '@/shared/utils/signature';
import { getThirdwebUserEmail } from '@/shared/utils/thirdwebUser';
import {
  serializeLoginPayload,
  LOGIN_STATEMENT,
  LoginPayload,
  LoginRequest,
} from './auth.schema';
import { login } from './auth.service';

const mockGetThirdwebUserEmail = getThirdwebUserEmail as jest.Mock;

beforeAll(async () => { await setupTestDB(); }, 30_000);
afterAll(async () => { await teardownTestDB(); });
beforeEach(() => {
  mockGetThirdwebUserEmail.mockReset();
  mockGetThirdwebUserEmail.mockResolvedValue('user@example.com');
});
afterEach(async () => { await clearCollections(); jest.restoreAllMocks(); });

async function buildRequest(
  overrides: Partial<LoginPayload> = {},
  wallet = Wallet.createRandom(),
): Promise<LoginRequest> {
  const now = Date.now();
  const payload: LoginPayload = {
    domain: 'localhost:3000',
    statement: LOGIN_STATEMENT,
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
    await login(await buildRequest({ email: 'attacker@evil.com', nonce: 'second' }, wallet));

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

describe('login — domain binding', () => {
  it('accepts a payload bound to the configured domain', async () => {
    const result = await login(await buildRequest({ domain: 'localhost:3000' }));
    expect(result.token).toEqual(expect.any(String));
  });

  it('rejects a payload signed for a different domain with 401', async () => {
    const req = await buildRequest({ domain: 'evil.example.com' });
    await expect(login(req)).rejects.toMatchObject({
      message: 'Invalid login domain',
      statusCode: 401,
    });
  });

  it('does not create a user when the domain does not match', async () => {
    await expect(login(await buildRequest({ domain: 'evil.example.com' }))).rejects.toThrow();
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a mismatched domain before verifying the signature', async () => {
    // The signature check is the one that can reach the network, so a wrong
    // domain must short-circuit ahead of it.
    const spy = jest.spyOn(signatureUtil, 'verifyWalletSignature');
    await expect(login(await buildRequest({ domain: 'evil.example.com' }))).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a domain that differs only in case', async () => {
    await expect(login(await buildRequest({ domain: 'LOCALHOST:3000' }))).rejects.toThrow(
      'Invalid login domain',
    );
  });
});

describe('login — nonce replay', () => {
  it('rejects a second login that replays the same payload and signature', async () => {
    const wallet = Wallet.createRandom();
    const req = await buildRequest({}, wallet);

    await expect(login(req)).resolves.toEqual(expect.anything());

    await expect(login(req)).rejects.toMatchObject({
      message: 'Nonce has already been used',
      statusCode: 401,
    });
  });
});

describe('login — statement binding', () => {
  it('rejects a payload carrying a substituted statement with 401', async () => {
    const req = await buildRequest({ statement: 'Approve this transfer' });
    await expect(login(req)).rejects.toMatchObject({
      message: 'Invalid login statement',
      statusCode: 401,
    });
  });

  it('does not create a user when the statement does not match', async () => {
    await expect(
      login(await buildRequest({ statement: 'Approve this transfer' })),
    ).rejects.toThrow();
    expect(await User.countDocuments()).toBe(0);
  });
});

describe('login — duplicate key handling', () => {
  it('resolves a walletAddress race to the existing user instead of throwing', async () => {
    const wallet = Wallet.createRandom();
    const walletAddress = wallet.address.toLowerCase();
    const existing = await User.create({
      walletAddress,
      email: 'existing@example.com',
      name: 'Bob',
      role: 'buyer',
    });

    // Simulate the race: our pre-check finds nothing (as it would if a
    // concurrent request created the user in the gap before our create call
    // hits the real unique index), while the user already exists for real.
    jest.spyOn(User, 'findOne').mockResolvedValueOnce(null);

    const result = await login(await buildRequest({}, wallet));

    expect(result.userId).toBe(String(existing._id));
    expect(await User.countDocuments()).toBe(1);
  });

  it('rejects a new wallet whose email is already registered to a different wallet', async () => {
    const existingWallet = Wallet.createRandom();
    await User.create({
      walletAddress: existingWallet.address.toLowerCase(),
      email: 'taken@example.com',
      name: 'Bob',
      role: 'buyer',
    });

    const newWallet = Wallet.createRandom();
    // Thirdweb genuinely holds this email for the new wallet, so the request
    // gets past email verification and reaches the unique index.
    mockGetThirdwebUserEmail.mockResolvedValue('taken@example.com');
    const req = await buildRequest({ email: 'taken@example.com' }, newWallet);

    await expect(login(req)).rejects.toMatchObject({
      message: 'Email already registered',
      statusCode: 409,
    });
  });
});

describe('login — Thirdweb email verification', () => {
  it('creates the user when Thirdweb reports the same email', async () => {
    const req = await buildRequest();
    const result = await login(req);

    expect(mockGetThirdwebUserEmail).toHaveBeenCalledWith(req.payload.address);
    expect(await User.countDocuments()).toBe(1);
    expect(result.token).toEqual(expect.any(String));
  });

  it('accepts a Thirdweb email that differs only in case', async () => {
    mockGetThirdwebUserEmail.mockResolvedValue('User@Example.COM');
    const result = await login(await buildRequest({ email: 'user@example.com' }));

    expect(result.userId).toEqual(expect.any(String));
    expect(await User.countDocuments()).toBe(1);
  });

  it('rejects a claimed email Thirdweb does not back with 401', async () => {
    mockGetThirdwebUserEmail.mockResolvedValue('real-owner@example.com');
    await expect(login(await buildRequest({ email: 'victim@corp.com' }))).rejects.toMatchObject({
      message: 'Email does not match wallet',
      statusCode: 401,
    });
  });

  it('does not create a user when the claimed email is not backed', async () => {
    mockGetThirdwebUserEmail.mockResolvedValue('real-owner@example.com');
    await expect(login(await buildRequest({ email: 'victim@corp.com' }))).rejects.toThrow();
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a wallet Thirdweb does not know with 401', async () => {
    mockGetThirdwebUserEmail.mockResolvedValue(null);
    await expect(login(await buildRequest())).rejects.toMatchObject({
      message: 'Wallet is not a registered Thirdweb account',
      statusCode: 401,
    });
  });

  it('does not create a user when Thirdweb returns no account', async () => {
    mockGetThirdwebUserEmail.mockResolvedValue(null);
    await expect(login(await buildRequest())).rejects.toThrow();
    expect(await User.countDocuments()).toBe(0);
  });

  it('does not query Thirdweb for a returning wallet', async () => {
    const wallet = Wallet.createRandom();
    await login(await buildRequest({}, wallet));
    expect(mockGetThirdwebUserEmail).toHaveBeenCalledTimes(1);

    mockGetThirdwebUserEmail.mockClear();
    await login(await buildRequest({ nonce: 'second' }, wallet));

    // The common path must stay free of a network round-trip.
    expect(mockGetThirdwebUserEmail).not.toHaveBeenCalled();
    expect(await User.countDocuments()).toBe(1);
  });

  it('does not query Thirdweb when the signature is rejected', async () => {
    jest.spyOn(signatureUtil, 'verifyWalletSignature').mockResolvedValue(false);
    await expect(login(await buildRequest())).rejects.toThrow('Invalid signature');
    expect(mockGetThirdwebUserEmail).not.toHaveBeenCalled();
  });

  it('does not query Thirdweb when the domain does not match', async () => {
    await expect(login(await buildRequest({ domain: 'evil.example.com' }))).rejects.toThrow();
    expect(mockGetThirdwebUserEmail).not.toHaveBeenCalled();
  });
});
