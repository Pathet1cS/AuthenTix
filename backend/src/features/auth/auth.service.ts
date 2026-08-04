import { User } from '@/shared/models';
import { verifyWalletSignature } from '@/shared/utils/signature';
import { signToken } from '@/shared/utils/jwt';
import { createError } from '@/shared/utils/appError';
import { LoginRequest, serializeLoginPayload } from './auth.schema';

const MAX_VALIDITY_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

export interface LoginResult {
  userId: string;
  walletAddress: string;
  token: string;
}

export async function login(request: LoginRequest): Promise<LoginResult> {
  const { payload, signature } = request;

  const issuedAt = new Date(payload.issuedAt).getTime();
  const expiresAt = new Date(payload.expiresAt).getTime();
  const now = Date.now();

  if (expiresAt <= now) {
    throw createError('Login payload expired', 401);
  }
  if (issuedAt > now + CLOCK_SKEW_MS) {
    throw createError('Invalid login payload timestamps', 401);
  }
  if (expiresAt - issuedAt > MAX_VALIDITY_MS) {
    throw createError('Login payload validity window too long', 401);
  }

  // Sign over the re-serialised payload, never the raw request body, so that
  // key order and whitespace on the wire cannot affect verification.
  const isValid = await verifyWalletSignature({
    address: payload.address,
    message: serializeLoginPayload(payload),
    signature,
  });
  if (!isValid) {
    throw createError('Invalid signature', 401);
  }

  const walletAddress = payload.address.toLowerCase();

  // Role is never taken from client input: a returning user keeps whatever role
  // the platform assigned, and a new one always starts as a buyer.
  let user = await User.findOne({ walletAddress });
  if (!user) {
    user = await User.create({
      walletAddress,
      email: payload.email,
      name: payload.name,
      role: 'buyer',
    });
  }

  const userId = String(user._id);

  return {
    userId,
    walletAddress: user.walletAddress,
    token: signToken({ sub: userId, walletAddress: user.walletAddress, role: user.role }),
  };
}
