'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Plus,
  QrCode,
  DollarSign,
  Ticket,
  UserCheck,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
  Clock,
  MapPin,
  Sparkles,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Eye,
  Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

// Sample Organizer Events Data
const ORGANIZER_EVENTS = [
  {
    id: 'evt-1',
    title: 'CyberSonic Music Festival 2026',
    category: 'Music & Concerts',
    status: 'LIVE' as const,
    date: 'Sep 15, 2026 • 18:00',
    venue: 'Cyber Dome Stadium, Jakarta',
    posterUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    ticketsSold: 850,
    totalCapacity: 900,
    revenueEth: 8.5,
    revenueUsd: 28900,
    contractAddress: '0x742d...f44e'
  },
  {
    id: 'evt-2',
    title: 'ETH Global Tech Summit 2026',
    category: 'Web3 & Tech Summit',
    status: 'LIVE' as const,
    date: 'Oct 02, 2026 • 09:00',
    venue: 'Grand Convention Center, Jakarta',
    posterUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80',
    ticketsSold: 420,
    totalCapacity: 450,
    revenueEth: 4.2,
    revenueUsd: 14280,
    contractAddress: '0x39A1...89C2'
  },
  {
    id: 'evt-3',
    title: 'Apex Web3 Gaming Arena Finals',
    category: 'Esports & Gaming',
    status: 'DRAFT' as const,
    date: 'Nov 12, 2026 • 14:00',
    venue: 'Esports Megaplex, Bandung',
    posterUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
    ticketsSold: 0,
    totalCapacity: 200,
    revenueEth: 0,
    revenueUsd: 0,
    contractAddress: 'Pending Deploy'
  },
  {
    id: 'evt-4',
    title: 'Neo-Tokyo NFT Art Expo',
    category: 'Art Expo & Parties',
    status: 'COMPLETED' as const,
    date: 'Jul 20, 2026 • 19:00',
    venue: 'Digital Art Gallery, Bali',
    posterUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    ticketsSold: 150,
    totalCapacity: 150,
    revenueEth: 1.5,
    revenueUsd: 5100,
    contractAddress: '0x99B4...33E1'
  }
];

// Sample Live Check-ins Feed Data
const RECENT_CHECKINS = [
  {
    id: 'chk-1042',
    ticketId: '#1042',
    tier: 'VIP Golden Access',
    wallet: '0x8F3...9A12',
    timeAgo: '2m ago',
    gate: 'Door 1 North',
    status: 'VERIFIED'
  },
  {
    id: 'chk-1041',
    ticketId: '#1041',
    tier: 'General Admission',
    wallet: '0x3A1...4B71',
    timeAgo: '5m ago',
    gate: 'Main Entrance A',
    status: 'VERIFIED'
  },
  {
    id: 'chk-1040',
    ticketId: '#1040',
    tier: 'VIP Golden Access',
    wallet: '0x1C9...8E42',
    timeAgo: '8m ago',
    gate: 'Door 2 East',
    status: 'VERIFIED'
  },
  {
    id: 'chk-1039',
    ticketId: '#1039',
    tier: 'General Admission',
    wallet: '0x9D4...2F10',
    timeAgo: '12m ago',
    gate: 'Main Entrance B',
    status: 'VERIFIED'
  },
  {
    id: 'chk-1038',
    ticketId: '#1038',
    tier: 'Early Bird Pass',
    wallet: '0x7E2...1C59',
    timeAgo: '15m ago',
    gate: 'Main Entrance A',
    status: 'VERIFIED'
  }
];

export default function OrganizerDashboardPage() {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'LIVE' | 'DRAFT' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = ORGANIZER_EVENTS.filter((evt) => {
    const matchesFilter = selectedFilter === 'ALL' || evt.status === selectedFilter;
    const matchesSearch =
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.venue.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-gray-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> ORGANIZER STUDIO
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Event Management & Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Monitor real-time primary sales, track venue gate attendance, and manage your Web3 NFT contracts.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/organizer/scanner">
            <Button
              variant="outline"
              size="md"
              icon={<QrCode className="w-4 h-4 text-emerald-400" />}
            >
              Open Ticket Scanner
            </Button>
          </Link>
          <Link href="/organizer/events/new">
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
            >
              Create New Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Analytics Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Revenue */}
        <Card className="bg-[#0B0F17]/90 border border-emerald-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Total Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-white font-mono">$48,250</h2>
              <p className="text-xs text-emerald-400 font-mono font-semibold mt-0.5">
                14.2 ETH Total Volume
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% vs last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Sold */}
        <Card className="bg-[#0B0F17]/90 border border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Tickets Sold
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Ticket className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-white font-mono">1,420 <span className="text-sm text-gray-500 font-normal">/ 1,500</span></h2>
              <p className="text-xs text-teal-400 font-mono font-semibold mt-0.5">
                94.6% Sales Rate
              </p>
            </div>
            {/* Sales Progress Bar */}
            <div className="mt-3 w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full w-[94.6%] rounded-full" />
            </div>
          </CardContent>
        </Card>

        {/* Attendance Rate */}
        <Card className="bg-[#0B0F17]/90 border border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Gate Attendance Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-white font-mono">94.2%</h2>
              <p className="text-xs text-cyan-400 font-mono font-semibold mt-0.5">
                1,338 Scanned at Gate
              </p>
            </div>
            <div className="mt-3 text-[11px] text-gray-400">
              Anti-fraud scan validation active
            </div>
          </CardContent>
        </Card>

        {/* Active Events */}
        <Card className="bg-[#0B0F17]/90 border border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Total Events
              </span>
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-white font-mono">4 Events</h2>
              <p className="text-xs text-violet-300 font-mono mt-0.5">
                2 Live • 1 Draft • 1 Done
              </p>
            </div>
            <div className="mt-3 text-[11px] text-gray-400">
              Optimism Sepolia Contracts
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Event Management & Live Gate Check-ins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Event Management Table / Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0B0F17]/90 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" /> Event Contracts
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Manage primary sales, view metadata, and check event status.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-gray-900/80 p-1 rounded-xl border border-gray-800 text-xs font-medium">
                {(['ALL', 'LIVE', 'DRAFT', 'COMPLETED'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      selectedFilter === tab
                        ? 'bg-emerald-500 text-gray-950 font-bold shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Event Items List */}
            <div className="space-y-4">
              {filteredEvents.map((evt) => {
                const salesPercent = ((evt.ticketsSold / evt.totalCapacity) * 100).toFixed(0);

                return (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900/60 hover:bg-gray-900 border border-gray-800/80 hover:border-emerald-500/40 rounded-2xl p-4 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-800 bg-gray-950">
                        <Image
                          src={evt.posterUrl}
                          alt={evt.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {evt.status === 'LIVE' && (
                            <Badge variant="success" showDot className="text-[10px]">
                              LIVE
                            </Badge>
                          )}
                          {evt.status === 'DRAFT' && (
                            <Badge variant="neutral" className="text-[10px]">
                              DRAFT
                            </Badge>
                          )}
                          {evt.status === 'COMPLETED' && (
                            <Badge variant="web3" className="text-[10px]">
                              COMPLETED
                            </Badge>
                          )}
                          <span className="text-[11px] text-gray-400 font-mono">
                            {evt.category}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                          {evt.title}
                        </h3>
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-500" /> {evt.date}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Sales & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-gray-800/80 pt-3 sm:pt-0">
                      <div className="text-right min-w-[120px]">
                        <div className="text-xs font-mono text-white font-bold">
                          {evt.ticketsSold} / {evt.totalCapacity} <span className="text-gray-500 text-[10px]">({salesPercent}%)</span>
                        </div>
                        <div className="w-24 bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1 ml-auto">
                          <div
                            className="bg-emerald-400 h-full rounded-full"
                            style={{ width: `${salesPercent}%` }}
                          />
                        </div>
                        <p className="text-[11px] font-mono text-emerald-400 font-bold mt-1">
                          {evt.revenueEth} ETH (${evt.revenueUsd.toLocaleString()})
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {evt.status === 'DRAFT' ? (
                          <Link href="/organizer/events/new">
                            <Button variant="outline" size="sm" icon={<Edit3 className="w-3.5 h-3.5" />}>
                              Edit
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/events`}>
                            <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5 text-gray-400" />}>
                              View
                            </Button>
                          </Link>
                        )}
                        <Link href="/organizer/scanner">
                          <Button variant="outline" size="sm" icon={<QrCode className="w-3.5 h-3.5 text-emerald-400" />}>
                            Scan
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Check-ins Feed */}
        <div className="space-y-6">
          <div className="bg-[#0B0F17]/90 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-400" /> Recent Gate Scans
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Live verification stream at venue entrances
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </div>
            </div>

            {/* Checkins List */}
            <div className="space-y-3">
              {RECENT_CHECKINS.map((chk) => (
                <div
                  key={chk.id}
                  className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-3.5 hover:border-gray-700 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {chk.ticketId}
                      </span>
                      <Badge variant="success" showDot className="text-[10px] py-0 px-2">
                        {chk.status}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-gray-500 font-mono">{chk.timeAgo}</span>
                  </div>

                  <p className="text-xs font-bold text-white">{chk.tier}</p>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mt-1.5 pt-1.5 border-t border-gray-800/60">
                    <span>{chk.gate}</span>
                    <span className="text-gray-500">{chk.wallet}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center">
              <Link href="/organizer/scanner" className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1 font-semibold">
                Launch Full Screen QR Scanner <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
