"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Clock, ArrowRight, Sparkles } from "lucide-react";
import { EventItem } from "@/lib/mockData";

interface EventCardProps {
  event: EventItem;
}

export function EventCard({ event }: EventCardProps) {
  const sold = event.totalCapacity - event.remainingQuota;
  const soldPercent = Math.min(100, Math.round((sold / event.totalCapacity) * 100));

  const parseDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const month = dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase();
        const day = dateObj.getDate();
        return { month, day };
      }
    } catch {
      // Fallback
    }
    return { month: "AUG", day: "24" };
  };

  const { month, day } = parseDate(event.date);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Tech":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "Concerts":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "Gaming":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Festivals":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      className="group relative flex flex-col h-full rounded-2xl bg-[#0B0F17] border border-gray-800/80 hover:border-emerald-500/40 transition-all duration-300 overflow-hidden shadow-xl hover:shadow-emerald-950/20"
    >
      {/* Poster Image Container */}
      <div className="relative w-full h-52 overflow-hidden bg-gray-900">
        <img
          src={event.posterUrl}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-black/40" />

        {/* Date Badge Overlay */}
        <div className="absolute top-3 left-3 flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 shadow-lg text-center">
          <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
            {month}
          </span>
          <span className="text-lg font-black text-white leading-tight">
            {day}
          </span>
        </div>

        {/* Category Badge & Status Overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {event.status === "SOLD_OUT" && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 backdrop-blur-md">
              SOLD OUT
            </span>
          )}
          {event.status === "ONGOING" && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md animate-pulse">
              LIVE NOW
            </span>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md ${getCategoryColor(
              event.category
            )}`}
          >
            {event.category}
          </span>
        </div>

        {/* Organizer tag */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center text-xs text-gray-300/90 font-medium truncate">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 mr-1.5 flex-shrink-0" />
          <span className="truncate">{event.organizerName}</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-col flex-1 p-5 space-y-4">
        {/* Title */}
        <Link href={`/events/${event.id}`} className="block group/title">
          <h3 className="text-lg font-bold text-white group-hover/title:text-transparent group-hover/title:bg-clip-text group-hover/title:bg-gradient-to-r group-hover/title:from-emerald-400 group-hover/title:to-cyan-400 transition-all duration-300 line-clamp-2">
            {event.title}
          </h3>
        </Link>

        {/* Location & Time Info */}
        <div className="space-y-1.5 text-xs text-gray-400">
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <Clock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>{event.time}</span>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-gray-400">Tickets Quota</span>
            <span className="text-gray-200">
              <span className="text-emerald-400 font-semibold">{sold}</span> / {event.totalCapacity} sold
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-800/80 overflow-hidden p-0.5 border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                soldPercent >= 100
                  ? "bg-rose-500"
                  : soldPercent >= 80
                  ? "bg-gradient-to-r from-amber-500 to-rose-500"
                  : "bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500"
              }`}
              style={{ width: `${soldPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 pt-0.5">
            <span>{soldPercent}% claimed</span>
            <span>{event.remainingQuota} remaining</span>
          </div>
        </div>

        {/* Price & Action CTA */}
        <div className="pt-3 border-t border-gray-800/60 flex items-center justify-between mt-auto">
          <div>
            <span className="text-xs text-gray-400 block">Price</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-emerald-400">
                {event.ticketPriceEth} ETH
              </span>
              <span className="text-xs text-gray-400 font-mono">
                ≈ ${event.ticketPriceUsd.toFixed(2)}
              </span>
            </div>
          </div>

          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 hover:border-emerald-400 transition-all duration-200 group/btn"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
