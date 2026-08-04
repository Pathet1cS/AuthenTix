import { verifySignature } from 'thirdweb/auth';
import { optimismSepolia } from 'thirdweb/chains';
import { thirdwebClient } from '@/config/thirdweb';

export interface VerifyWalletSignatureParams {
  address: string;
  message: string;
  signature: string;
}

/**
 * Verifies that `signature` over `message` was produced by `address`.
 * Handles both EOA and smart-account (EIP-1271 / ERC-6492) wallets, since a
 * Thirdweb embedded wallet may be either.
 */
export async function verifyWalletSignature({
  address,
  message,
  signature,
}: VerifyWalletSignatureParams): Promise<boolean> {
  return verifySignature({
    address,
    message,
    signature,
    client: thirdwebClient,
    chain: optimismSepolia,
  });
}
