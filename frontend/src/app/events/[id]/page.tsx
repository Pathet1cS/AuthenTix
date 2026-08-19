"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  MapPin,
  Clock,
  Calendar,
  Sparkles,
  ShieldCheck,
  Share2,
  CalendarPlus,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  Cpu,
  Layers,
  Flame,
  Award,
  ArrowUpRight,
  Info,
  CheckCircle2,
  Ticket,
  UserCheck,
} from "lucide-react";
import { MOCK_EVENTS, EventItem } from "@/lib/mockData";
import { PurchaseTicketModal } from "@/components/events/PurchaseTicketModal";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function EventDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(params as Promise<{ id: string }>);
  const eventId = resolvedParams?.id;

  // Fallback to first event if ID not found
  const event: EventItem =
    MOCK_EVENTS.find((e) => e.id === eventId) || MOCK_EVENTS[0];

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedIpfs, setCopiedIpfs] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [expandedSchedule, setExpandedSchedule] = useState<number | null>(0);

  const sold = event.totalCapacity - event.remainingQuota;
  const soldPercent = Math.min(
    100,
    Math.round((sold / event.totalCapacity) * 100)
  );

  const copyToClipboard = (
    text: string,
    setFn: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const scheduleItems = [
    {
      time: "18:30 - 19:30",
      title: "Gate Opening & On-Chain Verification",
      description:
        "Scan dynamic QR tickets via scanner app. Fast-track entry for VIP NFT holders with instant off-chain verification.",
    },
    {
      time: "19:30 - 21:00",
      title: "Opening Acts & Interactive Visuals",
      description:
        "Opening performances featuring immersive AR soundscapes and ambient light choreography.",
    },
    {
      time: "21:00 - 23:00",
      title: "Main Stage Headline Performance",
      description:
        "Headline show featuring live audio-visual synthesis and exclusive dynamic NFT collectible drops for attendees.",
    },
  ];

  const contractAddress = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
  const ipfsUri = `ipfs://${event.posterCid}`;

  return (
    <div className="min-h-screen pb-20 pt-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* 1. Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 font-medium overflow-x-auto whitespace-nowrap py-1">
        <Link href="/" className="hover:text-emerald-400 transition-colors">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
        <Link href="/#events" className="hover:text-emerald-400 transition-colors">
          Events
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
        <span className="text-gray-200 font-semibold truncate max-w-[200px] sm:max-w-xs">
          {event.title}
        </span>
      </nav>

      {/* 2. Event Header Section */}
      <div className="relative rounded-3xl overflow-hidden bg-[#0B0F17] border border-gray-800/80 shadow-2xl">
        {/* Cover Poster Banner Container */}
        <div className="relative w-full h-72 sm:h-96 md:h-[420px] overflow-hidden">
          <img
            src={event.posterUrl}
            alt={event.title}
            className="w-full h-full object-cover object-center transform scale-105 filter brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17]/90 via-transparent to-transparent hidden md:block" />

          {/* Top Floating Badges */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md">
              {event.category}
            </span>
            <div className="flex items-center gap-2">
              {event.status === "SOLD_OUT" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 backdrop-blur-md">
                  SOLD OUT
                </span>
              )}
              {event.status === "ONGOING" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md animate-pulse">
                  LIVE NOW
                </span>
              )}
              {event.status === "UPCOMING" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 backdrop-blur-md">
                  UPCOMING
                </span>
              )}
            </div>
          </div>

          {/* Banner Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 space-y-4">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight max-w-4xl">
                {event.title}
              </h1>

              {/* Organizer Info */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-black">
                    {event.organizerName.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-gray-200">
                    {event.organizerName}
                  </span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>

                {/* Wallet Badge */}
                <button
                  onClick={() =>
                    copyToClipboard(event.organizerWallet, setCopiedWallet)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 text-xs font-mono text-gray-300 hover:text-white transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {event.organizerWallet.substring(0, 6)}...
                    {event.organizerWallet.substring(
                      event.organizerWallet.length - 4
                    )}
                  </span>
                  {copiedWallet ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Quick Meta Info Row */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-gray-300 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">{event.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="font-medium">{event.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" />
                <span className="font-medium truncate max-w-xs">
                  {event.venue}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content Grid (Left details + Right sticky sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Details, Agenda, Venue, IPFS/Contract Badges, Resale Policy */}
        <div className="lg:col-span-2 space-y-8">
          {/* Detailed Description */}
          <section className="p-6 sm:p-8 rounded-3xl bg-[#0B0F17] border border-gray-800/80 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              <h2>About This Event</h2>
            </div>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
              {event.description}
            </p>
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
              Tickets for this event are issued as immutable ERC-721 smart contract tokens on the Optimism Sepolia L2 network. Ownership guarantees your entry via dynamic cryptographic QR verification, eliminating counterfeit tickets and scalper exploitation.
            </p>
          </section>

          {/* Agenda / Schedule Accordion */}
          <section className="p-6 sm:p-8 rounded-3xl bg-[#0B0F17] border border-gray-800/80 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-wider uppercase">
                <Clock className="w-4 h-4" />
                <h2>Event Agenda & Schedule</h2>
              </div>
              <span className="text-xs text-gray-400 font-mono">3 Timeline Items</span>
            </div>

            <div className="space-y-3">
              {scheduleItems.map((item, index) => {
                const isExpanded = expandedSchedule === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-gray-900/60 border border-gray-800/80 overflow-hidden transition-all"
                  >
                    <button
                      onClick={() =>
                        setExpandedSchedule(isExpanded ? null : index)
                      }
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                          {item.time}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {item.title}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="px-4 pb-4 pt-1 border-t border-gray-800/60 text-xs text-gray-300 leading-relaxed"
                        >
                          {item.description}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Venue & Location Map Box */}
          <section className="p-6 sm:p-8 rounded-3xl bg-[#0B0F17] border border-gray-800/80 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm tracking-wider uppercase">
                <MapPin className="w-4 h-4" />
                <h2>Venue & Location Map</h2>
              </div>
              <span className="text-xs text-gray-400">{event.venue}</span>
            </div>

            {/* Simulated Location Map Box */}
            <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 flex items-center justify-center group">
              {/* Map grid background pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent opacity-80" />

              {/* Map Pin Marker Pulse */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-12 h-12 bg-emerald-500/20 rounded-full animate-ping" />
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400 backdrop-blur-md flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/60">
                    <MapPin className="w-5 h-5 fill-emerald-400 text-black" />
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-center shadow-lg">
                  <p className="text-xs font-bold text-white">{event.venue}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">
                    Verified Physical Location
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* On-Chain Metadata & Smart Contract Badges */}
          <section className="p-6 sm:p-8 rounded-3xl bg-[#0B0F17] border border-gray-800/80 space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm tracking-wider uppercase">
              <Layers className="w-4 h-4" />
              <h2>Blockchain Provenance & Metadata</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* IPFS Metadata link badge */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">
                    IPFS Metadata CID
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Decentralized Storage
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-white truncate">
                    {ipfsUri}
                  </span>
                  <button
                    onClick={() => copyToClipboard(ipfsUri, setCopiedIpfs)}
                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors flex-shrink-0"
                    title="Copy IPFS URI"
                  >
                    {copiedIpfs ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Smart Contract badge */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">
                    ERC-721 Smart Contract
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Optimism Sepolia
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-white truncate">
                    {contractAddress}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(contractAddress, setCopiedContract)
                    }
                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors flex-shrink-0"
                    title="Copy Contract Address"
                  >
                    {copiedContract ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Resale Policy Alert Box */}
          <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#0B0F17] to-cyan-950/40 border border-emerald-500/30 space-y-4 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <ShieldCheck className="w-32 h-32 text-emerald-400" />
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Smart Contract Resale Policy & Anti-Scalping
                </h3>
                <p className="text-xs text-gray-400">
                  On-chain enforced price ceilings prevent predatory scalping.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20">
                <span className="text-[11px] text-gray-400 block font-medium">
                  Max Resale Price Cap
                </span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  +50% of face value
                </span>
                <span className="text-[10px] text-gray-400 block">
                  Max: {event.maxResalePriceEth} ETH
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20">
                <span className="text-[11px] text-gray-400 block font-medium">
                  Secondary Marketplace
                </span>
                <span className="text-base font-bold text-cyan-400">
                  AuthenTix Native
                </span>
                <span className="text-[10px] text-gray-400 block">
                  Restricted to platform contract
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20">
                <span className="text-[11px] text-gray-400 block font-medium">
                  Sale Deadline
                </span>
                <span className="text-base font-bold text-purple-400">
                  2h Before Event
                </span>
                <span className="text-[10px] text-gray-400 block">
                  Locks dynamic verification QR
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Sticky Sidebar Price Card & CTA */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <div className="p-6 rounded-3xl bg-[#0B0F17] border border-emerald-500/30 shadow-2xl shadow-emerald-950/30 space-y-6">
              {/* Price Tag */}
              <div>
                <span className="text-xs text-gray-400 font-medium block">
                  Ticket Face Value
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-emerald-400">
                    {event.ticketPriceEth} ETH
                  </span>
                  <span className="text-sm text-gray-400 font-mono">
                    ≈ ${event.ticketPriceUsd.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Quota Bar */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Remaining Quota</span>
                  <span className="text-white font-bold">
                    {event.remainingQuota} / {event.totalCapacity}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-gray-800 overflow-hidden p-0.5 border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      soldPercent >= 100
                        ? "bg-rose-500"
                        : soldPercent >= 80
                        ? "bg-gradient-to-r from-amber-500 to-rose-500"
                        : "bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-500"
                    }`}
                    style={{ width: `${soldPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 pt-0.5">
                  <span>{soldPercent}% sold out</span>
                  <span className="text-emerald-400 font-medium">
                    Gasless Minting
                  </span>
                </div>
              </div>

              {/* Buy Ticket CTA Button */}
              <button
                onClick={() => setIsPurchaseModalOpen(true)}
                disabled={event.status === "SOLD_OUT"}
                className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-xl ${
                  event.status === "SOLD_OUT"
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
                    : "bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 hover:brightness-110 text-black shadow-emerald-500/25 active:scale-[0.98]"
                }`}
              >
                <Ticket className="w-5 h-5 fill-black" />
                <span>
                  {event.status === "SOLD_OUT" ? "Sold Out" : "Buy Ticket"}
                </span>
              </button>

              {/* Action Buttons: Share & Calendar */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() =>
                    copyToClipboard(window.location.href, setCopiedShare)
                  }
                  className="py-2.5 px-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white flex items-center justify-center gap-2 transition-colors"
                >
                  {copiedShare ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied Link!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Share Event</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() =>
                    alert(`Added "${event.title}" to calendar!`)
                  }
                  className="py-2.5 px-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Calendar</span>
                </button>
              </div>

              {/* Additional perks checklist */}
              <div className="space-y-2 pt-3 border-t border-gray-800 text-[11px] text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Instant NFT minting directly to your wallet</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero gas fees (Biconomy relayer sponsored)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Resale protection with price ceiling</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Purchase Ticket Modal Component */}
      <PurchaseTicketModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        event={event}
      />
    </div>
  );
}
