jest.mock('@/config/env', () => ({
  env: { THIRDWEB_SECRET_KEY: 'test-thirdweb-secret' },
}));

const mockVerifySignature = jest.fn().mockResolvedValue(true);
jest.mock('thirdweb/auth', () => ({
  verifySignature: (...args: unknown[]) => mockVerifySignature(...args),
}));

import { optimismSepolia } from 'thirdweb/chains';
import { thirdwebClient } from '@/config/thirdweb';
import { verifyWalletSignature } from './signature';

describe('verifyWalletSignature wiring', () => {
  it('passes the thirdweb client and Optimism Sepolia chain through', async () => {
    await verifyWalletSignature({
      address: '0xabc',
      message: 'msg',
      signature: '0xsig',
    });

    expect(mockVerifySignature).toHaveBeenCalledWith({
      address: '0xabc',
      message: 'msg',
      signature: '0xsig',
      client: thirdwebClient,
      chain: optimismSepolia,
    });
  });
});
