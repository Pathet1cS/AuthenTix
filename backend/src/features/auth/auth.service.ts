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

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 11000
  );
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
    try {
      user = await User.create({
        walletAddress,
        email: payload.email,
        name: payload.name,
        role: 'buyer',
      });
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        throw err;
      }
      if (err.keyPattern?.walletAddress) {
        // Another request created this user in the gap between our findOne
        // and our create (double-submit, retry, two tabs). Re-fetch and
        // proceed idempotently rather than failing the login.
        const winner = await User.findOne({ walletAddress });
        if (!winner) {
          throw err;
        }
        user = winner;
      } else if (err.keyPattern?.email) {
        throw createError('Email already registered', 409);
      } else {
        throw err;
      }
    }
  }

  const userId = String(user._id);

  return {
    userId,
    walletAddress: user.walletAddress,
    token: signToken({ sub: userId, walletAddress: user.walletAddress, role: user.role }),
  };
}
