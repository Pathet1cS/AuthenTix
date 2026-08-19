import { z } from 'zod';

/**
 * Human-readable text the wallet UI displays so the signer can see what they
 * are agreeing to. The server pins it, so a hostile dApp cannot substitute its
 * own wording while collecting a signature that is valid here.
 */
export const LOGIN_STATEMENT = 'Sign in to AuthenTix';

export const loginPayloadSchema = z
  .object({
    // Domain binding (EIP-4361 / SIWE): without it, a signature harvested by any
    // other dApp the victim signs into would be replayable against this API.
    domain: z
      .string()
      .min(1, 'domain is required')
      .max(253, 'domain must be at most 253 characters'),
    statement: z
      .string()
      .min(1, 'statement is required')
      .max(200, 'statement must be at most 200 characters'),
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'address must be a 0x-prefixed 20-byte hex string'),
    email: z
      .string()
      .email('email must be a valid email address')
      .max(254, 'email must be at most 254 characters'),
    name: z.string().min(1, 'name is required').max(100, 'name must be at most 100 characters'),
    nonce: z
      .string()
      .min(1, 'nonce is required')
      .max(128, 'nonce must be at most 128 characters'),
    issuedAt: z.string().datetime('issuedAt must be an ISO 8601 datetime'),
    expiresAt: z.string().datetime('expiresAt must be an ISO 8601 datetime'),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    payload: loginPayloadSchema,
    signature: z
      .string()
      // Whole bytes only, and bounded: a malformed signature otherwise falls
      // through to the on-chain ERC-6492 check, which costs billed RPC calls.
      .regex(/^0x([a-fA-F0-9]{2})+$/, 'signature must be a 0x-prefixed even-length hex string')
      .max(10000, 'signature must be at most 10000 characters'),
  })
  .strict();

export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * Produces the exact string the wallet signs. Key order is fixed here and must
 * be mirrored by the frontend; this function is the specification for it.
 * `domain` leads so the binding is the first thing in the signed text.
 */
export function serializeLoginPayload(payload: LoginPayload): string {
  return JSON.stringify({
    domain: payload.domain,
    statement: payload.statement,
    address: payload.address,
    email: payload.email,
    name: payload.name,
    nonce: payload.nonce,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
}
