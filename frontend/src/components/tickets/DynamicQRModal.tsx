"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, ShieldCheck, Clock, Copy, Check, Sparkles, AlertCircle } from "lucide-react";
import { TicketItem } from "@/lib/mockData";

interface DynamicQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: TicketItem | null;
}

function generateNonce(): string {
  const hex = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `nc_${hex}`;
}

export function DynamicQRModal({ isOpen, onClose, ticket }: DynamicQRModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [nonce, setNonce] = useState<string>(generateNonce());
  const [copied, setCopied] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Generate deterministic grid pattern based on nonce string
  const generateGrid = useCallback((nonceStr: string) => {
    const size = 15;
    const grid: boolean[][] = [];
    let hash = 0;
    for (let i = 0; i < nonceStr.length; i++) {
      hash = (hash << 5) - hash + nonceStr.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        // Exclude center badge area (rows 5..9, cols 5..9)
        if (r >= 5 && r <= 9 && c >= 5 && c <= 9) {
          row.push(false);
        }
        // Exclude finder pattern areas
        else if (
          (r < 4 && c < 4) ||
          (r < 4 && c >= size - 4) ||
          (r >= size - 4 && c < 4)
        ) {
          row.push(false);
        } else {
          const bit = Math.abs((hash * (r * size + c + 1) * 31) % 100) > 42;
          row.push(bit);
        }
      }
      grid.push(row);
    }
    return grid;
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setNonce(generateNonce());
    setTimeLeft(30);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => {
    if (!isOpen) return;

    // Reset when modal opens
    setTimeLeft(30);
    setNonce(generateNonce());

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setNonce(generateNonce());
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleCopyNonce = () => {
    navigator.clipboard.writeText(nonce);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = (timeLeft / 30) * 100;
  const qrGrid = generateGrid(nonce);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
          className="relative z-10 w-full max-w-md bg-[#0B0F17]/95 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl overflow-hidden"
        >
          {/* Ambient Background Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Dynamic Entry QR
                </h3>
                <p className="text-xs text-gray-400">
                  {ticket ? ticket.eventTitle : "AuthenTix Cryptographic Gate Pass"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Ticket Token Metadata Badge */}
          {ticket && (
            <div className="mt-4 px-3.5 py-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs">
              <span className="text-gray-400">
                Token ID: <span className="text-emerald-400 font-mono font-bold">{ticket.tokenId}</span>
              </span>
              <span className="text-gray-400 truncate max-w-[180px]">
                {ticket.venue}
              </span>
            </div>
          )}

          {/* Dynamic QR Graphic Display Container */}
          <div className="my-6 flex flex-col items-center justify-center">
            <div className="relative group">
              {/* Outer Glowing Border Effect */}
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500 opacity-75 blur-md group-hover:opacity-100 transition duration-500 animate-pulse" />

              {/* QR Code Card Frame */}
              <div className="relative p-5 bg-[#07090E] border border-white/10 rounded-2xl flex flex-col items-center justify-center shadow-2xl">
                {/* SVG Matrix Rendering */}
                <div className="relative w-56 h-56 bg-white p-3 rounded-xl flex items-center justify-center shadow-inner overflow-hidden">
                  <svg
                    viewBox="0 0 100 100"
                    className={`w-full h-full transition-opacity duration-300 ${
                      isRefreshing ? "opacity-30" : "opacity-100"
                    }`}
                  >
                    {/* Background */}
                    <rect width="100" height="100" fill="#FFFFFF" />

                    {/* Top-Left Finder Square */}
                    <rect x="5" y="5" width="24" height="24" fill="#07090E" rx="3" />
                    <rect x="9" y="9" width="16" height="16" fill="#FFFFFF" rx="2" />
                    <rect x="13" y="13" width="8" height="8" fill="#10B981" rx="1.5" />

                    {/* Top-Right Finder Square */}
                    <rect x="71" y="5" width="24" height="24" fill="#07090E" rx="3" />
                    <rect x="75" y="9" width="16" height="16" fill="#FFFFFF" rx="2" />
                    <rect x="79" y="13" width="8" height="8" fill="#10B981" rx="1.5" />

                    {/* Bottom-Left Finder Square */}
                    <rect x="5" y="71" width="24" height="24" fill="#07090E" rx="3" />
                    <rect x="9" y="75" width="16" height="16" fill="#FFFFFF" rx="2" />
                    <rect x="13" y="79" width="8" height="8" fill="#10B981" rx="1.5" />

                    {/* Matrix Cells */}
                    {qrGrid.map((row, r) =>
                      row.map((cell, c) => {
                        if (!cell) return null;
                        const cellWidth = 5.3;
                        const x = 5 + c * cellWidth;
                        const y = 5 + r * cellWidth;
                        return (
                          <rect
                            key={`${r}-${c}`}
                            x={x}
                            y={y}
                            width={cellWidth - 0.4}
                            height={cellWidth - 0.4}
                            fill="#07090E"
                            rx="0.5"
                          />
                        );
                      })
                    )}
                  </svg>

                  {/* Center AuthenTix Logo Badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-[#07090E] border-2 border-emerald-400 p-1 flex items-center justify-center shadow-lg">
                      <div className="w-full h-full rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scannable live status */}
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Signature Live & Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live 30-Second Countdown Ticker Section */}
          <div className="space-y-3 p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Auto-Refresh Ticker</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">
                Expires in {timeLeft}s
              </span>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-2 rounded-full bg-gray-800 overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-all duration-300 ${
                  timeLeft <= 5
                    ? "bg-rose-500"
                    : timeLeft <= 10
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-emerald-400 to-cyan-400"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Nonce Display Box */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-gray-400 font-mono truncate">
                Nonce: <span className="text-gray-200 font-semibold">{nonce}</span>
              </span>
              <button
                onClick={handleCopyNonce}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors ml-2"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Security Notice Box */}
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-semibold text-rose-200">Anti-Duplication Security:</span>{" "}
              Screenshots are automatically rejected. Venue scanner verifies live cryptographic signature on-chain.
            </p>
          </div>

          {/* Action Button: Refresh QR Manually */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh QR Manually</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
