"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  Ticket,
  KeyRound,
  Radio,
  FileCheck2,
} from "lucide-react";
import { EventItem } from "@/lib/mockData";

interface PurchaseTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
}

type MintStage = "idle" | "processing" | "success";

export function PurchaseTicketModal({
  isOpen,
  onClose,
  event,
}: PurchaseTicketModalProps) {
  const [stage, setStage] = useState<MintStage>("idle");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const txHashFull =
    "0x3a9f4c2e1b3d5a7f9e8c6b4a2f1e3d5c7b9a8f4c2e1b3d5a7f9e8c6b4a2fe810";
  const txHashTruncated = "0x3a9f...e810";
  const tokenId = "#1046";

  const handleStartMint = () => {
    setStage("processing");
    setCurrentStep(1);

    // Step 1 -> Step 2
    setTimeout(() => {
      setCurrentStep(2);
    }, 1500);

    // Step 2 -> Step 3
    setTimeout(() => {
      setCurrentStep(3);
    }, 3000);

    // Step 3 -> Success
    setTimeout(() => {
      setStage("success");
    }, 4500);
  };

  const handleClose = () => {
    onClose();
    // Reset state after animation completes
    setTimeout(() => {
      setStage("idle");
      setCurrentStep(1);
      setCopied(false);
    }, 300);
  };

  const copyTxHash = () => {
    navigator.clipboard.writeText(txHashFull);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
            className="relative w-full max-w-lg bg-[#0B0F17]/95 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/50 backdrop-blur-xl overflow-hidden z-10"
          >
            {/* Background Glow Accents */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-5 border-b border-gray-800/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {stage === "idle" && "Confirm NFT Ticket Mint"}
                    {stage === "processing" && "Minting NFT Ticket"}
                    {stage === "success" && "Ticket Minted!"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Optimism Sepolia • ERC-721 Standard
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STAGE 1: IDLE / ORDER SUMMARY */}
            {stage === "idle" && (
              <div className="mt-6 space-y-6">
                {/* Event Summary Card */}
                <div className="flex gap-4 p-3.5 rounded-2xl bg-gray-900/60 border border-gray-800/80">
                  <img
                    src={event.posterUrl}
                    alt={event.title}
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex flex-col justify-center min-w-0">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit mb-1">
                      {event.category}
                    </span>
                    <h4 className="text-sm font-bold text-white truncate">
                      {event.title}
                    </h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {event.venue}
                    </p>
                    <p className="text-[11px] text-emerald-400/90 font-mono mt-1">
                      {event.date} • {event.time}
                    </p>
                  </div>
                </div>

                {/* Order Breakdown Box */}
                <div className="space-y-3 p-4 rounded-2xl bg-[#07090E]/80 border border-gray-800">
                  <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Order Breakdown
                  </h5>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">1x NFT Ticket (Face Value)</span>
                    <div className="text-right">
                      <span className="font-semibold text-white">
                        {event.ticketPriceEth} ETH
                      </span>
                      <span className="text-xs text-gray-400 block font-mono">
                        ≈ ${event.ticketPriceUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-300">Gasless Relayer Fee</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Covered by Platform
                      </span>
                    </div>
                    <span className="font-semibold text-emerald-400">$0.00</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">Protocol Service Fee</span>
                    <span className="font-semibold text-emerald-400">0.00 ETH</span>
                  </div>

                  <div className="pt-3 border-t border-gray-800 flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Total Cost
                      </span>
                      <span className="text-xs text-gray-400">
                        Includes gasless sponsorship
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400">
                        {event.ticketPriceEth} ETH
                      </span>
                      <span className="text-xs text-gray-400 block font-mono">
                        ≈ ${event.ticketPriceUsd.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Web3 Security Note */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-cyan-300">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong className="text-cyan-200 font-semibold">
                      Account Abstraction Enabled:
                    </strong>{" "}
                    You sign with zero gas fees. Anti-scalping resale cap (+50%) will be enforced by smart contract.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3.5 px-4 rounded-xl text-sm font-semibold text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartMint}
                    className="flex-[2] py-3.5 px-4 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 hover:brightness-110 active:scale-[0.99] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4 fill-black" />
                    <span>Confirm & Mint NFT Ticket</span>
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2: PROCESSING MINT SIMULATOR */}
            {stage === "processing" && (
              <div className="mt-6 space-y-6 text-center py-4">
                {/* Animated Central Graphic */}
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/40"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/40"
                  >
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </motion.div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">
                    Processing Web3 Mint
                  </h4>
                  <p className="text-xs text-gray-400">
                    Communicating with Optimism Sepolia Testnet relayer...
                  </p>
                </div>

                {/* 3-Step Animated Progress Indicator */}
                <div className="space-y-3 text-left p-4 rounded-2xl bg-[#07090E] border border-gray-800/80">
                  {/* Step 1 */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        currentStep > 1
                          ? "bg-emerald-500 text-black"
                          : currentStep === 1
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500 animate-pulse"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {currentStep > 1 ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <KeyRound className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          currentStep >= 1 ? "text-white" : "text-gray-500"
                        }`}
                      >
                        1. Signing Gasless Transaction
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {currentStep === 1
                          ? "Verifying EIP-712 typed signature..."
                          : "Signature verified via Account Abstraction"}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        currentStep > 2
                          ? "bg-emerald-500 text-black"
                          : currentStep === 2
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500 animate-pulse"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {currentStep > 2 ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Radio className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          currentStep >= 2 ? "text-white" : "text-gray-500"
                        }`}
                      >
                        2. Relaying Mint to Optimism Sepolia
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {currentStep === 2
                          ? "Bundling UserOperation to Paymaster..."
                          : currentStep > 2
                          ? "Relayer submitted transaction hash"
                          : "Awaiting execution..."}
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        currentStep === 3
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500 animate-pulse"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          currentStep === 3 ? "text-white" : "text-gray-500"
                        }`}
                      >
                        3. Writing ERC-721 Token Ownership
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {currentStep === 3
                          ? "Minting Token #1046 to recipient wallet..."
                          : "Awaiting block confirmation..."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 h-full"
                    initial={{ width: "10%" }}
                    animate={{
                      width:
                        currentStep === 1
                          ? "33%"
                          : currentStep === 2
                          ? "66%"
                          : "95%",
                    }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            )}

            {/* STAGE 3: SUCCESS STATE */}
            {stage === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 space-y-6 text-center"
              >
                {/* Celebration Icon */}
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                    <div className="w-full h-full rounded-full bg-[#0B0F17] flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-black text-white tracking-tight">
                    Mint Successful!
                  </h4>
                  <p className="text-xs text-gray-400">
                    Your NFT Ticket has been generated & minted on-chain.
                  </p>
                </div>

                {/* Mint Output Card */}
                <div className="p-4 rounded-2xl bg-[#07090E] border border-emerald-500/30 text-left space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                    <span className="text-xs text-gray-400">NFT Token ID</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-sm border border-emerald-500/30">
                      {tokenId}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Transaction Hash</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-gray-200">
                        {txHashTruncated}
                      </span>
                      <button
                        onClick={copyTxHash}
                        className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                        title="Copy Tx Hash"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Network</span>
                    <span className="text-xs text-gray-300 font-medium">
                      Optimism Sepolia (Chain ID 11155420)
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Standard</span>
                    <span className="text-xs text-emerald-400 font-medium">
                      ERC-721 Enforced Resale
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 transition-colors"
                  >
                    Close
                  </button>
                  <Link
                    href="/my-tickets"
                    onClick={handleClose}
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-emerald-400 to-cyan-400 hover:brightness-110 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <span>View My Tickets</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
