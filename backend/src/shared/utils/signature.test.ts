jest.mock('@/config/env', () => ({
  env: { THIRDWEB_SECRET_KEY: 'test-thirdweb-secret' },
}));

import { Wallet } from 'ethers';
import { verifyWalletSignature } from './signature';

describe('verifyWalletSignature', () => {
  it('returns true for a signature produced by the claimed address', async () => {
    const wallet = Wallet.createRandom();
    const message = '{"address":"0x1","nonce":"abc"}';
    const signature = await wallet.signMessage(message);

    await expect(
      verifyWalletSignature({ address: wallet.address, message, signature }),
    ).resolves.toBe(true);
  });

  it('accepts a lowercased address for a checksummed signer', async () => {
    const wallet = Wallet.createRandom();
    const message = 'authentix login';
    const signature = await wallet.signMessage(message);

    await expect(
      verifyWalletSignature({
        address: wallet.address.toLowerCase(),
        message,
        signature,
      }),
    ).resolves.toBe(true);
  });
});
