'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ThirdwebProvider, useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { getUserEmail } from 'thirdweb/wallets';
import { client } from '@/lib/thirdweb';
import { exchangeLogin } from '@/lib/auth/exchangeLogin';
import {
  clearToken,
  decodeSession,
  isSessionValidFor,
  loadToken,
  saveToken,
  type Session,
} from '@/lib/auth/session';

type AuthStatus = 'signed-out' | 'signing-in' | 'signed-in';

type AuthContextValue = {
  session: Session | null;
  status: AuthStatus;
  error: string | null;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <AuthState>{children}</AuthState>
    </ThirdwebProvider>
  );
}

function AuthState({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('signed-out');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No account: don't clear the stored token — auto-connect may still be resolving.
    if (!account) {
      setSession(null);
      setStatus('signed-out');
      return;
    }

    const stored = decodeSession(loadToken() ?? '');
    if (isSessionValidFor(stored, account.address, Date.now())) {
      setSession(stored);
      setStatus('signed-in');
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus('signing-in');
    setError(null);
    (async () => {
      try {
        const email = await getUserEmail({ client });
        if (!email) throw new Error('This wallet has no email; sign in with email or Google');
        const token = await exchangeLogin({
          account,
          email,
          domain: window.location.host,
          apiUrl: process.env.NEXT_PUBLIC_API_URL!,
        });
        if (cancelled) return;
        saveToken(token);
        setSession(decodeSession(token));
        setStatus('signed-in');
      } catch (err) {
        if (cancelled) return;
        clearToken();
        setSession(null);
        setStatus('signed-out');
        setError(err instanceof Error ? err.message : 'Sign-in failed');
        if (wallet) disconnect(wallet);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run only when the connected address changes; wallet/disconnect identity churn must not re-trigger signing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  const logout = useCallback(() => {
    clearToken();
    setSession(null);
    setStatus('signed-out');
    setError(null);
    if (wallet) disconnect(wallet);
  }, [wallet, disconnect]);

  return (
    <AuthContext.Provider value={{ session, status, error, logout }}>{children}</AuthContext.Provider>
  );
}
