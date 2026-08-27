'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  DollarSign,
  Ticket,
  Copy,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  FileText,
  Zap,
  Info,
  Check,
  Percent,
  Layers,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

// Sample Presets for quick poster upload simulation
const SAMPLE_POSTERS = [
  {
    id: 'cyberpunk',
    name: 'CyberSonic Festival 2026',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    cid: 'QmX7vY3p9k8dF2m41a980bC8e3f2118319a',
    size: '3.4 MB',
    dimensions: '1920x1080'
  },
  {
    id: 'web3summit',
    name: 'ETH Global Tech Summit',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    cid: 'QmP9wZ2k7L5m3N8q1R6s9T4u2V8w7X5y3Z1',
    size: '2.8 MB',
    dimensions: '1920x1080'
  },
  {
    id: 'esports',
    name: 'Apex Web3 Gaming Arena',
    url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    cid: 'QmA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q',
    size: '4.1 MB',
    dimensions: '1920x1080'
  }
];

interface FormData {
  // Step 1: Event Info
  name: string;
  description: string;
  category: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  isVirtual: boolean;

  // Step 2: Poster Upload
  posterUrl: string;
  posterName: string;
  posterCid: string;
  posterSize: string;
  posterDimensions: string;
  altText: string;

  // Step 3: Pricing & Capacity
  capacity: number;
  faceValueEth: number;
  maxPerWallet: number;
  ticketTier: string;

  // Step 4: Resale Rules
  resaleCapMultiplier: number; // e.g. 1.5 (+50%)
  resaleDeadline: string;
  royaltyPercentage: number; // e.g. 7.5%
}

export default function NewEventPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({
    name: 'CyberSonic Music Festival 2026',
    description:
      'The world premiere decentralized NFT electronic music festival featuring live Web3 performances, soulbound VIP badges, and dynamic anti-scalping ticket contracts.',
    category: 'Music & Concerts',
    startDate: '2026-09-15',
    startTime: '18:00',
    endDate: '2026-09-16',
    endTime: '02:00',
    venueName: 'Cyber Dome Stadium',
    venueAddress: 'Tech District Avenue #402, Jakarta & Optimism Metaverse',
    isVirtual: false,

    posterUrl: SAMPLE_POSTERS[0].url,
    posterName: SAMPLE_POSTERS[0].name + ' Poster.jpg',
    posterCid: SAMPLE_POSTERS[0].cid,
    posterSize: SAMPLE_POSTERS[0].size,
    posterDimensions: SAMPLE_POSTERS[0].dimensions,
    altText: 'Official CyberSonic 2026 Cyberpunk Neon Stage Poster',

    capacity: 1500,
    faceValueEth: 0.05,
    maxPerWallet: 4,
    ticketTier: 'VIP Golden Access',

    resaleCapMultiplier: 1.5, // +50%
    resaleDeadline: '2026-09-15T16:00',
    royaltyPercentage: 7.5
  });

  // Deployment Modal State
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<number>(0);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedCid, setCopiedCid] = useState(false);

  const mockContractAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

  // ETH to USD conversion approximation ($3,400/ETH)
  const ethToUsd = (eth: number) => (eth * 3400).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectPoster = (poster: typeof SAMPLE_POSTERS[0]) => {
    setFormData((prev) => ({
      ...prev,
      posterUrl: poster.url,
      posterName: `${poster.name}_Poster.jpg`,
      posterCid: poster.cid,
      posterSize: poster.size,
      posterDimensions: poster.dimensions
    }));
  };

  const handleFileUploadSimulated = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({
          ...prev,
          posterUrl: event.target?.result as string,
          posterName: file.name,
          posterCid: 'Qm' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
          posterSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          posterDimensions: '1920x1080'
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const startDeployment = () => {
    setIsDeploying(true);
    setDeployStep(1);

    // Step 1 -> Step 2
    setTimeout(() => {
      setDeployStep(2);
    }, 1800);

    // Step 2 -> Step 3
    setTimeout(() => {
      setDeployStep(3);
    }, 3600);

    // Step 3 -> Success
    setTimeout(() => {
      setDeployStep(4);
      setDeploySuccess(true);
    }, 5400);
  };

  const copyToClipboard = (text: string, type: 'contract' | 'cid') => {
    navigator.clipboard.writeText(text);
    if (type === 'contract') {
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2000);
    } else {
      setCopiedCid(true);
      setTimeout(() => setCopiedCid(false), 2000);
    }
  };

  const steps = [
    { number: 1, title: 'Event Info', desc: 'Basic details & venue' },
    { number: 2, title: 'Poster Upload', desc: 'Pinata IPFS asset' },
    { number: 3, title: 'Pricing & Supply', desc: 'Capacity & ETH price' },
    { number: 4, title: 'Resale & Deploy', desc: 'Anti-scalping rules' }
  ];

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-2">
          <Link href="/organizer/dashboard" className="hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Organizer Studio
          </Link>
          <span>/</span>
          <span className="text-gray-400">Event Wizard</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
          Create Web3 Event Contract
          <Badge variant="web3" showDot className="text-xs">
            Optimism Sepolia
          </Badge>
        </h1>
        <p className="text-gray-400 text-sm mt-1.5 max-w-2xl">
          Configure your smart contract parameters, upload artwork metadata to Pinata IPFS, and enforce secondary resale price caps.
        </p>
      </div>

      {/* 4-Step Progress Indicator Bar */}
      <div className="mb-10 bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
          {steps.map((step) => {
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div
                key={step.number}
                onClick={() => isCompleted && setCurrentStep(step.number)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : isCompleted
                    ? 'bg-gray-800/40 border border-gray-700/50 text-gray-300 cursor-pointer hover:border-gray-600'
                    : 'bg-gray-950/30 border border-gray-800/30 text-gray-500'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500 text-gray-950'
                      : isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/60'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : step.number}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                    {step.title}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Progress Bar Line */}
        <div className="w-full bg-gray-800/80 h-1.5 rounded-full mt-4 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 h-full rounded-full"
            initial={{ width: '25%' }}
            animate={{ width: `${(currentStep / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main Form Body */}
      <Card className="border border-gray-800/80 bg-[#0B0F17]/90 backdrop-blur-2xl shadow-2xl">
        <CardContent className="p-6 sm:p-8">
          {/* STEP 1: EVENT INFO */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-gray-800/80 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" /> Step 1: Event Details & Venue
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Define public event titles, descriptions, categories, and date parameters for user discovery.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Event Title <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g. CyberSonic Music Festival 2026"
                    className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-medium transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Category <span className="text-emerald-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      'Music & Concerts',
                      'Web3 & Tech Summit',
                      'Esports & Gaming',
                      'Art Expo & Parties'
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleInputChange('category', cat)}
                        className={`p-3 rounded-xl text-xs font-semibold text-center border transition-all ${
                          formData.category === cat
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : 'bg-gray-900/40 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Event Description <span className="text-emerald-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your event highlights, guest line-up, and Web3 perks..."
                    className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-medium transition"
                  />
                </div>

                {/* Date and Time */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Start Date & Time <span className="text-emerald-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => handleInputChange('startTime', e.target.value)}
                        className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    End Date & Time <span className="text-emerald-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => handleInputChange('endTime', e.target.value)}
                        className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Venue Location */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Venue Name <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={formData.venueName}
                      onChange={(e) => handleInputChange('venueName', e.target.value)}
                      placeholder="e.g. Cyber Dome Arena"
                      className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    City / Address Details
                  </label>
                  <input
                    type="text"
                    value={formData.venueAddress}
                    onChange={(e) => handleInputChange('venueAddress', e.target.value)}
                    placeholder="e.g. Jakarta Tech District"
                    className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: POSTER UPLOAD */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-gray-800/80 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-cyan-400" /> Step 2: Poster Artwork & IPFS Storage
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Upload official event artwork. AuthenTix automatically pins poster metadata to Pinata IPFS for ERC-721 token provenance.
                </p>
              </div>

              {/* Pinata Status Banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white">Pinata IPFS Gateway Connected</p>
                      <Badge variant="success" showDot className="text-[10px]">
                        READY
                      </Badge>
                    </div>
                    <p className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
                      IPFS Node: dedicated-gateway.pinata.cloud/ipfs/
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs font-mono text-gray-400">
                  Status: <span className="text-emerald-400 font-bold">Encrypted & Pinned</span>
                </div>
              </div>

              {/* Preset Artwork Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Quick Select Sample Artwork or Upload Custom
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SAMPLE_POSTERS.map((poster) => (
                    <div
                      key={poster.id}
                      onClick={() => handleSelectPoster(poster)}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${
                        formData.posterCid === poster.cid
                          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'border-gray-800 opacity-70 hover:opacity-100 hover:border-gray-600'
                      }`}
                    >
                      <div className="h-28 relative">
                        <Image
                          src={poster.url}
                          alt={poster.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent" />
                        {formData.posterCid === poster.cid && (
                          <div className="absolute top-2 right-2 bg-emerald-500 text-gray-950 rounded-full p-1 shadow-lg">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 bg-gray-900/90">
                        <p className="text-xs font-bold text-white truncate">{poster.name}</p>
                        <p className="text-[10px] text-emerald-400 font-mono mt-0.5 truncate">
                          CID: {poster.cid.substring(0, 14)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload Dropzone & Live Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Drag & Drop File Upload Simulation
                  </label>
                  <label className="border-2 border-dashed border-gray-700 hover:border-emerald-500/60 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-900/40 hover:bg-emerald-500/5 transition-all text-center group min-h-[220px]">
                    <div className="w-12 h-12 rounded-xl bg-gray-800/80 group-hover:bg-emerald-500/20 text-gray-400 group-hover:text-emerald-400 flex items-center justify-center mb-3 transition-colors">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-white mb-1">
                      Click to upload or drag image here
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Supports PNG, JPG, WebP up to 10MB (Recommended 1920x1080)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUploadSimulated}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Preview Box & Pinata Info */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-gray-300 uppercase">IPFS Artwork Preview</p>
                      <Badge variant="info" className="text-[10px]">
                        PINATA ACTIVE
                      </Badge>
                    </div>

                    <div className="relative h-36 rounded-xl overflow-hidden border border-gray-800 mb-3 bg-gray-950">
                      <Image
                        src={formData.posterUrl}
                        alt="Poster Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono bg-gray-950/80 p-3 rounded-xl border border-gray-800/80">
                    <div className="flex justify-between text-gray-400">
                      <span>File Name:</span>
                      <span className="text-white truncate max-w-[160px]">{formData.posterName}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>File Size:</span>
                      <span className="text-white">{formData.posterSize}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>IPFS CID:</span>
                      <span className="text-emerald-400 font-bold truncate max-w-[160px]">
                        {formData.posterCid}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: PRICING & CAPACITY */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-gray-800/80 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-violet-400" /> Step 3: Ticket Pricing & Total Supply
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Specify face value pricing in ETH and maximum cap for NFT tickets.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Total Ticket Supply (Capacity) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      max={100000}
                      value={formData.capacity}
                      onChange={(e) => handleInputChange('capacity', parseInt(e.target.value) || 0)}
                      className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-gray-400 font-mono">
                      NFT Tickets
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Hard cap encoded in ERC-721 contract. Minting terminates upon reaching capacity.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Ticket Face Value Price (in ETH) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={formData.faceValueEth}
                      onChange={(e) => handleInputChange('faceValueEth', parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-emerald-400 font-mono font-bold">
                      ETH
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 text-[11px]">
                    <span className="text-gray-400">Approximate Fiat Value:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      ≈ ${ethToUsd(formData.faceValueEth)} USD
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Max Tickets per Wallet Limit
                  </label>
                  <select
                    value={formData.maxPerWallet}
                    onChange={(e) => handleInputChange('maxPerWallet', parseInt(e.target.value))}
                    className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>1 Ticket per wallet (Anti-sybil Strict)</option>
                    <option value={2}>2 Tickets per wallet</option>
                    <option value={4}>4 Tickets per wallet (Standard)</option>
                    <option value={6}>6 Tickets per wallet</option>
                    <option value={10}>10 Tickets per wallet (Group Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Ticket Tier Category
                  </label>
                  <select
                    value={formData.ticketTier}
                    onChange={(e) => handleInputChange('ticketTier', e.target.value)}
                    className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="General Admission">General Admission (GA)</option>
                    <option value="VIP Golden Access">VIP Golden Access</option>
                    <option value="Early Bird Mint">Early Bird Mint</option>
                    <option value="Backstage Pass">Backstage Pass</option>
                  </select>
                </div>
              </div>

              {/* Revenue Projection Card */}
              <div className="bg-gradient-to-r from-gray-900 via-gray-900 to-emerald-950/30 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Gross Primary Revenue Potential
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        {(formData.capacity * formData.faceValueEth).toFixed(2)} ETH
                      </span>
                      <span className="text-sm font-semibold text-gray-400 font-mono">
                        (≈ ${ethToUsd(formData.capacity * formData.faceValueEth)})
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: RESALE RULES & DEPLOY */}
          {currentStep === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-gray-800/80 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Step 4: Anti-Scalping Rules & Deploy
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Enforce smart contract resale caps and secondary royalty payouts on peer-to-peer trades.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Max Resale Price Cap */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Max Resale Price Cap
                    </label>
                    <Badge variant="success" className="text-xs">
                      +{( (formData.resaleCapMultiplier - 1) * 100 ).toFixed(0)}% Cap
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Smart contract automatically rejects secondary sales above this price multiplier.
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    {[1.2, 1.5, 2.0].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => handleInputChange('resaleCapMultiplier', cap)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition ${
                          formData.resaleCapMultiplier === cap
                            ? 'bg-emerald-500 text-gray-950 shadow-md'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        +{((cap - 1) * 100).toFixed(0)}% ({cap}x)
                      </button>
                    ))}
                  </div>
                  <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-[11px] font-mono text-emerald-400 flex justify-between">
                    <span>Max Allowed Resale Price:</span>
                    <span className="font-bold">
                      {(formData.faceValueEth * formData.resaleCapMultiplier).toFixed(3)} ETH (≈ ${ethToUsd(formData.faceValueEth * formData.resaleCapMultiplier)})
                    </span>
                  </div>
                </div>

                {/* Secondary Royalty % */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-cyan-400" /> Creator Royalty Fee
                    </label>
                    <span className="text-xs font-bold text-cyan-400 font-mono">
                      {formData.royaltyPercentage}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Percentage of secondary market sales paid directly to organizer treasury wallet.
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={formData.royaltyPercentage}
                    onChange={(e) => handleInputChange('royaltyPercentage', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 bg-gray-800 rounded-lg cursor-pointer"
                  />
                  <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-[11px] font-mono text-cyan-300 flex justify-between">
                    <span>Royalty per 0.05 ETH Trade:</span>
                    <span className="font-bold">
                      {((formData.faceValueEth * formData.royaltyPercentage) / 100).toFixed(4)} ETH
                    </span>
                  </div>
                </div>

                {/* Resale Deadline Date */}
                <div className="md:col-span-2 bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Resale Lock Cutoff Deadline
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Secondary ticket transfers will be automatically disabled after this date to prevent last-minute scamming.
                  </p>
                  <input
                    type="datetime-local"
                    value={formData.resaleDeadline}
                    onChange={(e) => handleInputChange('resaleDeadline', e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Summary Pre-flight Card */}
              <div className="bg-gray-900/90 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" /> Contract Deployment Summary
                  </h3>
                  <Badge variant="web3" className="text-xs">
                    ERC-721 Standard
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Event Title</span>
                    <span className="text-white font-bold truncate block">{formData.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Total Supply</span>
                    <span className="text-emerald-400 font-bold font-mono block">
                      {formData.capacity} NFTs
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Face Value</span>
                    <span className="text-white font-bold font-mono block">{formData.faceValueEth} ETH</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Price Cap</span>
                    <span className="text-cyan-400 font-bold font-mono block">
                      {formData.resaleCapMultiplier}x (+{((formData.resaleCapMultiplier - 1) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Form Actions Footer */}
          <div className="mt-8 pt-6 border-t border-gray-800/80 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>

            {currentStep < 4 ? (
              <Button
                variant="primary"
                onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
              >
                Next Step <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={startDeployment}
                icon={<Zap className="w-5 h-5" />}
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shadow-xl shadow-emerald-500/25"
              >
                Deploy Event Contract
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deployment Progress & Success Modal */}
      <AnimatePresence>
        {isDeploying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0B0F17] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />

              {!deploySuccess ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-4 animate-pulse">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Deploying Smart Contract</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Broadcasting parameters to Optimism Sepolia Testnet...
                    </p>
                  </div>

                  {/* Step Progress Feed */}
                  <div className="space-y-3 bg-gray-900/80 p-4 rounded-2xl border border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold">
                        {deployStep > 1 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : deployStep === 1 ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <span className="w-2 h-2 bg-gray-600 rounded-full" />
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          deployStep >= 1 ? 'text-white font-semibold' : 'text-gray-500'
                        }`}
                      >
                        1. Pinning Poster & ERC-721 Metadata to IPFS
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold">
                        {deployStep > 2 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : deployStep === 2 ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <span className="w-2 h-2 bg-gray-600 rounded-full" />
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          deployStep >= 2 ? 'text-white font-semibold' : 'text-gray-500'
                        }`}
                      >
                        2. Generating ERC-721 Metadata & Signatures
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold">
                        {deployStep > 3 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : deployStep === 3 ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <span className="w-2 h-2 bg-gray-600 rounded-full" />
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          deployStep >= 3 ? 'text-white font-semibold' : 'text-gray-500'
                        }`}
                      >
                        3. Calling createEvent on Optimism Sepolia Contract
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Success View Card */
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>

                  <div>
                    <Badge variant="success" showDot className="mb-2">
                      EVENT CONTRACT LIVE
                    </Badge>
                    <h3 className="text-2xl font-black text-white">Event Created Successfully!</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Your event contract has been compiled, deployed, and verified on Optimism Sepolia.
                    </p>
                  </div>

                  <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 text-left space-y-3 text-xs font-mono">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Contract Address</span>
                      <div className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800 mt-1">
                        <span className="text-emerald-400 font-bold truncate mr-2">
                          {mockContractAddress}
                        </span>
                        <button
                          onClick={() => copyToClipboard(mockContractAddress, 'contract')}
                          className="text-gray-400 hover:text-white transition"
                        >
                          {copiedContract ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">IPFS Metadata URI</span>
                      <div className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800 mt-1">
                        <span className="text-cyan-400 truncate mr-2">
                          ipfs://{formData.posterCid}
                        </span>
                        <button
                          onClick={() => copyToClipboard(`ipfs://${formData.posterCid}`, 'cid')}
                          className="text-gray-400 hover:text-white transition"
                        >
                          {copiedCid ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <Link href="/organizer/dashboard" className="w-full">
                      <Button variant="primary" fullWidth size="lg">
                        Go to Dashboard
                      </Button>
                    </Link>
                    <Link href="/events" className="w-full">
                      <Button variant="outline" fullWidth size="lg">
                        View Live Listing
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
