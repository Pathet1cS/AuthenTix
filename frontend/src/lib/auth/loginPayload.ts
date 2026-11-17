// Mirrors backend/src/features/auth/auth.schema.ts — the backend verifies the
// signature over its own re-serialisation, so field set and key order must match.

export const LOGIN_STATEMENT = 'Sign in to AuthenTix';
const VALIDITY_MS = 5 * 60 * 1000; // backend max validity window
const MAX_NAME_LENGTH = 100;

export type LoginPayload = {
  domain: string;
  statement: string;
  address: string;
  email: string;
  name: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export function nameFromEmail(email: string): string {
  return email.split('@')[0].slice(0, MAX_NAME_LENGTH) || 'AuthenTix User';
}

export function buildLoginPayload(args: {
  address: string;
  email: string;
  domain: string;
  nonce: string;
  now: Date;
}): LoginPayload {
  return {
    domain: args.domain,
    statement: LOGIN_STATEMENT,
    address: args.address,
    email: args.email,
    name: nameFromEmail(args.email),
    nonce: args.nonce,
    issuedAt: args.now.toISOString(),
    expiresAt: new Date(args.now.getTime() + VALIDITY_MS).toISOString(),
  };
}

export function serializeLoginPayload(p: LoginPayload): string {
  return JSON.stringify({
    domain: p.domain,
    statement: p.statement,
    address: p.address,
    email: p.email,
    name: p.name,
    nonce: p.nonce,
    issuedAt: p.issuedAt,
    expiresAt: p.expiresAt,
  });
}
