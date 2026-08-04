import { z } from 'zod';

export const loginPayloadSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'address must be a 0x-prefixed 20-byte hex string'),
    email: z.string().email('email must be a valid email address'),
    name: z.string().min(1, 'name is required'),
    nonce: z.string().min(1, 'nonce is required'),
    issuedAt: z.string().datetime('issuedAt must be an ISO 8601 datetime'),
    expiresAt: z.string().datetime('expiresAt must be an ISO 8601 datetime'),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    payload: loginPayloadSchema,
    signature: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/, 'signature must be a 0x-prefixed hex string'),
  })
  .strict();

export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * Produces the exact string the wallet signs. Key order is fixed here and must
 * be mirrored by the frontend; this function is the specification for it.
 */
export function serializeLoginPayload(payload: LoginPayload): string {
  return JSON.stringify({
    address: payload.address,
    email: payload.email,
    name: payload.name,
    nonce: payload.nonce,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
}
