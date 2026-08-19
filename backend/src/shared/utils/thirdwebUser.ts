import { getUser } from 'thirdweb/wallets';
import { thirdwebClient } from '@/config/thirdweb';

/**
 * Returns the email Thirdweb holds for `walletAddress`, or null when the wallet
 * is not a Thirdweb account or has no email on file. Server-only: it relies on
 * the client carrying a secret key.
 */
export async function getThirdwebUserEmail(walletAddress: string): Promise<string | null> {
  const user = await getUser({ client: thirdwebClient, walletAddress });
  return user?.email ?? null;
}
