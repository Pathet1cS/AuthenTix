'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Wallet,
  ChevronDown,
  Shield,
  Store,
  User,
  Menu,
  X,
  Check,
} from 'lucide-react';

export type UserRole = 'Buyer' | 'Organizer' | 'Admin';

const navItems = [
  { name: 'Explore Events', href: '/' },
  { name: 'Resale Marketplace', href: '/resale' },
  { name: 'My Tickets', href: '/my-tickets' },
  { name: 'Organizer Studio', href: '/organizer/dashboard' },
  { name: 'Admin Monitor', href: '/admin/dashboard' },
];

const rolesConfig: Record<UserRole, { label: string; icon: typeof User; color: string }> = {
  Buyer: { label: 'Buyer', icon: User, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  Organizer: { label: 'Organizer', icon: Store, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  Admin: { label: 'Admin', icon: Shield, color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
};

export function Navbar() {
  const pathname = usePathname();
  const [activeRole, setActiveRole] = useState<UserRole>('Buyer');
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(true);

  const walletAddress = '0x71C...3A9F';

  const CurrentRoleIcon = rolesConfig[activeRole].icon;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#07090E]/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all duration-300">
              <div className="w-full h-full bg-[#07090E] rounded-[10px] flex items-center justify-center">
                <Ticket className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              AuthenTix
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-full border border-slate-800/80">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Role Switcher Preview Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 ${rolesConfig[activeRole].color}`}
              >
                <CurrentRoleIcon className="w-3.5 h-3.5" />
                <span>{activeRole} View</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRoleMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isRoleMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-44 rounded-xl bg-[#0B0F17] border border-slate-800 shadow-2xl p-1.5 z-50"
                  >
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Role Preview Mode
                    </div>
                    {(Object.keys(rolesConfig) as UserRole[]).map((role) => {
                      const Icon = rolesConfig[role].icon;
                      const isSelected = activeRole === role;
                      return (
                        <button
                          key={role}
                          onClick={() => {
                            setActiveRole(role);
                            setIsRoleMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-slate-800/80 text-white font-medium'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{role}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Connect Wallet Button */}
            <button
              onClick={() => setIsWalletConnected(!isWalletConnected)}
              className="relative group overflow-hidden rounded-full p-[1px] font-medium text-xs transition-all duration-300 focus:outline-none"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 rounded-full group-hover:opacity-90 transition-opacity" />
              <div className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-[#07090E]/90 group-hover:bg-transparent transition-colors duration-300 text-white font-medium">
                <Wallet className="w-4 h-4 text-violet-400 group-hover:text-white transition-colors" />
                {isWalletConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-violet-200 group-hover:text-white">{walletAddress}</span>
                  </div>
                ) : (
                  <span>Connect Wallet</span>
                )}
              </div>
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-b border-slate-800 bg-[#07090E] px-4 pt-2 pb-6 space-y-4"
          >
            <div className="flex flex-col space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-slate-800/80 text-emerald-400 font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
              {/* Mobile Role Switcher */}
              <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium px-2">Role Preview:</span>
                <div className="flex gap-1">
                  {(Object.keys(rolesConfig) as UserRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => setActiveRole(role)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                        activeRole === role
                          ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Wallet Button */}
              <button
                onClick={() => setIsWalletConnected(!isWalletConnected)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20"
              >
                <Wallet className="w-4 h-4" />
                {isWalletConnected ? `Connected (${walletAddress})` : 'Connect Wallet'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
