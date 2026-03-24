"use client";

import { useWallet } from "@/hooks/useWallet";
import { usePrices } from "@/hooks/usePrices";
import { useEffect, useState } from "react";

import { config } from "@/lib/config";

// Component: Modern Data Row for Institutional stats
const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-3 border-b border-white/5 group hover:bg-white/[0.02] px-2 transition-colors">
    <span className="text-[12px] text-white/40 uppercase tracking-widest">{label}</span>
    <span className="text-sm font-mono text-white/80">{value}</span>
  </div>
);

export default function Home() {
  const { isConnected, accountId, connect, disconnect } = useWallet();
  const { getPrice, startAutoRefresh, stopAutoRefresh } = usePrices();

  useEffect(() => {
    startAutoRefresh(5000);
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500/30 selection:text-orange-200 font-sans overflow-x-hidden">
      
      {/* BACKGROUND LAYER: Grain + Mesh + Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] brightness-150"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:64px_64px]"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-8 h-20 flex justify-between items-center">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-6 h-6 bg-orange-600 rounded-sm rotate-45 group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-sm font-black tracking-tighter uppercase">H-OPTIONS</span>
            </div>
            <div className="hidden lg:flex gap-8 text-[11px] font-bold uppercase tracking-widest text-white/40">
              <Link href="/dashboard" className="hover:text-orange-500 transition-colors">Dashboard</Link>
               <Link href="/earn" className="hover:text-orange-500 transition-colors">Earn</Link>
              <a href="#" className="hover:text-orange-500 transition-colors">Institutional</a>
              <a href="#" className="hover:text-orange-500 transition-colors">API Docs</a>
            </div>
          </div>
          
          <button 
            onClick={isConnected ? disconnect : connect}
            className="group relative text-[11px] font-bold uppercase tracking-widest px-8 py-3 bg-white text-black rounded-full overflow-hidden transition-all"
          >
            <span className="relative z-10">{isConnected ? accountId?.slice(0, 8) : "Connect Terminal"}</span>
            <div className="absolute inset-0 bg-orange-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
        </div>
      </nav>

      <main className="relative z-10 pt-48">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-8 mb-40 text-center md:text-left">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500 mb-10">
                <span className="w-1 h-1 bg-orange-500 rounded-full animate-pulse"></span>
                Hedera Mainnet Ready
              </div>
              <h1 className="text-7xl md:text-9xl font-bold tracking-[ -0.04em] leading-[0.85] mb-10">
                Trade <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">The Void.</span>
              </h1>
              <p className="text-lg text-white/40 leading-relaxed max-w-lg mb-12 font-medium">
                The world’s first hyper-speed options protocol for Hedera. 
                Built for institutions, powered by automated settlement and deep-liquidity vaults.
              </p>
              <div className="flex flex-wrap gap-5 justify-center md:justify-start">
                <button className="px-10 py-5 bg-orange-600 text-white rounded-xl font-bold text-[13px] uppercase tracking-widest hover:bg-orange-500 transition-all shadow-[0_0_40px_-10px_rgba(234,88,12,0.5)]">
                  Execute Trade
                </button>
                <button className="px-10 py-5 bg-white/5 border border-white/10 rounded-xl font-bold text-[13px] uppercase tracking-widest hover:bg-white/10 transition-all">
                  View Analytics
                </button>
              </div>
            </div>

            {/* Institutional Trust Panel */}
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <div className="w-32 h-32 border-4 border-orange-500 rounded-full"></div>
               </div>
               <h3 className="text-xs font-bold text-orange-500 uppercase tracking-[0.3em] mb-8">Protocol Integrity</h3>
               <div className="space-y-2">
                  <DataRow label="Network Latency" value="< 0.5s" />
                  <DataRow label="Settlement Core" value="HIP-1215" />
                  <DataRow label="Oracle Provider" value="Pyth Network" />
                  <DataRow label="Audited By" value="OpenZeppelin" />
                  <DataRow label="Max Leverage" value="15.0x" />
               </div>
               <div className="mt-8 pt-8 border-t border-white/5 text-center font-mono text-[10px] text-white/20 uppercase tracking-widest">
                  Secure Institutional Gateway v4.2.0
               </div>
            </div>
          </div>
        </section>

        {/* Live Market Prices */}
        <section className="border-t border-white/5 py-16">
          <div className="max-w-7xl mx-auto px-8">
            <div className="mb-12">
              <h2 className="text-3xl font-bold mb-2">Live Market Prices</h2>
              <p className="text-white/40 text-sm">Real-time price feeds from Pyth Network</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { symbol: "HBAR", name: "Hedera" },
                { symbol: "BTC", name: "Bitcoin" },
                { symbol: "ETH", name: "Ethereum" },
                { symbol: "XAU", name: "Gold" },
                { symbol: "EUR", name: "Euro" }
              ].map((asset) => {
                const price = getPrice(asset.symbol);
                return (
                  <div key={asset.symbol} className="p-4 rounded-lg border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{asset.name}</div>
                    <div className="text-2xl font-bold mb-1">${(price || 0).toFixed(4)}</div>
                    <div className="text-xs text-orange-500">Live</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Market Health */}
        <MarketHealth getPrice={getPrice} />

        {/* Feature Marquee / Grid */}
        <section className="border-t border-white/5 py-32 bg-gradient-to-b from-transparent to-orange-500/[0.02]">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid md:grid-cols-3 gap-1px bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
              {[
                { t: "Deep Liquidity", d: "Aggregated order books providing minimal slippage for large-scale institutional entries." },
                { t: "Native Greeks", d: "High-fidelity Delta and Gamma calculations handled via off-chain compute with on-chain verification." },
                { t: "Non-Custodial", d: "Your keys, your options. All collateral is locked in audited Hedera Smart Contracts." }
              ].map((f, i) => (
                <div key={i} className="bg-[#050505] p-12 hover:bg-white/[0.01] transition-colors group">
                  <div className="w-8 h-[1px] bg-orange-600 mb-8 group-hover:w-16 transition-all duration-500"></div>
                  <h4 className="text-xl font-bold mb-4">{f.t}</h4>
                  <p className="text-sm text-white/40 leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <StrategyVisualizer />

        <ProtocolCore />



        {/* Call to Action */}
        <section className="py-40 text-center relative">
           <div className="max-w-2xl mx-auto px-8">
              <h2 className="text-5xl font-bold tracking-tight mb-8 leading-[1.1]">The Future of <br/>Hedera Trading is Here.</h2>
              <p className="text-white/40 mb-12">Seamlessly integrate our SDK into your institutional workflow or trade directly via the H-Terminal.</p>
              <button className="px-12 py-6 bg-white text-black rounded-2xl font-black uppercase text-[14px] tracking-[0.1em] hover:scale-105 transition-transform">
                Get API Keys
              </button>
           </div>
        </section>
      </main>

      <footer className="py-12 border-t border-white/5 relative z-10 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">© 2026 H-OPTIONS PROTOCOL // HEDERA</p>
          <div className="flex gap-10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}




import { useOptionAnalytics } from "@/hooks/useOptionAnalytics";
import Link from "next/link";

export const StrategyVisualizer = () => {
  // Mock data for the section - replace with real state if needed
  const { analytics } = useOptionAnalytics("CALL", 0.08, 0.075, 0.005, 7, "long", 0.85);

  return (
    <section className="max-w-7xl mx-auto px-8 py-32 border-t border-white/5">
      <div className="grid lg:grid-cols-[1fr_400px] gap-16 items-start">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-4">Risk Architecture.</h2>
          <p className="text-white/40 mb-12 max-w-md">
            Visualize payoff curves with institutional-grade precision. 
            Real-time Black-Scholes Greeks updated every 400ms.
          </p>
          
          {/* Payoff Chart Placeholder - Using pure CSS/Tailwind for the 'vibe' */}
          <div className="relative h-[400px] w-full bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            
            {/* The "Curve" - Simplified SVG representation */}
            <svg className="absolute inset-0 w-full h-full opacity-80 p-6" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice">
              <defs>
                <clipPath id="chartClip">
                  <rect x="0" y="0" width="960" height="400" />
                </clipPath>
              </defs>
              <path
                d="M 40 360 L 500 360 L 850 80"
                fill="none"
                stroke="#EA580C"
                strokeWidth="3"
                strokeLinecap="round"
                clipPath="url(#chartClip)"
                className="drop-shadow-[0_0_15px_rgba(234,88,12,0.4)]"
              />
              <line x1="500" y1="20" x2="500" y2="380" stroke="white" strokeOpacity="0.1" strokeDasharray="4" clipPath="url(#chartClip)" />
            </svg>
            
            <div className="absolute top-6 left-6 flex gap-4">
              <div className="px-3 py-1 bg-orange-600/10 border border-orange-500/20 rounded text-[10px] font-bold text-orange-500 uppercase tracking-widest">Payoff Curve</div>
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/40 uppercase tracking-widest">HBAR Long Call</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
            <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-6">Position Analytics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-white/40">Breakeven</span>
                <span className="text-sm font-mono">${analytics?.breakeven.toFixed(4) || "0.0850"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-white/40">Max Profit</span>
                <span className="text-sm font-mono text-green-400">Unlimited</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-white/40">Max Loss</span>
                <span className="text-sm font-mono text-orange-500">-${analytics?.maxLoss.toFixed(4) || "0.0050"}</span>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase text-white/20">Implied Vol</span>
                <span className="text-2xl font-light">85.2%</span>
              </div>
            </div>
            <button className="w-full mt-8 py-4 bg-white text-black text-[12px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-500 hover:text-white transition-all">
              Confirm Strategy
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};



export const ProtocolCore = () => {
  return (
    <section className="py-32 bg-[#080808]">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div className="order-2 lg:order-1">
             <div className="relative rounded-xl border border-white/10 bg-black p-1 overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                   <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/10"></div>
                      <div className="w-2 h-2 rounded-full bg-white/10"></div>
                      <div className="w-2 h-2 rounded-full bg-white/10"></div>
                   </div>
                   <span className="text-[10px] font-mono text-white/20 ml-4">HIP1215_SETTLEMENT_ENGINE.sol</span>
                </div>
                <div className="p-6 font-mono text-sm text-white/40 leading-relaxed">
                  <p><span className="text-orange-500">function</span> <span className="text-white">executeSettlement</span>(uint256 optionId) external {'{'}</p>
                  <p className="pl-6 text-blue-400">// Automatic trigger via Hedera Scheduled Transactions</p>
                  <p className="pl-6">require(block.timestamp &gt;= expiry, <span className="text-green-400">"Early"</span>);</p>
                  <p className="pl-6">_transferCollateral(winner, amount);</p>
                  <p className="pl-6 text-white/20">emit SettlementComplete(optionId, winner);</p>
                  <p>{'}'}</p>
                </div>
             </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-xs font-bold text-orange-500 uppercase tracking-[0.4em] mb-6">The Infrastructure</h2>
            <h3 className="text-5xl font-bold tracking-tight mb-8">Zero-Latency <br/>Automation.</h3>
            <p className="text-white/40 leading-relaxed mb-10">
              Traditional options rely on centralized "keepers" to settle trades.
              Our protocol leverages <strong>Hedera Scheduled Transactions</strong> to guarantee execution
              at the exact microsecond of expiry. No bots, no delays, no extra fees.
            </p>
            <ul className="space-y-4">
              {["ABFT Consensus Finality", "Direct Pyth Oracle Integration", "EVM-Equivalent Security"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium">
                  <span className="w-4 h-[1px] bg-orange-500"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export const MarketHealth = ({ getPrice }: { getPrice: (symbol: string) => number | null }) => {
  const hbarPrice = getPrice("HBAR") || 0.08;
  const btcPrice = getPrice("BTC") || 40000;
  const ethPrice = getPrice("ETH") || 2500;

  return (
    <section className="border-t border-white/5 py-20">
      <div className="max-w-7xl mx-auto px-8">
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2">Market Health</h2>
          <p className="text-white/40 text-sm">Protocol status and market metrics</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">24h Volume</div>
            <div className="text-2xl font-bold mb-2">${(hbarPrice * 1000000).toFixed(0)}</div>
            <div className="text-xs text-green-400">+12.5% from yesterday</div>
          </div>

          <div className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Options Written</div>
            <div className="text-2xl font-bold mb-2">3,847</div>
            <div className="text-xs text-green-400">+8.2% this week</div>
          </div>

          <div className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Implied Volatility</div>
            <div className="text-2xl font-bold mb-2">68.3%</div>
            <div className="text-xs text-orange-400">Elevated</div>
          </div>

          <div className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Settlement Health</div>
            <div className="text-2xl font-bold mb-2">99.8%</div>
            <div className="text-xs text-green-400">Optimal</div>
          </div>
        </div>
      </div>
    </section>
  );
};