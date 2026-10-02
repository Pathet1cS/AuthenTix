import { User } from '@/shared/models';
import { env } from '@/config/env';
import { verifyWalletSignature } from '@/shared/utils/signature';
import { getThirdwebUserEmail } from '@/shared/utils/thirdwebUser';
import { signToken } from '@/shared/utils/jwt';
import { createError } from '@/shared/utils/appError';
import { isDuplicateKeyError } from '@/shared/utils/mongoErrors';
import { consumeNonce } from '@/shared/services/nonce.service';
import { LOGIN_STATEMENT, LoginRequest, serializeLoginPayload } from './auth.schema';

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

  // Domain binding is checked before the signature so a payload signed for
  // another dApp is rejected without ever reaching the (billed) RPC path.
  if (payload.domain !== env.AUTH_DOMAIN) {
    throw createError('Invalid login domain', 401);
  }
  if (payload.statement !== LOGIN_STATEMENT) {
    throw createError('Invalid login statement', 401);
  }

  // Spent before the (billed) signature RPC path, same reasoning as the
  // domain/statement checks above. Closes the replay window a captured
  // payload+signature would otherwise have until expiresAt.
  await consumeNonce({
    scope: 'login',
    nonce: payload.nonce,
    walletAddress: payload.address.toLowerCase(),
    expiresAt: new Date(expiresAt),
  });

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
    // `email` is self-asserted by the client and lands in a UNIQUE column, so
    // anyone could otherwise squat on a stranger's address with a throwaway
    // wallet. Confirm with Thirdweb that this wallet really owns the email.
    // Only on the create path: a returning user is already established, which
    // also keeps the common login free of a network round-trip.
    const verifiedEmail = await getThirdwebUserEmail(payload.address);
    if (verifiedEmail === null) {
      throw createError('Wallet is not a registered Thirdweb account', 401);
    }
    if (verifiedEmail.toLowerCase() !== payload.email.toLowerCase()) {
      throw createError('Email does not match wallet', 401);
    }

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
