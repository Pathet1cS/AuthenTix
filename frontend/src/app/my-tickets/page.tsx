"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { TicketCard } from "@/components/tickets/TicketCard";
import { DynamicQRModal } from "@/components/tickets/DynamicQRModal";
import { MOCK_TICKETS, TicketItem } from "@/lib/mockData";
import { Ticket, Sparkles, Filter, Search, ShieldCheck, CheckCircle2, RefreshCw } from "lucide-react";

type FilterTab = "ALL" | "ACTIVE" | "RESALE" | "USED";

export default function MyTicketsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);

  const activeCount = MOCK_TICKETS.filter((t) => t.status === "ACTIVE").length;
  const resaleCount = MOCK_TICKETS.filter((t) => t.status === "RESALE").length;
  const usedCount = MOCK_TICKETS.filter((t) => t.status === "USED").length;

  const filteredTickets = MOCK_TICKETS.filter((ticket) => {
    // Filter by tab
    if (activeTab === "ACTIVE" && ticket.status !== "ACTIVE") return false;
    if (activeTab === "RESALE" && ticket.status !== "RESALE") return false;
    if (activeTab === "USED" && ticket.status !== "USED") return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ticket.eventTitle.toLowerCase().includes(q);
      const matchVenue = ticket.venue.toLowerCase().includes(q);
      const matchToken = ticket.tokenId.toLowerCase().includes(q);
      return matchTitle || matchVenue || matchToken;
    }

    return true;
  });

  const handleShowQR = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setIsQRModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#07090E] py-10 px-4 sm:px-6 lg:px-8 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header Header Banner */}
        <div className="relative rounded-3xl bg-gradient-to-r from-emerald-950/40 via-gray-900/80 to-cyan-950/40 border border-emerald-500/20 p-6 sm:p-8 overflow-hidden backdrop-blur-xl">
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Personal Web3 Vault</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                My NFT Ticket Gallery
              </h1>
              <p className="text-sm text-gray-400 mt-2 max-w-xl">
                Cryptographically secured event passes on Ethereum. Access live dynamic gate passes or list tickets on the anti-scalping marketplace.
              </p>
            </div>

            {/* Ticket Counter Cards */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-3 rounded-2xl bg-black/60 border border-emerald-500/30 text-center min-w-[100px]">
                <span className="text-2xl font-black text-emerald-400 block leading-tight">
                  {activeCount}
                </span>
                <span className="text-[11px] font-medium text-gray-400">
                  Active Passes
                </span>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-black/60 border border-amber-500/30 text-center min-w-[100px]">
                <span className="text-2xl font-black text-amber-400 block leading-tight">
                  {resaleCount}
                </span>
                <span className="text-[11px] font-medium text-gray-400">
                  Resale Listings
                </span>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-black/60 border border-gray-800 text-center min-w-[100px]">
                <span className="text-2xl font-black text-gray-400 block leading-tight">
                  {MOCK_TICKETS.length}
                </span>
                <span className="text-[11px] font-medium text-gray-400">
                  Total Passes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-800 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-900/80 border border-gray-800/80 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "ALL"
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              All Passes ({MOCK_TICKETS.length})
            </button>
            <button
              onClick={() => setActiveTab("ACTIVE")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "ACTIVE"
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab("RESALE")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "RESALE"
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              Resale Listings ({resaleCount})
            </button>
            <button
              onClick={() => setActiveTab("USED")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "USED"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              Past / Used ({usedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event, venue, or token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-gray-900/80 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredTickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTickets.map((ticket) => (
              <TicketCard
                key={ticket.tokenId}
                ticket={ticket}
                onShowQR={handleShowQR}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center rounded-3xl bg-gray-900/30 border border-gray-800/80 p-8 space-y-4">
            <div className="p-4 rounded-full bg-gray-800/60 border border-gray-700 text-gray-400">
              <Ticket className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No Tickets Found</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                No NFT passes match your current filter selection or search query.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab("ALL");
                setSearchQuery("");
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Dynamic 30s Entry QR Code Modal */}
      <DynamicQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        ticket={selectedTicket}
      />
    </div>
  );
}
