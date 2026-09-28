import { setupTestDB, teardownTestDB, clearCollections } from './__tests__/setup';
import { UsedNonce } from './nonce.model';

beforeAll(async () => { await setupTestDB(); }, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('UsedNonce model', () => {
  const expiresAt = new Date(Date.now() + 30_000);

  it('creates with the given fields', async () => {
    const doc = await UsedNonce.create({
      scope: 'qr-verify',
      nonce: 'abc123',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase(),
      expiresAt,
    });

    expect(doc.scope).toBe('qr-verify');
    expect(doc.nonce).toBe('abc123');
    expect(doc.walletAddress).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a second insert with the same scope and nonce', async () => {
    await UsedNonce.create({
      scope: 'qr-verify',
      nonce: 'dup-nonce',
      walletAddress: '0xaaa',
      expiresAt,
    });

    await expect(
      UsedNonce.create({
        scope: 'qr-verify',
        nonce: 'dup-nonce',
        walletAddress: '0xbbb',
        expiresAt,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('allows the same nonce string under a different scope', async () => {
    await UsedNonce.create({
      scope: 'login',
      nonce: 'shared-nonce',
      walletAddress: '0xaaa',
      expiresAt,
    });

    await expect(
      UsedNonce.create({
        scope: 'qr-verify',
        nonce: 'shared-nonce',
        walletAddress: '0xaaa',
        expiresAt,
      }),
    ).resolves.toBeDefined();
  });
});
