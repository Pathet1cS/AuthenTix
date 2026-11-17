import { createThirdwebClient } from 'thirdweb';
import { optimismSepolia } from 'thirdweb/chains';
import { inAppWallet } from 'thirdweb/wallets';

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export const chain = optimismSepolia;

export const wallets = [inAppWallet({ auth: { options: ['email', 'google'] } })];
