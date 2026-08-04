jest.mock('@/config/env', () => ({
  env: { THIRDWEB_SECRET_KEY: 'test-thirdweb-secret' },
}));

const mockGetUser = jest.fn();
jest.mock('thirdweb/wallets', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

import { thirdwebClient } from '@/config/thirdweb';
import { getThirdwebUserEmail } from './thirdwebUser';

beforeEach(() => {
  mockGetUser.mockReset();
});

describe('getThirdwebUserEmail wiring', () => {
  it('queries Thirdweb by wallet address with the secret-key client', async () => {
    mockGetUser.mockResolvedValue({ userId: 'u1', walletAddress: '0xabc', email: 'a@b.com' });

    await getThirdwebUserEmail('0xabc');

    expect(mockGetUser).toHaveBeenCalledWith({
      client: thirdwebClient,
      walletAddress: '0xabc',
    });
  });

  it('returns the email when Thirdweb has one on file', async () => {
    mockGetUser.mockResolvedValue({ userId: 'u1', walletAddress: '0xabc', email: 'a@b.com' });
    await expect(getThirdwebUserEmail('0xabc')).resolves.toBe('a@b.com');
  });

  it('returns null when the wallet is not a Thirdweb account', async () => {
    mockGetUser.mockResolvedValue(null);
    await expect(getThirdwebUserEmail('0xabc')).resolves.toBeNull();
  });

  it('returns null when the account has no email', async () => {
    mockGetUser.mockResolvedValue({ userId: 'u1', walletAddress: '0xabc' });
    await expect(getThirdwebUserEmail('0xabc')).resolves.toBeNull();
  });
});
