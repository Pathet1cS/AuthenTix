import { UsedNonce } from '@/shared/models';
import { NonceScope } from '@/shared/models/nonce.model';
import { createError } from '@/shared/utils/appError';
import { isDuplicateKeyError } from '@/shared/utils/mongoErrors';

export interface ConsumeNonceParams {
  scope: NonceScope;
  nonce: string;
  walletAddress: string;
  expiresAt: Date;
}

/**
 * Atomically spends a nonce: the first caller for a given (scope, nonce)
 * succeeds, every later caller for the same pair hits the unique index and is
 * rejected as a replay.
 */
export async function consumeNonce(params: ConsumeNonceParams): Promise<void> {
  try {
    await UsedNonce.create({
      scope: params.scope,
      nonce: params.nonce,
      walletAddress: params.walletAddress,
      expiresAt: params.expiresAt,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw createError('Nonce has already been used', 401);
    }
    throw err;
  }
}
