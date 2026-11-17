// Client-side view of the backend JWT. Decoded for display and reuse checks
// only; the signature is never verified here — the backend stays the authority.

export type Role = 'buyer' | 'organizer' | 'admin';

export type Session = {
  token: string;
  userId: string;
  walletAddress: string;
  role: Role;
  expiresAt: number; // ms since epoch
};

const ROLES: readonly string[] = ['buyer', 'organizer', 'admin'];
const STORAGE_KEY = 'authentix.jwt';

export function decodeSession(token: string): Session | null {
  try {
    const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '=')));
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.walletAddress !== 'string' ||
      !ROLES.includes(claims.role) ||
      typeof claims.exp !== 'number'
    ) {
      return null;
    }
    return {
      token,
      userId: claims.sub,
      walletAddress: claims.walletAddress,
      role: claims.role,
      expiresAt: claims.exp * 1000,
    };
  } catch {
    return null;
  }
}

export function isSessionValidFor(s: Session | null, address: string, nowMs: number): boolean {
  return (
    s !== null &&
    s.expiresAt > nowMs &&
    s.walletAddress.toLowerCase() === address.toLowerCase()
  );
}

// localStorage can throw (private mode, blocked storage); a failure means "no session".
export function loadToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignored: session just won't survive a reload
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignored
  }
}
