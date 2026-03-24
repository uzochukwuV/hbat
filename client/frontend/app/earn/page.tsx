"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAgent } from "@/hooks/useAgent";
import { useChart } from "@/hooks/useChart";
import { useOptionsVault } from "@/hooks/useOptionsVault";
import { useOptionAnalytics } from "@/hooks/useOptionAnalytics";
import { usePrices } from "@/hooks/usePrices";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolio } from "@/hooks/usePortfolio";
import type { UnsignedTransaction } from "@/types";

// ─── Inline spark line chart using SVG ────────────────────────────────────────
function SparkLine({ data, color = "#f97316" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  const isUp = data[data.length - 1] >= data[0];
  const fill = isUp ? "#22c55e" : "#ef4444";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={fill} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Candlestick / OHLC chart ─────────────────────────────────────────────────
function OHLCChart({ data }: { data: { open: number; high: number; low: number; close: number }[] }) {
  if (!data.length) return (
    <div className="h-full flex items-center justify-center text-white/20 text-xs tracking-widest uppercase">
      Loading chart…
    </div>
  );

  const slice = data.slice(-40);
  const allPrices = slice.flatMap((d) => [d.high, d.low]);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;
  const h = 160;
  const barW = 6;
  const gap = 2;

  return (
    <svg
      viewBox={`0 0 ${slice.length * (barW + gap)} ${h}`}
      className="w-full"
      style={{ height: h }}
      preserveAspectRatio="none"
    >
      {slice.map((c, i) => {
        const x = i * (barW + gap);
        const isUp = c.close >= c.open;
        const color = isUp ? "#22c55e" : "#ef4444";
        const bodyTop = h - (((isUp ? c.close : c.open) - min) / range) * h;
        const bodyBot = h - (((isUp ? c.open : c.close) - min) / range) * h;
        const wickTop = h - ((c.high - min) / range) * h;
        const wickBot = h - ((c.low - min) / range) * h;
        return (
          <g key={i}>
            <line
              x1={x + barW / 2}
              y1={wickTop}
              x2={x + barW / 2}
              y2={wickBot}
              stroke={color}
              strokeWidth="1"
              opacity="0.5"
            />
            <rect
              x={x}
              y={bodyTop}
              width={barW}
              height={Math.max(1, bodyBot - bodyTop)}
              fill={color}
              opacity="0.85"
              rx="1"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── PnL payoff diagram ────────────────────────────────────────────────────────
function PayoffChart({
  curve,
  breakeven,
  maxLoss,
}: {
  curve: { pnl: number }[];
  breakeven: number;
  maxLoss: number;
}) {
  if (!curve.length) return null;
  const pnls = curve.map((p) => p.pnl);
  const min = Math.min(...pnls);
  const max = Math.max(...pnls);
  const range = max - min || 1;
  const w = 300;
  const h = 100;

  const pts = pnls
    .map((v, i) => `${(i / (pnls.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");

  const zeroY = h - ((0 - min) / range) * h;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4" />
      <polyline
        points={pts}
        fill="none"
        stroke="url(#payoffGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="payoffGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Greek badge ───────────────────────────────────────────────────────────────
function GreekBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className="text-[9px] text-white/30 uppercase font-bold tracking-[0.2em]">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}

// ─── Transaction Confirmation Modal ─────────────────────────────────────────────
function TransactionModal({
  tx,
  isOpen,
  isProcessing,
  onConfirm,
  onCancel,
}: {
  tx: UnsignedTransaction | null;
  isOpen: boolean;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen || !tx) return null;

  const formatValue = (value: string) => {
    const wei = BigInt(value || "0");
    const hbar = Number(wei) / 1e18;
    return hbar.toFixed(6);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{ background: "#0c1017", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}
            >
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Confirm Transaction</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Review and sign with wallet</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* To Address */}
          <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Contract</p>
            <p className="text-xs font-mono text-white/70 break-all">{tx.to}</p>
          </div>

          {/* Value */}
          <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Value</p>
            <p className="text-lg font-mono font-bold text-orange-400">{formatValue(tx.value)} HBAR</p>
          </div>

          {/* Data Preview */}
          <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Data</p>
            <p className="text-[10px] font-mono text-white/40 break-all line-clamp-2">
              {tx.data?.slice(0, 66)}...
            </p>
          </div>

          {/* Gas */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/30">Est. Gas</span>
            <span className="font-mono text-white/60">{tx.gasLimit?.toLocaleString() ?? "—"}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            style={{
              background: isProcessing ? "rgba(249,115,22,0.3)" : "#f97316",
              color: isProcessing ? "rgba(0,0,0,0.5)" : "#000",
            }}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing…
              </span>
            ) : (
              "Sign & Submit"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function TradingDashboard() {
  const [activeSymbol, setActiveSymbol] = useState<any>("HBAR");
  const [userInput, setUserInput] = useState("");
  const [tab, setTab] = useState<"analytics" | "positions">("analytics");
  const [showTxModal, setShowTxModal] = useState(false);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; hash?: string; error?: string } | null>(null);
  const [userCollateral, setUserCollateral] = useState<string>("0");
  const [greeks, setGreeks] = useState<{
    delta: string;
    gamma: string;
    vega: string;
    theta: string;
    rho: string;
    iv: string;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Hooks
  const wallet = useWallet();
  const { messages, sendMessage, isLoading: agentLoading, clearHistory, pendingTransaction, clearPendingTransaction } = useAgent(wallet.address ?? undefined);
  const { priceData, latestPrice, startRealTimeUpdates, isLoading: chartLoading } = useChart(activeSymbol);
  const { supportedSymbols, quotePremium, isLoading: vaultLoading, riskFreeRate, getAvailableCollateral } = useOptionsVault();
  const { prices, startAutoRefresh } = usePrices();
  const { options: portfolioOptions, summary: portfolioSummary, isLoading: portfolioLoading, refresh: refreshPortfolio } = usePortfolio(wallet.address);

  // Analytics wired to live price
  const strike = (latestPrice || 0) * 1.05;
  const premium = 0.005;
  const { analytics } = useOptionAnalytics("CALL", strike, latestPrice || 0, premium, 7, "long");

  // Show transaction modal when AI returns a pending transaction
  useEffect(() => {
    if (pendingTransaction && wallet.isConnected) {
      setShowTxModal(true);
    }
  }, [pendingTransaction, wallet.isConnected]);

  // Fetch user collateral when wallet connects
  useEffect(() => {
    const fetchCollateral = async () => {
      if (wallet.isConnected && wallet.address) {
        const collateral = await getAvailableCollateral(wallet.address);
        setUserCollateral(collateral);
      } else {
        setUserCollateral("0");
      }
    };
    fetchCollateral();
  }, [wallet.isConnected, wallet.address, getAvailableCollateral]);

  // Fetch Greeks from contract when price/strike changes
  useEffect(() => {
    const fetchGreeks = async () => {
      if (!latestPrice || latestPrice <= 0) return;

      try {
        // Quote a sample option to get Greeks
        const strikeWad = BigInt(Math.floor(strike * 1e18));
        const expiryTs = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60); // 7 days
        const sizeWad = BigInt(1e18); // 1 unit
        const sigmaWad = BigInt(Math.floor(0.8 * 1e18)); // 80% IV

        const result = await quotePremium({
          symbol: activeSymbol,
          optionType: 0, // CALL
          strikeWad,
          expiry: expiryTs,
          sizeWad,
          sigmaWad,
        });

        if (result) {
          // Convert from WAD (1e18) format to readable numbers
          const formatGreek = (val: bigint, scale: number = 1e18) => {
            const num = Number(val) / scale;
            return num >= 0 ? num.toFixed(4) : `−${Math.abs(num).toFixed(4)}`;
          };

          setGreeks({
            delta: formatGreek(result.greeks.delta),
            gamma: formatGreek(result.greeks.gamma),
            vega: formatGreek(result.greeks.vega),
            theta: formatGreek(result.greeks.theta),
            rho: formatGreek(result.greeks.rho),
            iv: "80%", // Using input IV for now
          });
        }
      } catch (err) {
        console.error("Failed to fetch Greeks:", err);
        // Keep showing placeholder values on error
      }
    };

    fetchGreeks();
  }, [latestPrice, strike, activeSymbol, quotePremium]);

  useEffect(() => {
    startRealTimeUpdates(5000);
    startAutoRefresh(10000);
  }, [startRealTimeUpdates, startAutoRefresh]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentLoading]);

  // Handle transaction confirmation
  const handleConfirmTransaction = useCallback(async () => {
    if (!pendingTransaction || !wallet.isConnected) return;

    setIsProcessingTx(true);
    setTxResult(null);

    try {
      const txHash = await wallet.signTransaction(pendingTransaction);
      setTxResult({ success: true, hash: txHash });
      clearPendingTransaction();
      setShowTxModal(false);

      // Add success message to chat
      await sendMessage(`Transaction submitted successfully! Hash: ${txHash}`);
    } catch (err: any) {
      setTxResult({ success: false, error: err.message || "Transaction failed" });
    } finally {
      setIsProcessingTx(false);
    }
  }, [pendingTransaction, wallet, clearPendingTransaction, sendMessage]);

  // Handle transaction cancellation
  const handleCancelTransaction = useCallback(() => {
    clearPendingTransaction();
    setShowTxModal(false);
    setTxResult(null);
  }, [clearPendingTransaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || agentLoading) return;
    const text = userInput;
    setUserInput("");
    await sendMessage(text);
  };

  const priceChange = priceData.length > 1
    ? ((priceData[priceData.length - 1]?.close - priceData[0]?.close) / priceData[0]?.close) * 100
    : 0;
  const isUp = priceChange >= 0;

  const sparkValues = priceData.slice(-20).map((d) => d.close);

  const quickPrompts = [
    "Buy a $0.08 HBAR call expiring Friday",
    "What's the IV for HBAR?",
    "Quote me a put at -5%",
  ];

  return (
    <div
      className="flex h-screen font-mono overflow-hidden"
      style={{ background: "#080b0f", color: "#e2e8f0" }}
    >
      {/* ── LEFT: Asset Panel ─────────────────────────── */}
      <aside
        className="w-64 flex flex-col flex-shrink-0 border-r"
        style={{ borderColor: "rgba(255,255,255,0.05)", background: "#090d12" }}
      >
        {/* Logo / brand */}
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#f97316" }}>
            <span className="text-[8px] font-black text-black">OP</span>
          </div>
          <span className="text-xs font-bold tracking-[0.15em] text-white uppercase">OptiVault</span>
          <span className="ml-auto text-[9px] text-green-400 tracking-widest font-bold">● LIVE</span>
        </div>

        {/* Wallet Connection */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {wallet.isConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div>
                  <p className="text-[10px] font-mono text-white/60">
                    {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                  </p>
                  <p className="text-[9px] text-white/30">{wallet.accountId}</p>
                </div>
              </div>
              <button
                onClick={wallet.disconnect}
                className="text-[9px] text-white/30 hover:text-red-400 transition-colors uppercase tracking-widest"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={wallet.connect}
              disabled={wallet.isLoading || !wallet.isInitialized}
              className="w-full py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
              style={{
                background: wallet.isLoading ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.15)",
                color: wallet.isLoading ? "rgba(249,115,22,0.5)" : "#f97316",
                border: "1px solid rgba(249,115,22,0.25)",
              }}
            >
              {wallet.isLoading ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>

        {/* Asset list */}
        <div className="px-3 pt-4 pb-2">
          <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold px-2 mb-2">Markets</p>
          {(supportedSymbols.length ? supportedSymbols : ["HBAR", "BTC", "ETH"]).map((s) => {
            const livePrice = prices[s]?.price ?? (s === activeSymbol ? latestPrice : null);
            const active = s === activeSymbol;
            return (
              <button
                key={s}
                onClick={() => setActiveSymbol(s)}
                className="w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-150 group"
                style={{
                  background: active ? "rgba(249,115,22,0.12)" : "transparent",
                  border: active ? "1px solid rgba(249,115,22,0.25)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-bold ${active ? "text-orange-400" : "text-white/60 group-hover:text-white/80"}`}>{s}</p>
                    <p className="text-[9px] text-white/25 mt-0.5">{s}/USD Perpetual</p>
                  </div>
                  <div className="text-right">
                    {livePrice ? (
                      <>
                        <p className="text-xs font-mono text-white/80">
                          ${livePrice < 1 ? livePrice.toFixed(5) : livePrice.toFixed(2)}
                        </p>
                        {s === activeSymbol && (
                          <p className={`text-[9px] font-mono ${isUp ? "text-green-400" : "text-red-400"}`}>
                            {isUp ? "+" : ""}{priceChange.toFixed(2)}%
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[9px] text-white/20">—</p>
                    )}
                  </div>
                </div>
                {active && <div className="mt-2"><SparkLine data={sparkValues} /></div>}
              </button>
            );
          })}
        </div>

        {/* Session info */}
        <div className="mt-auto px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between text-[9px] text-white/20 uppercase tracking-widest">
            <span>Risk-Free Rate</span>
            <span className="font-mono text-white/40">{parseFloat(riskFreeRate || "0").toFixed(2)}%</span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-white/20 uppercase tracking-widest mt-1.5">
            <span>Hedera Network</span>
            <span className="text-green-400">● Connected</span>
          </div>
        </div>
      </aside>

      {/* ── CENTER: Chart + AI Terminal ───────────────── */}
      <main className="flex-1 flex flex-col min-w-0" style={{ background: "#080b0f" }}>

        {/* Chart header */}
        <div className="px-6 pt-4 pb-0 border-b flex items-center gap-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div>
            <p className="text-lg font-bold text-white">{activeSymbol}
              <span className="text-white/30 font-normal text-sm ml-2">/ USD</span>
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white">
              ${latestPrice ? (latestPrice < 1 ? latestPrice.toFixed(5) : latestPrice.toFixed(2)) : "—"}
            </span>
            <span className={`text-sm font-mono font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>
              {isUp ? "▲" : "▼"} {Math.abs(priceChange).toFixed(2)}%
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {["1H", "4H", "1D", "1W"].map((r) => (
              <button key={r} className="text-[9px] font-bold tracking-widest text-white/30 hover:text-orange-400 transition-colors uppercase">{r}</button>
            ))}
          </div>
        </div>

        {/* OHLC Chart */}
        <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", height: 220 }}>
          {chartLoading && !priceData.length ? (
            <div className="h-full flex items-center justify-center text-white/20 text-xs tracking-widest uppercase animate-pulse">
              Fetching price data…
            </div>
          ) : (
            <div className="h-full flex flex-col justify-end">
              <OHLCChart data={priceData} />
              <div className="flex justify-between mt-1 text-[9px] text-white/20 font-mono">
                {priceData.slice(-5).map((d, i) => (
                  <span key={i}>{new Date(d.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Terminal */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-2 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.25em]">AI Terminal</span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[9px] text-white/20 hover:text-red-400 transition-colors uppercase tracking-widest"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-6 text-center py-8">
                <div className="w-10 h-10 rounded-full border border-orange-500/20 flex items-center justify-center animate-pulse">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                </div>
                <p className="text-[10px] font-bold text-white/15 uppercase tracking-[0.3em] max-w-xs">
                  Options AI Agent Ready
                </p>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => setUserInput(p)}
                      className="text-[10px] text-white/30 hover:text-orange-400 hover:border-orange-500/30 border border-white/5 rounded-lg px-4 py-2.5 text-left transition-all duration-150 font-mono"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role !== "user" && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center mr-2 mt-0.5 flex-shrink-0"
                    style={{ background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.3)" }}>
                    <span className="text-[7px] font-black text-orange-400">AI</span>
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-xl text-xs leading-relaxed ${
                    m.role === "user"
                      ? "text-black font-bold rounded-tr-sm"
                      : "text-white/70 rounded-tl-sm border border-white/[0.07]"
                  }`}
                  style={{
                    background: m.role === "user" ? "#f97316" : "rgba(255,255,255,0.03)",
                  }}
                >
                  {m.content}
                  <p className="text-[8px] mt-1 opacity-40 font-mono">
                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </div>
            ))}

            {agentLoading && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.3)" }}>
                  <span className="text-[7px] font-black text-orange-400">AI</span>
                </div>
                <div className="flex gap-1 px-4 py-3 rounded-xl rounded-tl-sm border border-white/[0.07]"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-orange-500 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input dock */}
          <div className="px-6 pb-5 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="e.g. 'Buy a $0.08 HBAR Call expiring Friday'…"
                disabled={agentLoading}
                className="flex-1 rounded-xl px-4 py-3 text-xs text-white/80 placeholder-white/20 outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(249,115,22,0.4)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              />
              <button
                type="submit"
                disabled={agentLoading || !userInput.trim()}
                className="px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-150"
                style={{
                  background: agentLoading || !userInput.trim() ? "rgba(249,115,22,0.2)" : "#f97316",
                  color: agentLoading || !userInput.trim() ? "rgba(249,115,22,0.5)" : "#000",
                }}
              >
                {agentLoading ? "…" : "Run"}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* ── RIGHT: Analytics Panel ────────────────────── */}
      <aside
        className="w-72 flex flex-col flex-shrink-0 border-l"
        style={{ borderColor: "rgba(255,255,255,0.05)", background: "#090d12" }}
      >
        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {(["analytics", "positions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors"
              style={{
                color: tab === t ? "#f97316" : "rgba(255,255,255,0.2)",
                borderBottom: tab === t ? "1px solid #f97316" : "1px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "analytics" && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>

            {/* Strategy header */}
            <div>
              <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold mb-3">Strategy</p>
              <div className="flex gap-2">
                {["CALL", "PUT"].map((t) => (
                  <div key={t}
                    className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black tracking-widest uppercase ${t === "CALL" ? "text-orange-400" : "text-white/20"}`}
                    style={{
                      background: t === "CALL" ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${t === "CALL" ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-white/30 mb-1">Strike</p>
                  <p className="font-mono text-white/70">${strike.toFixed(5)}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-white/30 mb-1">Premium</p>
                  <p className="font-mono text-white/70">${premium.toFixed(4)}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-white/30 mb-1">Expiry</p>
                  <p className="font-mono text-white/70">7 days</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-white/30 mb-1">Type</p>
                  <p className="font-mono text-orange-400">Long</p>
                </div>
              </div>
            </div>

            {/* Payoff chart */}
            <div>
              <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold mb-3">P&L Curve</p>
              <div
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                {analytics ? (
                  <>
                    <PayoffChart
                      curve={analytics.pnlCurve}
                      breakeven={analytics.breakeven}
                      maxLoss={analytics.maxLoss}
                    />
                    <div className="flex justify-between mt-3 text-[9px] font-mono">
                      <span className="text-red-400">−${analytics.maxLoss.toFixed(4)}</span>
                      <span className="text-white/30">BE ${analytics.breakeven.toFixed(4)}</span>
                      <span className="text-green-400">+∞</span>
                    </div>
                  </>
                ) : (
                  <div className="h-24 flex items-center justify-center text-white/20 text-[10px] animate-pulse">
                    Calculating…
                  </div>
                )}
              </div>
            </div>

            {/* Greeks */}
            <div>
              <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold mb-3">Greeks</p>
              <div className="grid grid-cols-2 gap-2">
                <GreekBadge label="Delta" value={greeks?.delta ?? "—"} color="text-blue-400" />
                <GreekBadge label="Gamma" value={greeks?.gamma ?? "—"} color="text-purple-400" />
                <GreekBadge label="Theta" value={greeks?.theta ?? "—"} color="text-red-400" />
                <GreekBadge label="Vega" value={greeks?.vega ?? "—"} color="text-teal-400" />
                <GreekBadge label="Rho" value={greeks?.rho ?? "—"} color="text-yellow-400" />
                <GreekBadge label="IV" value={greeks?.iv ?? "—"} color="text-orange-400" />
              </div>
            </div>

            {/* Key levels */}
            <div>
              <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold mb-3">Key Levels</p>
              {[
                { label: "Spot", value: latestPrice?.toFixed(5) ?? "—", color: "#f97316" },
                { label: "Breakeven", value: analytics?.breakeven.toFixed(5) ?? "—", color: "#22c55e" },
                { label: "Strike", value: strike.toFixed(5), color: "#60a5fa" },
                { label: "Max Loss", value: `$${analytics?.maxLoss.toFixed(4) ?? "—"}`, color: "#ef4444" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <span className="text-[10px] text-white/30">{label}</span>
                  <span className="text-[10px] font-mono font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "positions" && (
          <div className="flex-1 flex flex-col px-5 py-5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {/* Collateral Section */}
            {wallet.isConnected && (
              <div className="mb-5">
                <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold mb-3">Your Collateral</p>
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40">Available HBAR</span>
                    <span className="text-lg font-mono font-bold text-orange-400">
                      {parseFloat(userCollateral).toFixed(4)}
                    </span>
                  </div>
                  {wallet.balance && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <span className="text-[10px] text-white/30">Wallet Balance</span>
                      <span className="text-xs font-mono text-white/50">
                        {(parseFloat(wallet.balance) / 1e18).toFixed(4)} HBAR
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Portfolio Summary */}
            {wallet.isConnected && portfolioSummary && (
              <div className="mb-5">
                <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold mb-3">Summary</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[9px] text-white/30 mb-1">Written</p>
                    <p className="text-sm font-mono text-white/70">{portfolioSummary.totalWritten}</p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[9px] text-white/30 mb-1">Bought</p>
                    <p className="text-sm font-mono text-white/70">{portfolioSummary.totalBought}</p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[9px] text-white/30 mb-1">Premiums In</p>
                    <p className="text-sm font-mono text-green-400">+{portfolioSummary.totalPremiumsReceived}</p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[9px] text-white/30 mb-1">Premiums Out</p>
                    <p className="text-sm font-mono text-red-400">−{portfolioSummary.totalPremiumsPaid}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Positions List */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-bold">Active Positions</p>
                {wallet.isConnected && (
                  <button
                    onClick={refreshPortfolio}
                    disabled={portfolioLoading}
                    className="text-[9px] text-white/30 hover:text-orange-400 transition-colors uppercase tracking-widest"
                  >
                    {portfolioLoading ? "…" : "↻"}
                  </button>
                )}
              </div>

              {portfolioLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : portfolioOptions.length > 0 ? (
                <div className="space-y-2">
                  {portfolioOptions.filter(o => o.status === "active").map((option) => (
                    <div
                      key={option.tokenId}
                      className="p-3 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded ${
                              option.optionType === "CALL" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {option.optionType}
                          </span>
                          <span className="text-xs font-bold text-white/70">{option.symbol}</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold ${option.isWriter ? "text-purple-400" : "text-blue-400"}`}
                        >
                          {option.isWriter ? "WRITER" : "BUYER"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-white/30">Strike: </span>
                          <span className="font-mono text-white/60">${parseFloat(option.strikeWad).toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="text-white/30">Size: </span>
                          <span className="font-mono text-white/60">{parseFloat(option.sizeWad).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-white/30">Premium: </span>
                          <span className="font-mono text-orange-400">{parseFloat(option.premiumWad).toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="text-white/30">Expiry: </span>
                          <span className="font-mono text-white/60">
                            {new Date(option.expiry * 1000).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ border: "1px dashed rgba(255,255,255,0.1)" }}
                  >
                    <span className="text-white/20 text-lg">∅</span>
                  </div>
                  <p className="text-[10px] text-white/20 uppercase tracking-[0.25em] font-bold text-center">
                    {wallet.isConnected ? "No Active Positions" : "Connect Wallet to View"}
                  </p>
                  <button
                    onClick={() => { setTab("analytics"); setUserInput("Open a new position"); }}
                    className="text-[9px] font-black uppercase tracking-widest px-5 py-2.5 rounded-lg transition-colors"
                    style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)" }}
                  >
                    + Open Position
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom status */}
        <div className="px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-white/20 uppercase tracking-widest">Vault</span>
            <span className={`uppercase tracking-widest font-bold ${vaultLoading ? "text-yellow-400" : "text-green-400"}`}>
              {vaultLoading ? "● Syncing" : "● Ready"}
            </span>
          </div>
        </div>
      </aside>

      {/* Transaction Confirmation Modal */}
      <TransactionModal
        tx={pendingTransaction}
        isOpen={showTxModal}
        isProcessing={isProcessingTx}
        onConfirm={handleConfirmTransaction}
        onCancel={handleCancelTransaction}
      />

      {/* Transaction Result Toast */}
      {txResult && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4"
          style={{
            background: txResult.success ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${txResult.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          <div className="flex items-center gap-3">
            {txResult.success ? (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <div>
              <p className={`text-xs font-bold ${txResult.success ? "text-green-400" : "text-red-400"}`}>
                {txResult.success ? "Transaction Submitted" : "Transaction Failed"}
              </p>
              {txResult.hash && (
                <p className="text-[10px] font-mono text-white/40 mt-0.5">
                  {txResult.hash.slice(0, 10)}...{txResult.hash.slice(-8)}
                </p>
              )}
              {txResult.error && (
                <p className="text-[10px] text-red-400/70 mt-0.5">{txResult.error}</p>
              )}
            </div>
            <button
              onClick={() => setTxResult(null)}
              className="ml-2 text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}