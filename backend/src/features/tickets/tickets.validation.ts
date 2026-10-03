import { z } from 'zod';

export const createResaleListingSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  price: z.number().positive('Resale price must be positive'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid EVM transaction hash'),
});

export const cancelResaleListingSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid EVM transaction hash'),
});

export const fulfillResalePurchaseSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid EVM transaction hash'),
});

export const myTicketsQuerySchema = z.object({
  status: z.enum(['all', 'active', 'resale', 'used']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const resaleMarketplaceQuerySchema = z.object({
  eventId: z.string().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// FR-07 QR payload: expiresAt is a Unix-seconds number, unlike the login
// payload's ISO-string expiresAt.
export const verifyTicketSchema = z
  .object({
    tokenId: z.string().min(1, 'Token ID is required'),
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a 0x-prefixed 20-byte hex string'),
    nonce: z.string().min(1, 'nonce is required').max(128, 'nonce must be at most 128 characters'),
    expiresAt: z.number().int().positive('expiresAt must be a positive unix timestamp'),
    signature: z
      .string()
      .regex(/^0x([a-fA-F0-9]{2})+$/, 'signature must be a 0x-prefixed even-length hex string')
      .max(10000, 'signature must be at most 10000 characters'),
  })
  .strict();

export type VerifyTicketPayload = z.infer<typeof verifyTicketSchema>;

/**
 * Produces the exact string the buyer's wallet signs. Fixed key order, same
 * rationale as `serializeLoginPayload`: sign what we re-serialise, never the
 * raw request body.
 */
export function serializeQrPayload(payload: VerifyTicketPayload): string {
  return JSON.stringify({
    tokenId: payload.tokenId,
    walletAddress: payload.walletAddress,
    nonce: payload.nonce,
    expiresAt: payload.expiresAt,
  });
}
