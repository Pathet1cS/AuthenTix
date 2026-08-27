'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  Zap,
  ZapOff,
  RefreshCw,
  Volume2,
  VolumeX,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Ticket,
  Activity,
  QrCode,
  MapPin,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

// Events data for dropdown
const ORGANIZER_EVENTS = [
  'Devconnect Summit 2026',
  'CyberSonic Music Festival 2026',
  'ETH Global Tech Summit 2026'
];

// Available Gates data
const GATES = [
  'Gate 1 - Main Entrance',
  'Gate 2 - VIP North',
  'Gate 3 - Backstage / Press'
];

// Types for scan result modal
type ScanResultType = 'valid' | 'used' | 'expired' | 'unassigned' | null;

interface ScanModalData {
  type: ScanResultType;
  title: string;
  subtitle: string;
  ticketId: string;
  tier: string;
  attendee: string;
  gate: string;
  timestamp: string;
  details: string;
  reason?: string;
  walletAddress?: string;
}

// Initial recent scans feed logs
const INITIAL_SCANS = [
  {
    id: 'log-1',
    ticketId: '#1042',
    attendee: 'Alex Rivers',
    tier: 'VIP Tier',
    time: '10:24:45 AM',
    gate: 'Gate 1 - Main Entrance',
    status: 'GRANTED',
    badgeVariant: 'success' as const
  },
  {
    id: 'log-2',
    ticketId: '#1043',
    attendee: 'Sarah Jenkins',
    tier: 'General Admission',
    time: '10:24:12 AM',
    gate: 'Gate 2 - VIP North',
    status: 'ALREADY USED',
    badgeVariant: 'danger' as const
  },
  {
    id: 'log-3',
    ticketId: '#1041',
    attendee: 'Marcus Vance',
    tier: 'Speaker Pass',
    time: '10:22:30 AM',
    gate: 'Gate 1 - Main Entrance',
    status: 'GRANTED',
    badgeVariant: 'success' as const
  },
  {
    id: 'log-4',
    ticketId: '#1040',
    attendee: 'Elena Rostova',
    tier: 'VIP Tier',
    time: '10:19:05 AM',
    gate: 'Gate 1 - Main Entrance',
    status: 'EXPIRED',
    badgeVariant: 'warning' as const
  },
  {
    id: 'log-5',
    ticketId: '#9999',
    attendee: 'Unknown Wallet',
    tier: 'Unassigned',
    time: '10:15:22 AM',
    gate: 'Gate 1 - Main Entrance',
    status: 'INVALID TOKEN',
    badgeVariant: 'danger' as const
  }
];

export default function TicketScannerPage() {
  // Navigation & Gate Selection State
  const [selectedEvent, setSelectedEvent] = useState(ORGANIZER_EVENTS[0]);
  const [selectedGate, setSelectedGate] = useState(GATES[0]);
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const [isGateDropdownOpen, setIsGateDropdownOpen] = useState(false);

  // Scanner Viewfinder Controls
  const [flashlight, setFlashlight] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [isMuted, setIsMuted] = useState(false);

  // Manual Input State
  const [manualInput, setManualInput] = useState('');

  // Stats State
  const [stats, setStats] = useState({
    total: 1338,
    verified: 1314,
    rejected: 24,
    avgSpeed: '0.8s'
  });

  // Recent Scans Feed
  const [recentScans, setRecentScans] = useState(INITIAL_SCANS);

  // Modal State
  const [scanModal, setScanModal] = useState<ScanModalData | null>(null);

  // Helper to trigger scan results
  const triggerScanResult = (type: 'valid' | 'used' | 'expired' | 'unassigned', customTicketId?: string) => {
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let modalData: ScanModalData;

    if (type === 'valid') {
      const tid = customTicketId || '#1042';
      modalData = {
        type: 'valid',
        title: 'ENTRY GRANTED',
        subtitle: `Ticket ${tid} • VIP Tier • Alex Rivers`,
        ticketId: tid,
        tier: 'VIP Tier',
        attendee: 'Alex Rivers',
        gate: selectedGate,
        timestamp: nowTime,
        details: 'Dynamic TOTP Signature Valid • Blockchain Ownership Verified',
        walletAddress: '0x71C...3A9F'
      };

      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        verified: prev.verified + 1
      }));

      setRecentScans((prev) => [
        {
          id: `log-${Date.now()}`,
          ticketId: tid,
          attendee: 'Alex Rivers',
          tier: 'VIP Tier',
          time: nowTime,
          gate: selectedGate,
          status: 'GRANTED',
          badgeVariant: 'success'
        },
        ...prev
      ]);
    } else if (type === 'used') {
      const tid = customTicketId || '#1043';
      modalData = {
        type: 'used',
        title: 'ENTRY DENIED',
        subtitle: `Ticket ${tid} ALREADY USED • Scanned at Gate 2 at 18:42:10`,
        ticketId: tid,
        tier: 'General Admission',
        attendee: 'Sarah Jenkins',
        gate: selectedGate,
        timestamp: nowTime,
        details: 'Ticket double-scan prevention triggered. First verified at Gate 2 at 18:42:10.',
        reason: 'ALREADY CLAIMED'
      };

      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        rejected: prev.rejected + 1
      }));

      setRecentScans((prev) => [
        {
          id: `log-${Date.now()}`,
          ticketId: tid,
          attendee: 'Sarah Jenkins',
          tier: 'General Admission',
          time: nowTime,
          gate: selectedGate,
          status: 'ALREADY USED',
          badgeVariant: 'danger'
        },
        ...prev
      ]);
    } else if (type === 'expired') {
      const tid = customTicketId || '#1044';
      modalData = {
        type: 'expired',
        title: 'EXPIRED QR CODE',
        subtitle: 'Timestamp > 30s • Ask buyer to refresh QR code',
        ticketId: tid,
        tier: 'Regular Pass',
        attendee: 'David Chen',
        gate: selectedGate,
        timestamp: nowTime,
        details: 'Dynamic TOTP signature window expired (> 30s). Ask attendee to unlock & refresh their wallet screen.',
        reason: 'STALE QR TOTP'
      };

      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        rejected: prev.rejected + 1
      }));

      setRecentScans((prev) => [
        {
          id: `log-${Date.now()}`,
          ticketId: tid,
          attendee: 'David Chen',
          tier: 'Regular Pass',
          time: nowTime,
          gate: selectedGate,
          status: 'EXPIRED',
          badgeVariant: 'warning'
        },
        ...prev
      ]);
    } else {
      const tid = customTicketId || '#9999';
      modalData = {
        type: 'unassigned',
        title: 'INVALID TOKEN',
        subtitle: `Token ${tid} not minted for this event`,
        ticketId: tid,
        tier: 'Unassigned / Non-existent',
        attendee: 'Unknown Wallet',
        gate: selectedGate,
        timestamp: nowTime,
        details: `Token ID ${tid} does not exist on ${selectedEvent} smart contract. Potential counterfeit or wrong event ticket.`,
        reason: 'CONTRACT MISMATCH'
      };

      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        rejected: prev.rejected + 1
      }));

      setRecentScans((prev) => [
        {
          id: `log-${Date.now()}`,
          ticketId: tid,
          attendee: 'Unknown Wallet',
          tier: 'Unassigned',
          time: nowTime,
          gate: selectedGate,
          status: 'INVALID TOKEN',
          badgeVariant: 'danger'
        },
        ...prev
      ]);
    }

    setScanModal(modalData);
  };

  // Handle Manual Input Submit
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    const query = manualInput.trim();
    if (query === '#1043' || query === '1043') {
      triggerScanResult('used', '#1043');
    } else if (query === '#1044' || query === '1044') {
      triggerScanResult('expired', '#1044');
    } else if (query === '#9999' || query === '9999') {
      triggerScanResult('unassigned', '#9999');
    } else {
      triggerScanResult('valid', query.startsWith('#') || query.startsWith('0x') ? query : `#${query}`);
    }
    setManualInput('');
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-gray-100 pb-16 pt-4 px-3 sm:px-6 max-w-4xl mx-auto">
      {/* HEADER SECTION */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/organizer/dashboard"
            className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all flex items-center justify-center shrink-0"
            title="Back to Organizer Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Gate Verification Scanner
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono">Mobile-First High Performance Verification</p>
          </div>
        </div>

        {/* Dropdowns for Event & Gate */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/90 border border-gray-800 text-xs font-medium text-emerald-400 hover:bg-gray-800/90 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="max-w-[150px] truncate">{selectedEvent}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {isEventDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                {ORGANIZER_EVENTS.map((evt) => (
                  <button
                    key={evt}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setIsEventDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${
                      selectedEvent === evt ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span className="truncate">{evt}</span>
                    {selectedEvent === evt && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gate Selector Dropdown Indicator */}
          <div className="relative">
            <button
              onClick={() => setIsGateDropdownOpen(!isGateDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{selectedGate}</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            {isGateDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                {GATES.map((gate) => (
                  <button
                    key={gate}
                    onClick={() => {
                      setSelectedGate(gate);
                      setIsGateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${
                      selectedGate === gate ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span>{gate}</span>
                    {selectedGate === gate && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT / TOP COLUMN: VIEWFINDER & CONTROLS & TEST SIMULATIONS */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* CAMERA VIEWFINDER CARD */}
          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl overflow-hidden shadow-2xl relative">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center">
              {/* Viewfinder Frame Viewport */}
              <div className="w-full relative aspect-[4/3] bg-slate-950/90 rounded-2xl border border-gray-800/90 overflow-hidden flex items-center justify-center shadow-inner">
                {/* Simulated Camera Video Background Grid Patterns */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `radial-gradient(#10b981 0.75px, transparent 0.75px)`,
                    backgroundSize: '16px 16px'
                  }}
                />

                {/* Top Viewfinder Badge Indicator */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-black/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-emerald-500/40 text-emerald-400 text-[11px] font-mono flex items-center gap-2 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                    <span>Live Viewfinder • 60 FPS</span>
                  </div>
                </div>

                {/* Target Corners (Neon Emerald) */}
                <div className="absolute top-4 left-4 w-9 h-9 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg shadow-[0_0_10px_#10b981]" />
                <div className="absolute top-4 right-4 w-9 h-9 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg shadow-[0_0_10px_#10b981]" />
                <div className="absolute bottom-4 left-4 w-9 h-9 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg shadow-[0_0_10px_#10b981]" />
                <div className="absolute bottom-4 right-4 w-9 h-9 border-b-4 border-r-4 border-emerald-500 rounded-br-lg shadow-[0_0_10px_#10b981]" />

                {/* Animated Vertical Laser Scanning Line (Framer Motion) */}
                <motion.div
                  animate={{ y: ['-110px', '110px', '-110px'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_#10b981] z-10"
                />

                {/* Center Scanning Guide Reticle */}
                <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                  <QrCode className="w-16 h-16 text-emerald-400/40 animate-pulse mb-2" />
                  <p className="text-xs font-mono text-emerald-300/70 tracking-wider uppercase">
                    Align AuthenTix QR inside frame
                  </p>
                </div>

                {/* Flashlight Indicator Effect Overlay */}
                {flashlight && (
                  <div className="absolute inset-0 bg-amber-400/10 pointer-events-none backdrop-brightness-125 z-0" />
                )}
              </div>

              {/* Viewfinder Controls Bar */}
              <div className="w-full mt-4 flex items-center justify-around gap-2 bg-gray-950/80 p-2 rounded-xl border border-gray-800">
                {/* Flashlight Toggle */}
                <button
                  onClick={() => setFlashlight(!flashlight)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 border ${
                    flashlight
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-800'
                  }`}
                >
                  {flashlight ? <Zap className="w-4 h-4 text-amber-400 fill-amber-400" /> : <ZapOff className="w-4 h-4 text-gray-400" />}
                  <span>Flashlight</span>
                </button>

                {/* Camera Switch Button */}
                <button
                  onClick={() => setCameraFacing(cameraFacing === 'back' ? 'front' : 'back')}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-medium bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  <span>{cameraFacing === 'back' ? 'Rear Cam' : 'Front Cam'}</span>
                </button>

                {/* Mute Audio Toggle */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 border ${
                    isMuted
                      ? 'bg-red-500/15 text-red-300 border-red-500/30'
                      : 'bg-gray-900 hover:bg-gray-800 text-emerald-400 border-gray-800'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  <span>{isMuted ? 'Muted' : 'Audio On'}</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* MANUAL INPUT FALLBACK CARD */}
          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-400" />
                  Manual Token Verification Fallback
                </h3>
                <span className="text-[10px] text-gray-500 font-mono">Token ID / Wallet Hash</span>
              </div>

              <form onSubmit={handleManualSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Enter Token ID (e.g. #1042 or 0x71C...3A9F)"
                    className="w-full bg-slate-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all"
                  />
                  {manualInput && (
                    <button
                      type="button"
                      onClick={() => setManualInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Button type="submit" variant="primary" className="text-xs py-2 px-4 shrink-0 font-semibold">
                  Verify
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* INTERACTIVE SCAN SIMULATION BUTTONS */}
          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Interactive Scan Simulations (UI Testing)
                </h3>
                <Badge variant="web3" className="text-[10px]">Gate Simulator</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Valid QR Button */}
                <button
                  onClick={() => triggerScanResult('valid')}
                  className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">Test Valid QR</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-1">ENTRY GRANTED • #1042 • VIP Tier</p>
                </button>

                {/* Already Used QR Button */}
                <button
                  onClick={() => triggerScanResult('used')}
                  className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-red-400 group-hover:text-red-300">Test Already Used</span>
                    <XCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-1">ENTRY DENIED • #1043 ALREADY USED</p>
                </button>

                {/* Expired QR Button */}
                <button
                  onClick={() => triggerScanResult('expired')}
                  className="p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300">Test Expired QR</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-1">EXPIRED QR • Timestamp &gt; 30s</p>
                </button>

                {/* Unassigned Token Button */}
                <button
                  onClick={() => triggerScanResult('unassigned')}
                  className="p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-rose-400 group-hover:text-rose-300">Test Unassigned</span>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-1">INVALID TOKEN • Token #9999</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT / BOTTOM COLUMN: LIVE SESSION GATE STATS & RECENT SCANS FEED */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* LIVE SESSION GATE STATS GRID */}
          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Live Session Gate Stats
                </h3>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  Active Shift
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Total Scanned */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-gray-800/80">
                  <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Total Scanned Today</p>
                  <p className="text-2xl font-bold text-white font-mono">{stats.total.toLocaleString()}</p>
                </div>

                {/* Verified */}
                <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-400 uppercase font-medium mb-0.5">Verified</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.verified.toLocaleString()}</p>
                </div>

                {/* Rejected */}
                <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/20">
                  <p className="text-[10px] text-red-400 uppercase font-medium mb-0.5">Rejected</p>
                  <p className="text-2xl font-bold text-red-400 font-mono">{stats.rejected}</p>
                </div>

                {/* Avg Speed */}
                <div className="bg-cyan-500/5 p-3 rounded-xl border border-cyan-500/20">
                  <p className="text-[10px] text-cyan-400 uppercase font-medium mb-0.5">Avg Scan Speed</p>
                  <p className="text-2xl font-bold text-cyan-400 font-mono">{stats.avgSpeed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RECENT SCANS FEED */}
          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl flex-1 flex flex-col min-h-[380px]">
            <CardContent className="p-4 sm:p-5 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Recent Scans Feed
                </h3>
                <span className="text-[10px] text-gray-500 font-mono">{recentScans.length} Entries</span>
              </div>

              {/* Scrollable Feed List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[420px] pr-1 scrollbar-thin scrollbar-thumb-gray-800">
                {recentScans.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-gray-800/80 hover:border-gray-700 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        log.status === 'GRANTED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : log.status === 'EXPIRED'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        <Ticket className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">{log.ticketId}</span>
                          <span className="text-[11px] text-gray-400 truncate">• {log.attendee}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{log.tier} • {log.gate}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <Badge variant={log.badgeVariant} className="text-[10px] py-0 px-2">
                        {log.status}
                      </Badge>
                      <span className="text-[10px] text-gray-500 font-mono mt-1">{log.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SCAN RESULT MODAL OVERLAY */}
      <AnimatePresence>
        {scanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl relative overflow-hidden ${
                scanModal.type === 'valid'
                  ? 'bg-slate-950 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.25)]'
                  : scanModal.type === 'used'
                  ? 'bg-slate-950 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.25)]'
                  : scanModal.type === 'expired'
                  ? 'bg-slate-950 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-950 border-rose-600/50 shadow-[0_0_40px_rgba(225,29,72,0.25)]'
              }`}
            >
              {/* Status Header Badge / Icon */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 border ${
                  scanModal.type === 'valid'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_20px_#10b981]'
                    : scanModal.type === 'used'
                    ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_20px_#ef4444]'
                    : scanModal.type === 'expired'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_20px_#f59e0b]'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_20px_#e11d48]'
                }`}>
                  {scanModal.type === 'valid' && <CheckCircle2 className="w-10 h-10" />}
                  {scanModal.type === 'used' && <XCircle className="w-10 h-10" />}
                  {scanModal.type === 'expired' && <AlertTriangle className="w-10 h-10" />}
                  {scanModal.type === 'unassigned' && <ShieldAlert className="w-10 h-10" />}
                </div>

                <h2 className={`text-2xl font-black tracking-wider ${
                  scanModal.type === 'valid'
                    ? 'text-emerald-400'
                    : scanModal.type === 'used'
                    ? 'text-red-400'
                    : scanModal.type === 'expired'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}>
                  {scanModal.title}
                </h2>
                <p className="text-xs text-gray-300 font-medium mt-1">{scanModal.subtitle}</p>
              </div>

              {/* Information Detail Card */}
              <div className="bg-gray-900/90 rounded-xl p-4 border border-gray-800 text-xs space-y-2.5 mb-6">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Ticket ID</span>
                  <span className="font-mono font-bold text-white">{scanModal.ticketId}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Tier / Access</span>
                  <span className="font-semibold text-emerald-300">{scanModal.tier}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Attendee</span>
                  <span className="text-white">{scanModal.attendee}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <span className="text-gray-400">Gate / Scanner</span>
                  <span className="text-gray-300">{scanModal.gate}</span>
                </div>
                {scanModal.walletAddress && (
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <span className="text-gray-400">Wallet</span>
                    <span className="font-mono text-gray-300">{scanModal.walletAddress}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-400 block mb-1">System Verification Output</span>
                  <p className="text-gray-300 bg-slate-950 p-2 rounded border border-gray-800 font-mono text-[11px] leading-relaxed">
                    {scanModal.details}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setScanModal(null)}
                  variant={scanModal.type === 'valid' ? 'primary' : 'secondary'}
                  className="w-full py-2.5 font-bold text-xs"
                >
                  Dismiss & Scan Next Ticket
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
