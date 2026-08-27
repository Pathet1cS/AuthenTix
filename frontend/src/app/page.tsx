"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Zap,
  Wallet,
  Ticket,
  ArrowRight,
  PlusCircle,
  RotateCcw,
  TrendingUp,
  Layers,
  Lock,
  CheckCircle2,
  Activity,
  Globe,
} from "lucide-react";
import { MOCK_EVENTS } from "@/lib/mockData";
import { EventCard } from "@/components/events/EventCard";

const CATEGORY_FILTERS = [
  { id: "all", label: "All Events" },
  { id: "tech", label: "Tech & Web3" },
  { id: "music", label: "Music & Festivals" },
  { id: "gaming", label: "Gaming" },
  { id: "conferences", label: "Conferences" },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "price-low" | "price-high" | "popularity">("date");

  // Filtering events based on search query & selected category pill
  const filteredEvents = MOCK_EVENTS.filter((event) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === "" ||
      event.title.toLowerCase().includes(query) ||
      event.venue.toLowerCase().includes(query) ||
      event.category.toLowerCase().includes(query) ||
      event.organizerName.toLowerCase().includes(query) ||
      event.description.toLowerCase().includes(query);

    let matchesCategory = true;
    if (selectedCategory === "tech") {
      matchesCategory = event.category === "Tech";
    } else if (selectedCategory === "music") {
      matchesCategory = event.category === "Concerts" || event.category === "Festivals";
    } else if (selectedCategory === "gaming") {
      matchesCategory = event.category === "Gaming";
    } else if (selectedCategory === "conferences") {
      matchesCategory =
        event.category === "Tech" ||
        event.title.toLowerCase().includes("summit") ||
        event.title.toLowerCase().includes("hackathon");
    }

    return matchesSearch && matchesCategory;
  });

  // Sorting filtered events
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy === "price-low") {
      return a.ticketPriceEth - b.ticketPriceEth;
    } else if (sortBy === "price-high") {
      return b.ticketPriceEth - a.ticketPriceEth;
    } else if (sortBy === "popularity") {
      return (b.totalCapacity - b.remainingQuota) - (a.totalCapacity - a.remainingQuota);
    }
    return 0;
  });

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSortBy("date");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-gray-100 overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        {/* Glow Effects Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl rounded-full pointer-events-none -z-10" />

        {/* Web3 Network Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-md mb-8 shadow-lg shadow-emerald-950/40"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Optimism Sepolia L2 Testnet</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300 font-mono text-[11px]">ERC-721 Anti-Scalping</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15]"
        >
          Decentralized Ticketing{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Without Friction
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl leading-relaxed"
        >
          Mint verified NFT event passes, dynamic anti-scalping QR verification, and price-capped secondary resales backed by smart contract governance.
        </motion.p>

        {/* Hero CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4 w-full max-w-md"
        >
          <a
            href="#catalogue"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:brightness-110 shadow-lg shadow-emerald-500/25 transition-all duration-200 cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            <span>Explore Events</span>
          </a>

          <Link
            href="/organizer/create"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-gray-900/80 hover:bg-gray-800 text-gray-200 border border-gray-700/80 hover:border-gray-600 backdrop-blur-md transition-all duration-200"
          >
            <PlusCircle className="w-4 h-4 text-cyan-400" />
            <span>Create Event</span>
          </Link>
        </motion.div>
      </section>

      {/* 2. PLATFORM STATS BAR */}
      <section className="w-full border-y border-gray-800/80 bg-[#0B0F17]/60 backdrop-blur-md py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {/* Stat 1 */}
            <div className="p-4 rounded-xl bg-gray-900/30 border border-gray-800/40">
              <div className="text-2xl sm:text-4xl font-extrabold text-white font-mono tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                $2.4M
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 font-medium flex items-center justify-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Volume Traded</span>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="p-4 rounded-xl bg-gray-900/30 border border-gray-800/40">
              <div className="text-2xl sm:text-4xl font-extrabold text-white font-mono tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                18,400+
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 font-medium flex items-center justify-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tickets Minted</span>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="p-4 rounded-xl bg-gray-900/30 border border-gray-800/40">
              <div className="text-2xl sm:text-4xl font-extrabold text-white font-mono tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                0%
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 font-medium flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scalping Rate</span>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="p-4 rounded-xl bg-gray-900/30 border border-gray-800/40">
              <div className="text-2xl sm:text-4xl font-extrabold text-white font-mono tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                100%
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1 font-medium flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                <span>On-Chain Verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SEARCH & FILTER TOOLBAR & EVENTS CATALOGUE */}
      <section id="catalogue" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Live Web3 Catalogue</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Explore Upcoming Events</h2>
          </div>
          <p className="text-sm text-gray-400 max-w-md">
            Discover verified events, mint NFT tickets instantly, and experience fraud-proof entry verification.
          </p>
        </div>

        {/* Toolbar Container */}
        <div className="flex flex-col gap-4 p-4 rounded-2xl bg-[#0B0F17] border border-gray-800 shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Interactive Text Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search events, venues, organizers, or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900/90 border border-gray-800 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sorting Toggle Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900/90 border border-gray-800 text-xs text-gray-300 w-full md:w-auto">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-gray-400 hidden sm:inline">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer w-full"
                >
                  <option value="date" className="bg-[#0B0F17]">Date (Soonest)</option>
                  <option value="price-low" className="bg-[#0B0F17]">Price (Low to High)</option>
                  <option value="price-high" className="bg-[#0B0F17]">Price (High to Low)</option>
                  <option value="popularity" className="bg-[#0B0F17]">Popularity / Quota</option>
                </select>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_FILTERS.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                    isActive
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-950/40"
                      : "bg-gray-900/60 hover:bg-gray-800 text-gray-300 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events Grid / Empty State */}
        {sortedEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-12 rounded-2xl bg-[#0B0F17] border border-gray-800 text-center space-y-4 my-8"
          >
            <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center border border-gray-800 text-gray-400">
              <Search className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">No events match your criteria</h3>
              <p className="text-sm text-gray-400 max-w-sm">
                Try adjusting your search query or switching category filters to view available event passes.
              </p>
            </div>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </motion.div>
        )}
      </section>

      {/* 4. VALUE PROPOSITION SECTION */}
      <section className="w-full border-t border-gray-800/80 bg-gradient-to-b from-[#07090E] via-[#0B0F17]/80 to-[#07090E] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Architecture Highlights</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Why Next-Gen Event Organizers Choose AuthenTix
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Built from the ground up to solve event ticket scalping, touting, and counterfeit passes using Ethereum smart contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Optimism Sepolia L2 Speed */}
            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl bg-[#0B0F17] border border-gray-800 hover:border-emerald-500/30 transition-all duration-300 space-y-4 relative overflow-hidden group shadow-lg"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                Optimism Sepolia L2 Speed
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Lightning-fast sub-second transaction finality with near-zero gas fees powered by Layer-2 rollup scalability.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Instant Ticket Minting & Transfer</span>
              </div>
            </motion.div>

            {/* Card 2: Dynamic 30s Anti-Scalping QR Engine */}
            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl bg-[#0B0F17] border border-gray-800 hover:border-cyan-500/30 transition-all duration-300 space-y-4 relative overflow-hidden group shadow-lg"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                Dynamic 30s Anti-Scalping QR Engine
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Time-variant cryptographic QR codes generated locally with signature hashes. Eliminates screenshot duplicates & unauthorized touting.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs text-cyan-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Max Resale Price Capping Enforced</span>
              </div>
            </motion.div>

            {/* Card 3: Embedded Wallet Gasless Purchase */}
            <motion.div
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl bg-[#0B0F17] border border-gray-800 hover:border-purple-500/30 transition-all duration-300 space-y-4 relative overflow-hidden group shadow-lg"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                Embedded Wallet Gasless Purchase
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Seamless Web2 user onboarding with Social login, Passkeys, and Account Abstraction for completely gasless checkout.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs text-purple-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero Crypto Friction for Mainstream Buyers</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
