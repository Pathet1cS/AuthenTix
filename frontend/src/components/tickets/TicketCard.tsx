"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { QrCode, MapPin, Calendar, ExternalLink, Sparkles, Tag, ShieldCheck } from "lucide-react";
import { TicketItem, MOCK_EVENTS } from "@/lib/mockData";

interface TicketCardProps {
  ticket: TicketItem;
  onShowQR: (ticket: TicketItem) => void;
}

export function TicketCard({ ticket, onShowQR }: TicketCardProps) {
  // Find associated event poster if available
  const matchingEvent = MOCK_EVENTS.find((e) => e.id === ticket.eventId);
  const posterUrl =
    matchingEvent?.posterUrl ||
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop";

  const getStatusBadge = (status: TicketItem["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ACTIVE PASS
          </span>
        );
      case "RESALE":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 backdrop-blur-md shadow-sm">
            <Tag className="w-3 h-3" />
            LISTED FOR RESALE ({ticket.resalePriceEth} ETH)
          </span>
        );
      case "USED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 backdrop-blur-md opacity-80">
            USED / EXPIRED
          </span>
        );
      default:
        return null;
    }
  };

  // Clean raw token ID for URL routing (remove leading #)
  const cleanId = ticket.tokenId.replace("#", "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      className="group relative flex flex-col rounded-3xl bg-[#0B0F17] border border-gray-800/80 hover:border-emerald-500/40 transition-all duration-300 overflow-hidden shadow-xl hover:shadow-emerald-950/25"
    >
      {/* Metallic Border Glow Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-cyan-500/10 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Card Header & Poster */}
      <div className="relative w-full h-48 overflow-hidden bg-gray-900">
        <img
          src={posterUrl}
          alt={ticket.eventTitle}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/40 to-black/50" />

        {/* NFT Token ID Pill - Metallic Styled Badge */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>NFT {ticket.tokenId}</span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-3 right-3">{getStatusBadge(ticket.status)}</div>

        {/* Dynamic NFT Hologram Icon Overlay */}
        <div className="absolute bottom-3 right-3 text-xs text-gray-400/80 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono text-[11px]">Dynamic NFT</span>
        </div>
      </div>

      {/* Ticket Body Content */}
      <div className="flex flex-col flex-1 p-5 space-y-4">
        {/* Title */}
        <Link href={`/my-tickets/${cleanId}`} className="block group/title">
          <h3 className="text-base font-bold text-white group-hover/title:text-emerald-400 transition-colors line-clamp-2 leading-snug">
            {ticket.eventTitle}
          </h3>
        </Link>

        {/* Event Details */}
        <div className="space-y-2 text-xs text-gray-400 border-y border-gray-800/60 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-gray-300">{ticket.eventDate}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span className="truncate">{ticket.venue}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 mt-auto">
          {ticket.status === "ACTIVE" ? (
            <button
              onClick={() => onShowQR(ticket)}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all duration-200 active:scale-[0.98]"
            >
              <QrCode className="w-4 h-4" />
              <span>Show Entry QR</span>
            </button>
          ) : (
            <button
              onClick={() => onShowQR(ticket)}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold bg-gray-800/80 hover:bg-gray-800 text-gray-300 border border-gray-700/60 flex items-center justify-center gap-1.5 transition-colors"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Inspect QR</span>
            </button>
          )}

          <Link
            href={`/my-tickets/${cleanId}`}
            className="py-2.5 px-3.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center gap-1 transition-all"
          >
            <span>Details</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
