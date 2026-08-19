'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  RefreshCw,
  Download,
  Activity,
  Database,
  Cloud,
  Wallet,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Radio,
  Sparkles,
  Layers,
  ArrowUpRight,
  Cpu,
  Server,
  HardDrive,
  Clock,
  Filter,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

// Audit Log Entry Interface
interface AuditLog {
  id: string;
  txHash: string;
  type: 'MINT' | 'TRANSFER' | 'RESALE' | 'VERIFY';
  tokenId: string;
  fromAddress: string;
  toAddress: string;
  priceEth: string;
  timestamp: string;
  blockNumber: number;
  explorerUrl: string;
}

// Initial Mock Audit Log Data (12 entries for realistic pagination & filtering)
const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    txHash: '0x8f3a91b4c2e1059f77d34b12aaef8910bc44321949102834bfe9910d8a7c29e1',
    type: 'MINT',
    tokenId: '#1042',
    fromAddress: '0x0000000000000000000000000000000000000000',
    toAddress: '0x71C8A9F32104B991E0942851C81109923F403A9F',
    priceEth: '0.050',
    timestamp: '2026-08-19 10:24:12',
    blockNumber: 18492014,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x8f3a91b4c2e1059f77d34b12aaef8910bc44321949102834bfe9910d8a7c29e1',
  },
  {
    id: 'log-2',
    txHash: '0x3d7b82f9104c882e11940b52cc89410ef749102834bfe9910d8a7c29e10014f',
    type: 'VERIFY',
    tokenId: '#1042',
    fromAddress: '0x71C8A9F32104B991E0942851C81109923F403A9F',
    toAddress: '0x892F3A17B8c24E91d4021200E6482143B1400A14',
    priceEth: '0.000',
    timestamp: '2026-08-19 10:22:45',
    blockNumber: 18492008,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x3d7b82f9104c882e11940b52cc89410ef749102834bfe9910d8a7c29e10014f',
  },
  {
    id: 'log-3',
    txHash: '0x7a2e9104b119284c88102efb64a10049281048291048201948291048291048b',
    type: 'RESALE',
    tokenId: '#1039',
    fromAddress: '0x3A194C2B10489104C28194019481049104821049',
    toAddress: '0x9D41049281048201948291048291048b28104829',
    priceEth: '0.075',
    timestamp: '2026-08-19 10:18:03',
    blockNumber: 18491985,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x7a2e9104b119284c88102efb64a10049281048291048201948291048291048b',
  },
  {
    id: 'log-4',
    txHash: '0x1c98e421049281048201948291048291048b281048291048291048b91048102e',
    type: 'TRANSFER',
    tokenId: '#1038',
    fromAddress: '0x7E21C591048291048201948291048291048b2810',
    toAddress: '0x1C98E421049281048201948291048291048b2810',
    priceEth: '0.000',
    timestamp: '2026-08-19 10:15:20',
    blockNumber: 18491972,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x1c98e421049281048201948291048291048b281048291048291048b91048102e',
  },
  {
    id: 'log-5',
    txHash: '0x99b433e1049281048201948291048291048b281048291048291048b910482014',
    type: 'MINT',
    tokenId: '#1041',
    fromAddress: '0x0000000000000000000000000000000000000000',
    toAddress: '0x3A194C2B10489104C28194019481049104821049',
    priceEth: '0.050',
    timestamp: '2026-08-19 10:12:11',
    blockNumber: 18491950,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x99b433e1049281048201948291048291048b281048291048291048b910482014',
  },
  {
    id: 'log-6',
    txHash: '0x5e2a1048291048201948291048291048b281048291048291048b910482014902',
    type: 'VERIFY',
    tokenId: '#1040',
    fromAddress: '0x1C98E421049281048201948291048291048b2810',
    toAddress: '0x892F3A17B8c24E91d4021200E6482143B1400A14',
    priceEth: '0.000',
    timestamp: '2026-08-19 10:08:54',
    blockNumber: 18491932,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x5e2a1048291048201948291048291048b281048291048291048b910482014902',
  },
  {
    id: 'log-7',
    txHash: '0x44f1048291048201948291048291048b281048291048291048b910482014901f',
    type: 'MINT',
    tokenId: '#1040',
    fromAddress: '0x0000000000000000000000000000000000000000',
    toAddress: '0x1C98E421049281048201948291048291048b2810',
    priceEth: '0.050',
    timestamp: '2026-08-19 10:01:30',
    blockNumber: 18491890,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x44f1048291048201948291048291048b281048291048291048b910482014901f',
  },
  {
    id: 'log-8',
    txHash: '0x22c1048291048201948291048291048b281048291048291048b910482014909a',
    type: 'RESALE',
    tokenId: '#1035',
    fromAddress: '0x4F194C2B10489104C28194019481049104821049',
    toAddress: '0x7E21C591048291048201948291048291048b2810',
    priceEth: '0.065',
    timestamp: '2026-08-19 09:55:18',
    blockNumber: 18491845,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x22c1048291048201948291048291048b281048291048291048b910482014909a',
  },
  {
    id: 'log-9',
    txHash: '0x88b1048291048201948291048291048b281048291048291048b910482014903c',
    type: 'TRANSFER',
    tokenId: '#1034',
    fromAddress: '0x62B1048291048201948291048291048b28104829',
    toAddress: '0x4F194C2B10489104C28194019481049104821049',
    priceEth: '0.000',
    timestamp: '2026-08-19 09:42:05',
    blockNumber: 18491790,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x88b1048291048201948291048291048b281048291048291048b910482014903c',
  },
  {
    id: 'log-10',
    txHash: '0x11a1048291048201948291048291048b281048291048291048b910482014905d',
    type: 'VERIFY',
    tokenId: '#1032',
    fromAddress: '0x82A1048291048201948291048291048b28104829',
    toAddress: '0x892F3A17B8c24E91d4021200E6482143B1400A14',
    priceEth: '0.000',
    timestamp: '2026-08-19 09:30:12',
    blockNumber: 18491710,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x11a1048291048201948291048291048b281048291048291048b910482014905d',
  },
  {
    id: 'log-11',
    txHash: '0x77d1048291048201948291048291048b281048291048291048b910482014907e',
    type: 'MINT',
    tokenId: '#1032',
    fromAddress: '0x0000000000000000000000000000000000000000',
    toAddress: '0x82A1048291048201948291048291048b28104829',
    priceEth: '0.050',
    timestamp: '2026-08-19 09:15:40',
    blockNumber: 18491620,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x77d1048291048201948291048291048b281048291048291048b910482014907e',
  },
  {
    id: 'log-12',
    txHash: '0x33e1048291048201948291048291048b281048291048291048b910482014909f',
    type: 'MINT',
    tokenId: '#1031',
    fromAddress: '0x0000000000000000000000000000000000000000',
    toAddress: '0x62B1048291048201948291048291048b28104829',
    priceEth: '0.050',
    timestamp: '2026-08-19 09:00:00',
    blockNumber: 18491500,
    explorerUrl: 'https://sepolia-optimism.etherscan.io/tx/0x33e1048291048201948291048291048b281048291048291048b910482014909f',
  },
];

type FilterTab = 'ALL' | 'MINT' | 'TRANSFER' | 'RESALE' | 'VERIFY';

export default function AdminDashboardPage() {
  // Sync State & Actions
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('Just now');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Table Filter, Search, Pagination
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Show Toast Helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Resync Button Action
  const handleTriggerResync = () => {
    if (isResyncing) return;
    setIsResyncing(true);
    triggerToast('Triggered catch-up resync on Optimism Sepolia node (Block #18,492,014)...');

    setTimeout(() => {
      setIsResyncing(false);
      setLastSyncTime(new Date().toLocaleTimeString());
      triggerToast('Optimism Sepolia listener resynced cleanly. 0 pending catch-up blocks.');
    }, 2200);
  };

  // Export Audit Logs Action
  const handleExportLogs = () => {
    const headers = ['Tx Hash', 'Type', 'Token ID', 'From', 'To', 'Price ETH', 'Timestamp', 'Block'];
    const csvRows = MOCK_AUDIT_LOGS.map((log) => [
      log.txHash,
      log.type,
      log.tokenId,
      log.fromAddress,
      log.toAddress,
      log.priceEth,
      log.timestamp,
      log.blockNumber,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `authentix_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast('Audit logs exported successfully (CSV format download started).');
  };

  // Filtered & Searched Logs
  const filteredLogs = useMemo(() => {
    return MOCK_AUDIT_LOGS.filter((log) => {
      const matchesTab = activeTab === 'ALL' || log.type === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        log.txHash.toLowerCase().includes(q) ||
        log.tokenId.toLowerCase().includes(q) ||
        log.fromAddress.toLowerCase().includes(q) ||
        log.toAddress.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [activeTab, searchQuery]);

  // Paginated Logs
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Helper formatting short address
  const formatAddress = (addr: string) => {
    if (addr === '0x0000000000000000000000000000000000000000') return '0x000...000 (Null Mint)';
    if (addr.length < 10) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Badge Styling based on transaction type
  const getTypeBadge = (type: AuditLog['type']) => {
    switch (type) {
      case 'MINT':
        return (
          <Badge variant="success" showDot className="font-mono text-[11px] font-bold">
            MINT
          </Badge>
        );
      case 'TRANSFER':
        return (
          <Badge variant="info" showDot className="font-mono text-[11px] font-bold">
            TRANSFER
          </Badge>
        );
      case 'RESALE':
        return (
          <Badge variant="warning" showDot className="font-mono text-[11px] font-bold">
            RESALE
          </Badge>
        );
      case 'VERIFY':
        return (
          <Badge variant="web3" showDot className="font-mono text-[11px] font-bold">
            VERIFY
          </Badge>
        );
      default:
        return <Badge variant="neutral">LOG</Badge>;
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Dynamic Toast Notification Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 sm:right-8 z-50 max-w-md bg-[#0B0F17] border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-medium leading-relaxed">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-gray-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> ADMIN CONTROL PANEL
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            System Health & Audit Log
          </h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Real-time infrastructure nodes monitoring, event listener synchronization state, and on-chain transaction audit trail.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="md"
            onClick={handleTriggerResync}
            disabled={isResyncing}
            icon={
              <RefreshCw
                className={`w-4 h-4 text-emerald-400 ${
                  isResyncing ? 'animate-spin' : ''
                }`}
              />
            }
            className="border-emerald-500/30 hover:border-emerald-500/60"
          >
            {isResyncing ? 'Resyncing Node...' : 'Trigger Catch-Up Resync'}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleExportLogs}
            icon={<Download className="w-4 h-4" />}
          >
            Export Audit Logs
          </Button>
        </div>
      </div>

      {/* Infrastructure System Health Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Optimism Sepolia Node */}
        <Card className="bg-[#0B0F17]/90 border border-emerald-500/30 relative overflow-hidden group hover:border-emerald-500/60 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                L2 Node RPC
              </span>
              <Badge variant="success" showDot className="text-[10px]">
                CONNECTED
              </Badge>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Optimism Sepolia
                </h3>
                <p className="text-[11px] font-mono text-gray-400">Chain ID: 11155420</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/80 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Latest Block:</span>
                <span className="font-bold text-white">#18,492,014</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Node Latency:</span>
                <span className="text-emerald-400 font-bold">42 ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: MongoDB Read Cache */}
        <Card className="bg-[#0B0F17]/90 border border-gray-800 relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Database Cache
              </span>
              <Badge variant="success" showDot className="text-[10px]">
                HEALTHY
              </Badge>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  MongoDB Read Cache
                </h3>
                <p className="text-[11px] font-mono text-gray-400">12 Collections</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/80 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Memory Usage:</span>
                <span className="font-bold text-white">342 MB</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Query Latency:</span>
                <span className="text-cyan-400 font-bold">4 ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Pinata IPFS Service */}
        <Card className="bg-[#0B0F17]/90 border border-gray-800 relative overflow-hidden group hover:border-violet-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Decentralized Storage
              </span>
              <Badge variant="success" showDot className="text-[10px]">
                OPERATIONAL
              </Badge>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Pinata IPFS Service
                </h3>
                <p className="text-[11px] font-mono text-gray-400">184 Pinned CIDs</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/80 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Gateway:</span>
                <span className="font-bold text-white truncate max-w-[120px]">
                  ipfs.pinata.cloud
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Storage Status:</span>
                <span className="text-violet-300 font-bold">100% Online</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Relayer Paymaster Wallet */}
        <Card className="bg-[#0B0F17]/90 border border-gray-800 relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Gasless Paymaster
              </span>
              <Badge variant="success" showDot className="text-[10px]">
                FUNDED
              </Badge>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Relayer Wallet
                </h3>
                <p className="text-[11px] font-mono text-amber-400 font-semibold">
                  Gas Tank Active
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/80 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Gas Tank Addr:</span>
                <span className="font-bold text-white">0x892...A14</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span className="text-gray-500">Balance:</span>
                <span className="text-amber-400 font-bold">1.482 ETH</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listener & Sync State Panel */}
      <div className="bg-[#0B0F17]/90 border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" /> Smart Contract Listener & Sync State
              </h2>
              <Badge variant="success" showDot className="text-xs font-mono">
                0 Pending Catch-Up Blocks
              </Badge>
            </div>
            <p className="text-xs text-gray-400">
              WebSocket Event Subscriptions for real-time ticket minting, transfers, and physical gate verification.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-gray-400 bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
            <div>
              <span className="text-gray-500">Last Synced:</span>{' '}
              <span className="text-emerald-400 font-bold">{lastSyncTime}</span>
            </div>
            <div className="h-3 w-px bg-gray-800" />
            <div>
              <span className="text-gray-500">Status:</span>{' '}
              <span className="text-emerald-400 font-bold">100% In Sync</span>
            </div>
          </div>
        </div>

        {/* Progress Bar & Block Heights */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500">Last Processed Block:</span>
              <span className="font-bold text-white bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                #18,492,014
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500">Latest Optimism Block:</span>
              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                #18,492,014
              </span>
            </div>
          </div>

          {/* Sync Progress Bar */}
          <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden p-0.5 border border-gray-800">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            />
          </div>
        </div>

        {/* Event Subscription Triggers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Event 1: TicketMinted */}
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex items-center justify-between hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono text-xs font-bold">
                M
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-white">
                  TicketMinted(address,uint256)
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Primary Sales Listener</div>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ACTIVE
              </span>
              <p className="text-[10px] font-mono text-gray-500 mt-1">1,420 events</p>
            </div>
          </div>

          {/* Event 2: TicketTransferred */}
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex items-center justify-between hover:border-cyan-500/40 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                T
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-white">
                  TicketTransferred(uint256,address,address)
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Resale & Transfer Listener</div>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                ACTIVE
              </span>
              <p className="text-[10px] font-mono text-gray-500 mt-1">385 events</p>
            </div>
          </div>

          {/* Event 3: TicketUsed */}
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex items-center justify-between hover:border-violet-500/40 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300 font-mono text-xs font-bold">
                V
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-white">
                  TicketUsed(uint256,uint256)
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">Gate Verification Listener</div>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                ACTIVE
              </span>
              <p className="text-[10px] font-mono text-gray-500 mt-1">890 events</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Audit Log Table Section */}
      <div className="bg-[#0B0F17]/90 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Table Header Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" /> Transaction Audit Log
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Complete on-chain ledger of all ticket mints, secondary transfers, resale settlements, and venue gate verifications.
            </p>
          </div>

          {/* Search Bar & Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Hash, Token ID, Address..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-gray-900/90 border border-gray-800 focus:border-emerald-500 text-xs text-white pl-9 pr-3 py-2 rounded-xl focus:outline-none transition font-mono placeholder:font-sans placeholder:text-gray-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800 text-xs font-medium w-full sm:w-auto overflow-x-auto">
              {(['ALL', 'MINT', 'TRANSFER', 'RESALE', 'VERIFY'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap text-xs ${
                    activeTab === tab
                      ? 'bg-emerald-500 text-gray-950 font-bold shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-900/90 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
              <tr>
                <th scope="col" className="px-4 py-3.5 font-bold">
                  Tx Hash
                </th>
                <th scope="col" className="px-4 py-3.5 font-bold">
                  Type
                </th>
                <th scope="col" className="px-4 py-3.5 font-bold">
                  Token ID
                </th>
                <th scope="col" className="px-4 py-3.5 font-bold">
                  From Address
                </th>
                <th scope="col" className="px-4 py-3.5 font-bold">
                  To Address
                </th>
                <th scope="col" className="px-4 py-3.5 font-bold text-right">
                  Price (ETH)
                </th>
                <th scope="col" className="px-4 py-3.5 font-bold">
                  Timestamp
                </th>
                <th scope="col" className="px-4 py-3.5 font-bold text-center">
                  Explorer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 bg-[#07090E]/60">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-900/60 transition-colors duration-150 group"
                  >
                    {/* Tx Hash */}
                    <td className="px-4 py-3.5 text-emerald-400 font-bold">
                      <span className="hidden sm:inline">
                        {log.txHash.substring(0, 10)}...{log.txHash.substring(log.txHash.length - 8)}
                      </span>
                      <span className="sm:hidden">{log.txHash.substring(0, 8)}...</span>
                    </td>

                    {/* Type Badge */}
                    <td className="px-4 py-3.5">{getTypeBadge(log.type)}</td>

                    {/* Token ID */}
                    <td className="px-4 py-3.5 font-bold text-white">{log.tokenId}</td>

                    {/* From Address */}
                    <td className="px-4 py-3.5 text-gray-400" title={log.fromAddress}>
                      {formatAddress(log.fromAddress)}
                    </td>

                    {/* To Address */}
                    <td className="px-4 py-3.5 text-gray-300" title={log.toAddress}>
                      {formatAddress(log.toAddress)}
                    </td>

                    {/* Price ETH */}
                    <td className="px-4 py-3.5 text-right font-bold text-white">
                      {log.priceEth !== '0.000' ? (
                        <span className="text-emerald-400">{log.priceEth} ETH</span>
                      ) : (
                        <span className="text-gray-500">0.000 ETH</span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3.5 text-gray-400 text-[11px] whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* Explorer Link */}
                    <td className="px-4 py-3.5 text-center">
                      <a
                        href={log.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-gray-400 hover:text-emerald-400 transition"
                        title="View on Optimism Sepolia Etherscan"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="w-6 h-6 text-gray-600" />
                      <p className="text-sm font-sans">No transaction logs match your filter/search criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs font-mono text-gray-400">
          <div>
            Showing{' '}
            <span className="font-bold text-white">
              {filteredLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-bold text-white">
              {Math.min(currentPage * itemsPerPage, filteredLogs.length)}
            </span>{' '}
            of <span className="font-bold text-white">{filteredLogs.length}</span> audit logs
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>

            <span className="px-3 py-1 bg-gray-900 rounded-lg border border-gray-800 text-white font-bold">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
