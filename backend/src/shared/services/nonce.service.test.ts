import { setupTestDB, teardownTestDB, clearCollections } from '@/shared/models/__tests__/setup';
import { consumeNonce } from './nonce.service';

beforeAll(async () => { await setupTestDB(); }, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('consumeNonce', () => {
  const expiresAt = new Date(Date.now() + 30_000);

  it('resolves on the first call for a given scope+nonce', async () => {
    await expect(
      consumeNonce({ scope: 'qr-verify', nonce: 'n1', walletAddress: '0xaaa', expiresAt }),
    ).resolves.toBeUndefined();
  });

  it('rejects a second call with the same scope+nonce as a replay', async () => {
    await consumeNonce({ scope: 'qr-verify', nonce: 'n2', walletAddress: '0xaaa', expiresAt });

    await expect(
      consumeNonce({ scope: 'qr-verify', nonce: 'n2', walletAddress: '0xaaa', expiresAt }),
    ).rejects.toMatchObject({ message: 'Nonce has already been used', statusCode: 401 });
  });

  it('rejects a replay even from a different wallet address', async () => {
    await consumeNonce({ scope: 'qr-verify', nonce: 'n3', walletAddress: '0xaaa', expiresAt });

    await expect(
      consumeNonce({ scope: 'qr-verify', nonce: 'n3', walletAddress: '0xbbb', expiresAt }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('treats the same nonce string under a different scope independently', async () => {
    await consumeNonce({ scope: 'login', nonce: 'shared', walletAddress: '0xaaa', expiresAt });

    await expect(
      consumeNonce({ scope: 'qr-verify', nonce: 'shared', walletAddress: '0xaaa', expiresAt }),
    ).resolves.toBeUndefined();
  });
});
