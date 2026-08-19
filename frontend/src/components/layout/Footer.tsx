import Link from 'next/link';
import { Ticket, Github, Twitter, Disc as Discord, BookOpen, ShieldCheck, Activity } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-[#07090E] text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-md shadow-emerald-500/20">
                <div className="w-full h-full bg-[#07090E] rounded-[6px] flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                AuthenTix
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Next-generation Web3 ticketing platform with anti-scalping smart contracts, dynamic QR verification, and fair price resale ceiling.
            </p>

            {/* Optimism Sepolia Testnet Status Badge */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold">Optimism Sepolia</span>
                <span className="text-slate-500">|</span>
                <span className="text-emerald-300/80">Active</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-emerald-400 transition-colors">
                  Explore Events
                </Link>
              </li>
              <li>
                <Link href="/resale" className="hover:text-emerald-400 transition-colors">
                  Resale Marketplace
                </Link>
              </li>
              <li>
                <Link href="/my-tickets" className="hover:text-emerald-400 transition-colors">
                  My Tickets
                </Link>
              </li>
              <li>
                <Link href="/organizer/dashboard" className="hover:text-emerald-400 transition-colors">
                  Organizer Studio
                </Link>
              </li>
              <li>
                <Link href="/admin/dashboard" className="hover:text-emerald-400 transition-colors">
                  Admin Monitor
                </Link>
              </li>
            </ul>
          </div>

          {/* Web3 & Architecture */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Resources & Specs
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#docs" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  Documentation
                </a>
              </li>
              <li>
                <a href="#contracts" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  Smart Contracts Specs
                </a>
              </li>
              <li>
                <a href="#status" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                  <Activity className="w-3.5 h-3.5 text-slate-500" />
                  Network Health
                </a>
              </li>
            </ul>
          </div>

          {/* Socials & Community */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Community
            </h4>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
                aria-label="Discord"
              >
                <Discord className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} AuthenTix Web3 Protocol. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-400 transition-colors">Terms of Service</a>
            <a href="#security" className="hover:text-slate-400 transition-colors">Security Disclosure</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
