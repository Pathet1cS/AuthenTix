'use client';

import { ConnectButton } from 'thirdweb/react';
import { Shield, Store, User } from 'lucide-react';
import { chain, client, wallets } from '@/lib/thirdweb';
import type { Role } from '@/lib/auth/session';
import { useAuth } from './AuthProvider';

const rolesConfig: Record<Role, { label: string; icon: typeof User; color: string }> = {
  buyer: { label: 'Buyer', icon: User, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  organizer: { label: 'Organizer', icon: Store, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  admin: { label: 'Admin', icon: Shield, color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
};

export function WalletButton() {
  const { session, status, error, logout } = useAuth();
  const role = session ? rolesConfig[session.role] : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {role && (
        <span
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border ${role.color}`}
        >
          <role.icon className="w-3.5 h-3.5" />
          {role.label}
        </span>
      )}
      {status === 'signing-in' && <span className="text-xs text-slate-400">Signing in…</span>}
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
      <ConnectButton
        client={client}
        chain={chain}
        wallets={wallets}
        theme="dark"
        connectButton={{ label: 'Sign In' }}
        onDisconnect={logout}
      />
    </div>
  );
}
