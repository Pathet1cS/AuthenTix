import { ShieldCheck, Ticket, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 bg-[#07090E] min-h-screen">
      <main className="flex flex-col items-center justify-center max-w-4xl w-full text-center space-y-8">
        <div className="flex items-center space-x-3 px-4 py-2 rounded-full glass-card border border-emerald-500/30 text-emerald-400 text-sm font-medium">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>AuthenTix Scaffolding Ready</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">
          AuthenTix Protocol
        </h1>

        <p className="text-lg text-gray-400 max-w-xl">
          Decentralized & Fraud-Proof NFT Event Ticketing System built on Ethereum Smart Contracts.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mt-8">
          <div className="glass-card-hover p-6 rounded-2xl text-left space-y-3">
            <Ticket className="w-8 h-8 text-cyan-400" />
            <h3 className="text-xl font-semibold text-white">Verified Tickets</h3>
            <p className="text-sm text-gray-400">
              NFT-backed tickets guaranteeing authenticity and secondary market price capping.
            </p>
          </div>

          <div className="glass-card-hover p-6 rounded-2xl text-left space-y-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <h3 className="text-xl font-semibold text-white">Dynamic Anti-Scalping</h3>
            <p className="text-sm text-gray-400">
              On-chain dynamic QR verification and anti-touting mechanisms built-in.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
