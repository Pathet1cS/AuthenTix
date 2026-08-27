"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  QrCode,
  Sparkles,
  ShieldCheck,
  Tag,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Calendar,
  Layers,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Cpu,
} from "lucide-react";
import { MOCK_TICKETS, MOCK_EVENTS, TicketItem } from "@/lib/mockData";
import { DynamicQRModal } from "@/components/tickets/DynamicQRModal";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function TicketDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(params as Promise<{ id: string }>);
  const rawId = resolvedParams?.id || "";
  const cleanId = rawId.replace("#", "").toLowerCase();

  // Find ticket by matching tokenId (cleaned or raw)
  const ticket: TicketItem =
    MOCK_TICKETS.find(
      (t) =>
        t.tokenId.replace("#", "").toLowerCase() === cleanId ||
        t.tokenId.toLowerCase() === rawId.toLowerCase()
    ) || MOCK_TICKETS[0];

  const matchingEvent = MOCK_EVENTS.find((e) => e.id === ticket.eventId);
  const posterUrl =
    matchingEvent?.posterUrl ||
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop";

  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [copiedTx, setCopiedTx] = useState<boolean>(false);
  const [copiedURI, setCopiedURI] = useState<boolean>(false);
  const [copiedWallet, setCopiedWallet] = useState<boolean>(false);
  const [isListingModalOpen, setIsListingModalOpen] = useState<boolean>(false);
  const [resalePriceInput, setResalePriceInput] = useState<string>(
    matchingEvent ? (matchingEvent.ticketPriceEth * 1.2).toFixed(2) : "0.10"
  );
  const [isListedSuccess, setIsListedSuccess] = useState<boolean>(
    ticket.status === "RESALE"
  );

  const copyToClipboard = (
    text: string,
    setFn: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const getStatusBadge = (status: TicketItem["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ACTIVE PASS
          </span>
        );
      case "RESALE":
        return (
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 backdrop-blur-md flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            LISTED FOR RESALE ({ticket.resalePriceEth || resalePriceInput} ETH)
          </span>
        );
      case "USED":
        return (
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 backdrop-blur-md">
            USED / EXPIRED
          </span>
        );
      default:
        return null;
    }
  };

  const handleListResaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsListedSuccess(true);
    setIsListingModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#07090E] py-10 px-4 sm:px-6 lg:px-8 text-white max-w-7xl mx-auto space-y-8">
      {/* Back Button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <Link
          href="/my-tickets"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900/80 border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white hover:border-emerald-500/40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Ticket Gallery</span>
        </Link>

        <div className="flex items-center gap-2">
          {getStatusBadge(isListedSuccess ? "RESALE" : ticket.status)}
        </div>
      </div>

      {/* Main Grid: Showcase Card (Left) & Provenance Timeline / Details (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: NFT Showcase Card & Actions */}
        <div className="lg:col-span-1 space-y-6">
          {/* Visual Metallic NFT Card Container */}
          <div className="relative rounded-3xl bg-[#0B0F17] border border-emerald-500/30 overflow-hidden shadow-2xl shadow-emerald-950/30 p-5 space-y-5">
            {/* Poster Showcase Container */}
            <div className="relative w-full h-80 rounded-2xl overflow-hidden bg-gray-900 border border-white/10 group">
              <img
                src={posterUrl}
                alt={ticket.eventTitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-black/50" />

              {/* Holographic Token ID Badge */}
              <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 shadow-xl">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Token ID {ticket.tokenId}</span>
              </div>

              {/* Security Shield Overlay Badge */}
              <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs font-medium text-gray-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified ERC-721</span>
              </div>
            </div>

            {/* Title & Metadata */}
            <div className="space-y-3">
              <h2 className="text-xl font-extrabold text-white leading-snug">
                {ticket.eventTitle}
              </h2>

              <div className="space-y-2 text-xs text-gray-300 border-y border-gray-800/80 py-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{ticket.eventDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>{ticket.venue}</span>
                </div>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="space-y-3 pt-1">
              <button
                onClick={() => setIsQRModalOpen(true)}
                className="w-full py-3.5 px-4 rounded-2xl font-extrabold text-xs tracking-wider bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 hover:from-emerald-400 hover:to-cyan-400 text-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]"
              >
                <QrCode className="w-4 h-4" />
                <span>View Dynamic Entry QR</span>
              </button>

              {ticket.status === "ACTIVE" && !isListedSuccess && (
                <button
                  onClick={() => setIsListingModalOpen(true)}
                  className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center gap-2 transition-colors"
                >
                  <Tag className="w-4 h-4" />
                  <span>List Ticket for Resale</span>
                </button>
              )}

              {isListedSuccess && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center font-medium">
                  Currently Listed on AuthenTix Resale Marketplace
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: On-Chain Details & Provenance History Timeline */}
        <div className="lg:col-span-2 space-y-8">
          {/* On-Chain Provenance Overview Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#0B0F17] border border-gray-800/80 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm tracking-wider uppercase">
                <Layers className="w-4 h-4" />
                <h2>NFT Token Specifications</h2>
              </div>
              <span className="text-xs font-mono text-gray-400">
                Optimism Sepolia L2
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Owner Wallet */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1">
                <span className="text-xs text-gray-400 block font-medium">
                  Current Owner Wallet
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-gray-200 truncate">
                    {ticket.ownerWallet}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(ticket.ownerWallet, setCopiedWallet)
                    }
                    className="p-1 text-gray-400 hover:text-emerald-400 transition-colors"
                  >
                    {copiedWallet ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mint Date */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1">
                <span className="text-xs text-gray-400 block font-medium">
                  Mint Timestamp
                </span>
                <span className="text-xs font-mono text-gray-200 block">
                  {ticket.mintedAt}
                </span>
              </div>

              {/* Mint Tx Hash */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1 sm:col-span-2">
                <span className="text-xs text-gray-400 block font-medium">
                  Mint Transaction Hash
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-emerald-400 truncate">
                    {ticket.txHash}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        copyToClipboard(ticket.txHash, setCopiedTx)
                      }
                      className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                      title="Copy Transaction Hash"
                    >
                      {copiedTx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`https://sepolia-optimism.etherscan.io/tx/${ticket.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                      title="View on Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* IPFS Token URI Link */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1 sm:col-span-2">
                <span className="text-xs text-gray-400 block font-medium">
                  IPFS Token URI Metadata
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-cyan-400 truncate">
                    {ticket.tokenURI}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        copyToClipboard(ticket.tokenURI, setCopiedURI)
                      }
                      className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                    >
                      {copiedURI ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`https://ipfs.io/ipfs/${ticket.tokenURI.replace(
                        "ipfs://",
                        ""
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* On-Chain Provenance History Timeline */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#0B0F17] border border-gray-800/80 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-wider uppercase">
                <Clock className="w-4 h-4" />
                <h2>On-Chain Provenance Timeline</h2>
              </div>
              <span className="text-xs text-gray-400">
                {ticket.provenanceHistory.length} Lifecycle Events
              </span>
            </div>

            {/* Timeline List */}
            <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-cyan-500 before:to-gray-800">
              {ticket.provenanceHistory.map((item, index) => {
                const getEventBadge = (evtType: string) => {
                  switch (evtType) {
                    case "MINT":
                      return {
                        title: "Token Minted",
                        icon: Sparkles,
                        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        dot: "bg-emerald-400",
                      };
                    case "RESALE_BUY":
                      return {
                        title: "Resale Transfer Purchased",
                        icon: DollarSign,
                        color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
                        dot: "bg-cyan-400",
                      };
                    case "RESALE_LIST":
                      return {
                        title: "Listed on Marketplace",
                        icon: Tag,
                        color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        dot: "bg-amber-400",
                      };
                    case "VERIFY":
                      return {
                        title: "Gate Verification Check-In",
                        icon: ShieldCheck,
                        color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
                        dot: "bg-purple-400",
                      };
                    default:
                      return {
                        title: "Wallet Transfer",
                        icon: ArrowRightLeft,
                        color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
                        dot: "bg-indigo-400",
                      };
                  }
                };

                const meta = getEventBadge(item.event);
                const IconComponent = meta.icon;

                return (
                  <div key={index} className="relative group">
                    {/* Timeline Dot Marker */}
                    <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-[#0B0F17] ${meta.dot} shadow-md`} />

                    {/* Timeline Entry Card */}
                    <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/80 space-y-2 hover:border-gray-700 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${meta.color}`}
                          >
                            <IconComponent className="w-3 h-3" />
                            {meta.title}
                          </span>
                          {item.priceEth && (
                            <span className="text-xs font-bold text-emerald-400">
                              {item.priceEth} ETH
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 font-mono">
                          {item.timestamp}
                        </span>
                      </div>

                      {/* From / To Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300 pt-1">
                        <div>
                          <span className="text-gray-400 block text-[11px]">From</span>
                          <span className="font-mono text-gray-200 truncate block">
                            {item.from}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[11px]">To</span>
                          <span className="font-mono text-gray-200 truncate block">
                            {item.to}
                          </span>
                        </div>
                      </div>

                      {/* Transaction Hash */}
                      <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
                        <span className="font-mono truncate">Tx: {item.txHash}</span>
                        <a
                          href={`https://sepolia-optimism.etherscan.io/tx/${item.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 ml-2 flex-shrink-0"
                        >
                          <span>Explorer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Entry QR Code Modal */}
      <DynamicQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        ticket={ticket}
      />

      {/* Resale Listing Modal */}
      {isListingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsListingModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-[#0B0F17] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold">List Ticket for Resale</h3>
            </div>
            <p className="text-xs text-gray-400">
              Set your resale price. AuthenTix smart contracts enforce a maximum ceiling of +50% of face value to prevent anti-consumer scalping.
            </p>

            <form onSubmit={handleListResaleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  Resale Price (ETH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={resalePriceInput}
                    onChange={(e) => setResalePriceInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-amber-500/60"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-amber-400 font-bold">
                    ETH
                  </span>
                </div>
                {matchingEvent && (
                  <span className="text-[11px] text-gray-400 block">
                    Max Allowed Cap: {matchingEvent.maxResalePriceEth} ETH
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Listing your ticket will transfer ownership escrow to the AuthenTix Resale Contract until sold or cancelled.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsListingModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition-all"
                >
                  Confirm Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
