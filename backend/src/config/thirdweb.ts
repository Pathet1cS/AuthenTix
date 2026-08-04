import { createThirdwebClient } from 'thirdweb';
import { env } from './env';

export const thirdwebClient = createThirdwebClient({
  secretKey: env.THIRDWEB_SECRET_KEY,
});
