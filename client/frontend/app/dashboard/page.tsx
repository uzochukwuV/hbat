"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useChart } from "@/hooks/useChart";
import { useOptionsVault } from "@/hooks/useOptionsVault";
import { useWallet } from "@/hooks/useWallet";
import { useVaultActions } from "@/hooks/useVaultActions";
import { useAgent } from "@/hooks/useAgent";
import { OptionType } from "@/lib/contracts";
import { ethers } from "ethers";
import type { UnsignedTransaction } from "@/types";

export const dynamic = 'force-dynamic';

// Simple price formatter
const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined) return "--";
  return price.toFixed(4);
};

// Format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toFixed(2);
};

interface Position {
  id: string;
  symbol: string;
  type: "CALL" | "PUT";
  strike: number;
  expiry: number;
  size: number;
  collateral: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  status: "open" | "closed";
}

interface Order {
  id: string;
  type: "buy" | "sell";
  symbol: string;
  strike: number;
  expiry: number;
  price: number;
  size: number;
  time: string;
  status: "pending" | "filled" | "cancelled";
}

interface TradeHistory {
  id: string;
  txHash: string;
  type: "deposit" | "withdraw" | "write_option" | "exercise" | "transfer";
  symbol?: string;
  amount?: number;
  strike?: number;
  timestamp: number;
  status: "success" | "failed";
}

export default function TradingDashboard() {
  // State
  const [activeSymbol, setActiveSymbol] = useState("HBAR");
  const [symbolPrices, setSymbolPrices] = useState<Record<string, number>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  
  // Trade form state
  const [tradeForm, setTradeForm] = useState({
    optionType: "CALL" as "CALL" | "PUT",
    strikePrice: "",
    expiryDays: 7,
    quantity: "1",
    orderType: "limit" as "limit" | "market",
    limitPrice: "",
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions");

  // Initialize hooks
  const { priceData, latestPrice, startRealTimeUpdates } = useChart(activeSymbol as any);
  const { supportedSymbols: vaultSymbols, getAvailableCollateral, collateralTokens, fetchSupportedSymbols, fetchUserPositions } = useOptionsVault();
  const supportedSymbols = vaultSymbols.length > 0 ? vaultSymbols : ["HBAR", "BTC", "ETH", "SOL"];
  
  const wallet = useWallet();
  const { buildWriteOptionTx, buildDepositHBARTx, previewQuote, estimateCollateral } = useVaultActions();

  // AI Agent
  const agent = useAgent(wallet.address ?? undefined);
  const [chatInput, setChatInput] = useState("");
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [showTxModal, setShowTxModal] = useState(false);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; hash?: string; error?: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agent.messages]);

  // Show transaction modal when agent returns a transaction
  useEffect(() => {
    if (agent.pendingTransaction) {
      setShowTxModal(true);
      setTxResult(null);
    }
  }, [agent.pendingTransaction]);

  // Handle chat message send
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || agent.isLoading) return;

    const message = chatInput.trim();
    setChatInput("");

    try {
      await agent.sendMessage(message);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }, [chatInput, agent]);

  // Handle transaction confirmation
  const handleConfirmTransaction = useCallback(async () => {
    if (!agent.pendingTransaction || !wallet.isConnected) return;

    setIsProcessingTx(true);
    setTxResult(null);

    try {
      const txHash = await wallet.signTransaction(agent.pendingTransaction);
      setTxResult({ success: true, hash: txHash });

      // Add to trade history
      const txType = getTxType(agent.pendingTransaction);
      const historyEntry: TradeHistory = {
        id: `tx-${Date.now()}`,
        txHash: txHash,
        type: txType.toLowerCase().includes("deposit") ? "deposit"
            : txType.toLowerCase().includes("withdraw") ? "withdraw"
            : txType.toLowerCase().includes("option") ? "write_option"
            : txType.toLowerCase().includes("exercise") ? "exercise"
            : "transfer",
        symbol: activeSymbol,
        amount: agent.pendingTransaction.value ? Number(BigInt(agent.pendingTransaction.value)) / 1e18 : undefined,
        timestamp: Date.now(),
        status: "success",
      };
      setTradeHistory(prev => [historyEntry, ...prev]);

      // Refresh balance and positions after transaction
      setTimeout(() => {
        wallet.refreshBalance();
        // Refresh positions
        if (wallet.accountId) {
          fetchUserPositions?.(wallet.accountId);
        }
      }, 3000);
    } catch (err: any) {
      setTxResult({ success: false, error: err.message || "Transaction failed" });

      // Add failed transaction to history
      const txType = getTxType(agent.pendingTransaction);
      const historyEntry: TradeHistory = {
        id: `tx-${Date.now()}`,
        txHash: "",
        type: txType.toLowerCase().includes("deposit") ? "deposit"
            : txType.toLowerCase().includes("withdraw") ? "withdraw"
            : txType.toLowerCase().includes("option") ? "write_option"
            : txType.toLowerCase().includes("exercise") ? "exercise"
            : "transfer",
        symbol: activeSymbol,
        timestamp: Date.now(),
        status: "failed",
      };
      setTradeHistory(prev => [historyEntry, ...prev]);
    } finally {
      setIsProcessingTx(false);
    }
  }, [agent.pendingTransaction, wallet, activeSymbol, fetchUserPositions]);

  // Handle transaction cancel/close
  const handleCloseTxModal = useCallback(() => {
    setShowTxModal(false);
    setTxResult(null);
    agent.clearPendingTransaction();
  }, [agent]);

  // Format transaction value for display
  // Value from agent is in wei (1e18 = 1 HBAR for EVM compatibility)
  const formatTxValue = (value: string): string => {
    try {
      const wei = BigInt(value);
      const hbar = Number(wei) / 1e18; // Wei to HBAR (1e18 wei = 1 HBAR)
      return hbar.toFixed(4) + " HBAR";
    } catch {
      return value;
    }
  };

  // Detect transaction type from data
  const getTxType = (tx: UnsignedTransaction): string => {
    const data = tx.data.toLowerCase();
    if (data.startsWith("0x")) {
      // Check function selectors
      if (data.startsWith("0xd0e30db0") || data.length <= 10) return "Deposit HBAR";
      if (data.includes("writeoption") || data.startsWith("0x")) {
        // Check if it's a writeOption call (has complex params)
        if (data.length > 100) return "Write Option";
      }
      if (data.startsWith("0x2e1a7d4d")) return "Withdraw";
      if (data.startsWith("0xddf252ad")) return "Exercise Option";
    }
    return "Contract Call";
  };

  // Fetch prices for all symbols
  useEffect(() => {
    const fetchPrices = async () => {
      const prices: Record<string, number> = {};
      const { fetchLatestPrice } = await import("@/lib/pyth-charts");
      
      for (const sym of supportedSymbols) {
        try {
          const price = await fetchLatestPrice(sym as any);
          prices[sym] = price?.price ?? 0;
        } catch {
          prices[sym] = 0;
        }
      }
      setSymbolPrices(prices);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 15000);
    return () => clearInterval(interval);
  }, [supportedSymbols]);

  // Initialize real-time price updates for active symbol
  useEffect(() => {
    if (activeSymbol && latestPrice) {
      startRealTimeUpdates?.();
    }
  }, [activeSymbol, latestPrice, startRealTimeUpdates]);

  // Fetch user positions from contract and Mirror Node
  useEffect(() => {
    const fetchPositions = async () => {
      if (!wallet.isConnected || !wallet.accountId) return;

      setIsLoadingPositions(true);
      try {
        // Try to fetch positions from the contract
        const pos = await fetchUserPositions?.(wallet.accountId);
        if (pos && pos.length > 0) {
          const transformed: Position[] = pos.map((p: any, i: number) => ({
            id: `pos-${p.tokenId || i}`,
            symbol: p.symbol || activeSymbol,
            type: p.optionType === 0 ? "CALL" : "PUT",
            strike: parseFloat(p.strikePrice) || 0,
            expiry: p.expiryDays || 7,
            size: parseFloat(p.size) || 0,
            collateral: parseFloat(p.collateral) || 0,
            entryPrice: p.entryPrice || latestPrice || 0,
            currentPrice: latestPrice || 0,
            pnl: (latestPrice || 0) - (p.entryPrice || 0),
            status: p.settled ? "closed" : "open" as const,
          }));
          setPositions(transformed);
        }
      } catch (err) {
        console.error("Failed to fetch positions:", err);
      } finally {
        setIsLoadingPositions(false);
      }
    };

    fetchPositions();
    // Poll for position updates
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, [wallet.isConnected, wallet.accountId, fetchUserPositions, activeSymbol, latestPrice]);

  // Calculate portfolio stats
  const totalCollateral = positions.reduce((sum, p) => sum + p.collateral, 0);
  const totalPnL = positions.reduce((sum, p) => sum + (p.pnl * p.size), 0);
  const openPositions = positions.filter(p => p.status === "open").length;

  // Handle trade submission
  const handleTrade = useCallback(async () => {
    if (!wallet.isConnected || !tradeForm.quantity || !tradeForm.strikePrice) return;

    // Build transaction based on trade type
    const expiryTimestamp = Date.now() + (tradeForm.expiryDays * 24 * 60 * 60 * 1000);
    const optionTypeValue = tradeForm.optionType === "CALL" ? OptionType.Call : OptionType.Put;
    const txData = buildWriteOptionTx({
      symbol: activeSymbol,
      optionType: optionTypeValue,
      strikePrice: tradeForm.strikePrice,
      expiryTimestamp: Math.floor(expiryTimestamp / 1000),
      size: tradeForm.quantity,
      volatility: "0.5", // Default 50% IV
      collateralToken: "0x0000000000000000000000000000000000000000",
      maxPremium: tradeForm.limitPrice || "0",
    });

    // Add order to local state (would normally go through contract)
    const newOrder: Order = {
      id: `order-${Date.now()}`,
      type: tradeType,
      symbol: activeSymbol,
      strike: parseFloat(tradeForm.strikePrice),
      expiry: tradeForm.expiryDays,
      price: tradeForm.orderType === "market" ? (latestPrice || 0) : parseFloat(tradeForm.limitPrice || "0"),
      size: parseInt(tradeForm.quantity),
      time: new Date().toLocaleTimeString(),
      status: "pending" as const,
    };

    setOrders(prev => [newOrder, ...prev]);
    setShowTradeModal(false);
    setTradeForm({
      optionType: "CALL",
      strikePrice: "",
      expiryDays: 7,
      quantity: "1",
      orderType: "limit",
      limitPrice: "",
    });
  }, [wallet.isConnected, tradeForm, tradeType, activeSymbol, latestPrice, buildWriteOptionTx]);

  // Generate mock option chain data
  const generateOptionChain = useCallback(() => {
    const currentPrice = latestPrice || 0;
    const strikes = [];
    const range = currentPrice * 0.1; // 10% range
    
    for (let i = -5; i <= 5; i++) {
      const strike = currentPrice + (i * (range / 5));
      strikes.push({
        strike: strike.toFixed(2),
        callBid: (strike * 0.05).toFixed(3),
        callAsk: (strike * 0.055).toFixed(3),
        putBid: (strike * 0.045).toFixed(3),
        putAsk: (strike * 0.05).toFixed(3),
      });
    }
    return strikes;
  }, [latestPrice]);

  const optionChain = generateOptionChain();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="h-14 bg-[#111] border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-orange-500">Options Trading</h1>
          <span className="text-xs text-white/40">|</span>
          <nav className="flex gap-4 text-xs">
            <button className="text-white/60 hover:text-white">Markets</button>
            <button className="text-white">Trade</button>
            <button className="text-white/60 hover:text-white">Portfolio</button>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {wallet.isConnected ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-white/40">Wallet</p>
                <p className="text-xs font-mono">{wallet.accountId?.slice(0, 12)}...</p>
              </div>
              <div className="h-8 w-8 bg-orange-600/20 rounded-full flex items-center justify-center text-orange-500 text-xs">
                {wallet.accountId?.charAt(0)}
              </div>
            </div>
          ) : (
            <button 
              onClick={wallet.connect}
              className="px-4 py-1.5 bg-orange-600 rounded text-xs font-medium hover:bg-orange-500"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left Sidebar - Watchlist */}
        <aside className="w-56 bg-[#0f0f0f] border-r border-white/5 flex flex-col">
          {/* Symbol Search */}
          <div className="p-3 border-b border-white/5">
            <input 
              type="text"
              placeholder="Search symbols..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500/50"
            />
          </div>

          {/* Watchlist */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wider px-2 mb-2">Watchlist</p>
              {supportedSymbols.map((sym) => (
                <button 
                  key={sym}
                  onClick={() => setActiveSymbol(sym)}
                  className={`w-full flex justify-between items-center px-2 py-2 rounded text-xs transition-colors ${activeSymbol === sym ? 'bg-orange-600/20 text-orange-400' : 'text-white/60 hover:bg-white/5'}`}
                >
                  <span className="font-medium">{sym}</span>
                  <span className="font-mono">${formatPrice(symbolPrices[sym])}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mini Chart */}
          <div className="p-3 border-t border-white/5">
            <div className="h-24 bg-white/5 rounded relative overflow-hidden">
              {priceData.length > 0 ? (
                <div className="absolute inset-0 flex items-end">
                  {priceData.slice(-30).map((p, i) => {
                    const minPrice = Math.min(...priceData.slice(-30).map(x => x.close));
                    const maxPrice = Math.max(...priceData.slice(-30).map(x => x.close));
                    const range = maxPrice - minPrice || 1;
                    const height = ((p.close - minPrice) / range) * 100;
                    return (
                      <div 
                        key={i} 
                        className="flex-1 bg-orange-500/60" 
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/20 text-[10px]">
                  No data
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-white/30">
              <span>24h</span>
              <span className={latestPrice ? "text-green-400" : "text-white/30"}>
                ${formatPrice(latestPrice)}
              </span>
            </div>
          </div>
        </aside>

        {/* Center - Chart & Option Chain */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Chart Area */}
          <div className="h-64 border-b border-white/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{activeSymbol}</span>
                <span className="text-2xl font-mono text-green-400">${formatPrice(latestPrice)}</span>
              </div>
              <div className="flex gap-2">
                {["1H", "4H", "1D", "1W"].map((tf) => (
                  <button 
                    key={tf}
                    className="px-2 py-1 text-[10px] text-white/40 hover:text-white hover:bg-white/5 rounded"
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Main Chart */}
            <div className="h-40 bg-[#0a0a0a] rounded border border-white/5 relative">
              {priceData.length > 0 ? (
                <div className="absolute inset-0 flex items-end">
                  {priceData.slice(-60).map((p, i) => {
                    const minPrice = Math.min(...priceData.slice(-60).map(x => x.close));
                    const maxPrice = Math.max(...priceData.slice(-60).map(x => x.close));
                    const range = maxPrice - minPrice || 1;
                    const height = ((p.close - minPrice) / range) * 90 + 5;
                    return (
                      <div 
                        key={i} 
                        className="flex-1 bg-orange-500/40" 
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
                  Loading chart data...
                </div>
              )}
            </div>
          </div>

          {/* Option Chain */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-white/60">Option Chain</h3>
              <div className="flex gap-2 text-[10px]">
                <span className="text-white/40">Calls</span>
                <span className="text-white/40">|</span>
                <span className="text-white/40">Puts</span>
              </div>
            </div>
            
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  <th className="text-left py-1.5">Strike</th>
                  <th className="text-right">Bid</th>
                  <th className="text-right">Ask</th>
                  <th className="text-right">IV</th>
                  <th className="text-right">Bid</th>
                  <th className="text-right">Ask</th>
                  <th className="text-right">IV</th>
                </tr>
              </thead>
              <tbody>
                {optionChain.map((opt, i) => (
                  <tr 
                    key={i} 
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => {
                      setTradeForm({ ...tradeForm, strikePrice: opt.strike });
                      setShowTradeModal(true);
                    }}
                  >
                    <td className="py-1.5 font-mono">{opt.strike}</td>
                    <td className="text-right text-green-400">{opt.callBid}</td>
                    <td className="text-right text-red-400">{opt.callAsk}</td>
                    <td className="text-right text-white/40">45%</td>
                    <td className="text-right text-green-400">{opt.putBid}</td>
                    <td className="text-right text-red-400">{opt.putAsk}</td>
                    <td className="text-right text-white/40">48%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        {/* Right Sidebar - Trade & Portfolio */}
        <aside className="w-80 bg-[#0f0f0f] border-l border-white/5 flex flex-col">
          {/* Trade Entry */}
          <div className="p-3 border-b border-white/5">
            <div className="flex gap-1 mb-3">
              <button 
                onClick={() => { setTradeType("buy"); setShowTradeModal(true); }}
                className="flex-1 py-2 bg-green-600/20 border border-green-500/30 rounded text-xs font-medium text-green-400 hover:bg-green-600/30"
              >
                Buy
              </button>
              <button 
                onClick={() => { setTradeType("sell"); setShowTradeModal(true); }}
                className="flex-1 py-2 bg-red-600/20 border border-red-500/30 rounded text-xs font-medium text-red-400 hover:bg-red-600/30"
              >
                Sell
              </button>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded p-2">
                <p className="text-[9px] text-white/40">24h Vol</p>
                <p className="text-xs font-mono">2.4M</p>
              </div>
              <div className="bg-white/5 rounded p-2">
                <p className="text-[9px] text-white/40">OI</p>
                <p className="text-xs font-mono">890K</p>
              </div>
              <div className="bg-white/5 rounded p-2">
                <p className="text-[9px] text-white/40">Funding</p>
                <p className="text-xs font-mono">0.01%</p>
              </div>
            </div>
          </div>

          {/* Portfolio Stats */}
          <div className="p-3 border-b border-white/5">
            <h3 className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Portfolio</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Total Value</span>
                <span className="text-xs font-mono">${formatNumber(totalCollateral)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Open Positions</span>
                <span className="text-xs font-mono">{openPositions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Unrealized P&L</span>
                <span className={`text-xs font-mono ${totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {totalPnL >= 0 ? "+" : ""}${formatNumber(totalPnL)}
                </span>
              </div>
            </div>
          </div>

          {/* Positions/Orders Tabs */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex border-b border-white/5">
              <button
                onClick={() => setActiveTab("positions")}
                className={`flex-1 py-2 text-[10px] flex items-center justify-center gap-1 ${activeTab === "positions" ? "text-orange-500 border-b border-orange-500" : "text-white/40 hover:text-white/60"}`}
              >
                Positions
                {positions.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${activeTab === "positions" ? "bg-orange-500/20" : "bg-white/10"}`}>
                    {positions.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 py-2 text-[10px] flex items-center justify-center gap-1 ${activeTab === "orders" ? "text-orange-500 border-b border-orange-500" : "text-white/40 hover:text-white/60"}`}
              >
                Orders
                {orders.filter(o => o.status === "pending").length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${activeTab === "orders" ? "bg-orange-500/20" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {orders.filter(o => o.status === "pending").length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-2 text-[10px] flex items-center justify-center gap-1 ${activeTab === "history" ? "text-orange-500 border-b border-orange-500" : "text-white/40 hover:text-white/60"}`}
              >
                History
                {tradeHistory.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${activeTab === "history" ? "bg-orange-500/20" : "bg-white/10"}`}>
                    {tradeHistory.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {activeTab === "positions" && (
                isLoadingPositions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                    <span className="ml-2 text-[10px] text-white/40">Loading positions...</span>
                  </div>
                ) : positions.length > 0 ? (
                  <div className="space-y-2">
                    {positions.map((pos) => (
                      <div key={pos.id} className="bg-white/5 rounded p-2 border border-white/5 hover:border-orange-500/30 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{pos.symbol}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${pos.type === "CALL" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                              {pos.type}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${pos.status === "open" ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white/40"}`}>
                              {pos.status}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(4)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px] text-white/40 mt-1">
                          <span>Strike: ${pos.strike.toFixed(4)}</span>
                          <span>Size: {pos.size} units</span>
                          <span>Entry: ${pos.entryPrice.toFixed(4)}</span>
                          <span>Current: ${pos.currentPrice.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-white/5">
                          <span className="text-[9px] text-white/30">Collateral: {pos.collateral} HBAR</span>
                          {pos.status === "open" && (
                            <button className="text-[9px] text-orange-400 hover:text-orange-300">
                              Close
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-white/5 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="text-[10px] text-white/30">No open positions</p>
                    {wallet.isConnected ? (
                      <p className="text-[9px] text-white/20 mt-1">Use the AI agent to write options</p>
                    ) : (
                      <p className="text-[9px] text-white/20 mt-1">Connect wallet to view positions</p>
                    )}
                  </div>
                )
              )}

              {activeTab === "orders" && (
                orders.length > 0 ? (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div key={order.id} className="bg-white/5 rounded p-2 border border-white/5 hover:border-orange-500/30 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-medium ${order.type === "buy" ? "text-green-400" : "text-red-400"}`}>
                              {order.type.toUpperCase()}
                            </span>
                            <span className="text-xs font-medium">{order.symbol}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                              order.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                              order.status === "filled" ? "bg-green-500/20 text-green-400" :
                              "bg-red-500/20 text-red-400"
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <span className="text-[9px] text-white/30">{order.time}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px] text-white/40">
                          <span>Strike: ${order.strike.toFixed(4)}</span>
                          <span>Qty: {order.size}</span>
                          <span>Price: ${order.price.toFixed(4)}</span>
                          <span>Expiry: {order.expiry}d</span>
                        </div>
                        {order.status === "pending" && (
                          <div className="flex justify-end mt-2 pt-1.5 border-t border-white/5">
                            <button
                              onClick={() => setOrders(prev => prev.filter(o => o.id !== order.id))}
                              className="text-[9px] text-red-400 hover:text-red-300"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-white/5 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-[10px] text-white/30">No active orders</p>
                    <p className="text-[9px] text-white/20 mt-1">Orders will appear here</p>
                  </div>
                )
              )}

              {activeTab === "history" && (
                tradeHistory.length > 0 ? (
                  <div className="space-y-2">
                    {tradeHistory.map((trade) => (
                      <div key={trade.id} className="bg-white/5 rounded p-2 border border-white/5">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                              trade.type === "deposit" ? "bg-green-500/20 text-green-400" :
                              trade.type === "withdraw" ? "bg-red-500/20 text-red-400" :
                              trade.type === "write_option" ? "bg-blue-500/20 text-blue-400" :
                              trade.type === "exercise" ? "bg-purple-500/20 text-purple-400" :
                              "bg-white/10 text-white/60"
                            }`}>
                              {trade.type.replace("_", " ").toUpperCase()}
                            </span>
                            {trade.symbol && (
                              <span className="text-xs text-white/60">{trade.symbol}</span>
                            )}
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                            trade.status === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {trade.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] text-white/40 mt-1">
                          {trade.amount && <span>Amount: {trade.amount.toFixed(4)} HBAR</span>}
                          <span>{new Date(trade.timestamp).toLocaleString()}</span>
                        </div>
                        {trade.txHash && (
                          <div className="mt-1.5 pt-1.5 border-t border-white/5">
                            <a
                              href={`https://hashscan.io/testnet/transaction/${trade.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] text-orange-400 hover:text-orange-300 font-mono truncate block"
                            >
                              {trade.txHash.slice(0, 20)}...
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-white/5 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-[10px] text-white/30">No trade history</p>
                    <p className="text-[9px] text-white/20 mt-1">Completed transactions will appear here</p>
                  </div>
                )
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Trade Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowTradeModal(false)}>
          <div className="bg-[#111] border border-white/10 rounded-xl p-5 w-80" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold">
                {tradeType === "buy" ? "Buy" : "Sell"} {activeSymbol} Option
              </h3>
              <button onClick={() => setShowTradeModal(false)} className="text-white/40 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase block mb-1">Type</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setTradeForm({ ...tradeForm, optionType: "CALL" })}
                    className={`flex-1 py-1.5 text-xs rounded ${tradeForm.optionType === "CALL" ? "bg-green-600/30 text-green-400 border border-green-500/50" : "bg-white/5 text-white/40"}`}
                  >
                    Call
                  </button>
                  <button 
                    onClick={() => setTradeForm({ ...tradeForm, optionType: "PUT" })}
                    className={`flex-1 py-1.5 text-xs rounded ${tradeForm.optionType === "PUT" ? "bg-red-600/30 text-red-400 border border-red-500/50" : "bg-white/5 text-white/40"}`}
                  >
                    Put
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-white/40 uppercase">Strike Price</label>
                  <span className="text-[10px] text-white/30">Current: ${latestPrice?.toFixed(2) || '0.00'}</span>
                </div>
                <input 
                  type="number"
                  value={tradeForm.strikePrice}
                  onChange={(e) => setTradeForm({ ...tradeForm, strikePrice: e.target.value })}
                  placeholder={latestPrice ? latestPrice.toString() : "0.00"}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono"
                />
                <div className="flex gap-1 mt-2">
                  {[-10, -5, -2, 2, 5, 10].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        if (latestPrice) {
                          const newStrike = latestPrice * (1 + pct / 100);
                          setTradeForm({ ...tradeForm, strikePrice: newStrike.toFixed(2) });
                        }
                      }}
                      className={`flex-1 py-1 text-[10px] rounded ${pct < 0 ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}
                    >
                      {pct > 0 ? '+' : ''}{pct}%
                    </button>
                  ))}
                </div>
                {tradeForm.strikePrice && latestPrice && (
                  <div className="mt-2 p-2 bg-white/5 rounded text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-white/40">Strike:</span>
                      <span className="text-white">${parseFloat(tradeForm.strikePrice).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Current:</span>
                      <span className="text-white">${latestPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 mt-1 pt-1">
                      <span className="text-white/40">Diff:</span>
                      <span className={parseFloat(tradeForm.strikePrice) < latestPrice ? "text-green-400" : "text-red-400"}>
                        {parseFloat(tradeForm.strikePrice) < latestPrice ? '+' : ''}{((parseFloat(tradeForm.strikePrice) - latestPrice) / latestPrice * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase block mb-1">Expiry</label>
                <select 
                  value={tradeForm.expiryDays}
                  onChange={(e) => setTradeForm({ ...tradeForm, expiryDays: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                >
                  <option value={1}>1 Day</option>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase block mb-1">Quantity</label>
                <input 
                  type="number"
                  value={tradeForm.quantity}
                  onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })}
                  placeholder="1"
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase block mb-1">Order Type</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setTradeForm({ ...tradeForm, orderType: "limit" })}
                    className={`flex-1 py-1.5 text-xs rounded ${tradeForm.orderType === "limit" ? "bg-orange-600/30 text-orange-400 border border-orange-500/50" : "bg-white/5 text-white/40"}`}
                  >
                    Limit
                  </button>
                  <button 
                    onClick={() => setTradeForm({ ...tradeForm, orderType: "market" })}
                    className={`flex-1 py-1.5 text-xs rounded ${tradeForm.orderType === "market" ? "bg-orange-600/30 text-orange-400 border border-orange-500/50" : "bg-white/5 text-white/40"}`}
                  >
                    Market
                  </button>
                </div>
              </div>

              {tradeForm.orderType === "limit" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-white/40 uppercase">Limit Price</label>
                    <span className="text-[10px] text-white/30">Current: ${latestPrice?.toFixed(2) || '0.00'}</span>
                  </div>
                  <input 
                    type="number"
                    value={tradeForm.limitPrice}
                    onChange={(e) => setTradeForm({ ...tradeForm, limitPrice: e.target.value })}
                    placeholder={latestPrice ? latestPrice.toString() : "0.00"}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono"
                  />
                  <div className="flex gap-1 mt-2">
                    {[-5, -2, 2, 5].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => {
                          if (latestPrice) {
                            const newPrice = latestPrice * (1 + pct / 100);
                            setTradeForm({ ...tradeForm, limitPrice: newPrice.toFixed(2) });
                          }
                        }}
                        className={`flex-1 py-1 text-[10px] rounded ${pct < 0 ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}
                      >
                        {pct > 0 ? '+' : ''}{pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleTrade}
                disabled={!wallet.isConnected || !tradeForm.strikePrice || !tradeForm.quantity}
                className={`w-full py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                  tradeType === "buy"
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-red-600 hover:bg-red-500 text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {wallet.isConnected ? `${tradeType === "buy" ? "Buy" : "Sell"} Option` : "Connect Wallet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Agent Chat Panel */}
      <div className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ${showChatPanel ? 'w-96' : 'w-14'}`}>
        {/* Chat Toggle Button */}
        <button
          onClick={() => setShowChatPanel(!showChatPanel)}
          className="absolute -top-3 -left-3 w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center shadow-lg hover:bg-orange-500 transition-colors z-10"
        >
          {showChatPanel ? (
            <span className="text-white text-lg">×</span>
          ) : (
            <span className="text-white text-sm">AI</span>
          )}
        </button>

        {showChatPanel && (
          <div className="bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-white">AI Trading Agent</span>
                </div>
                <button
                  onClick={() => agent.clearHistory()}
                  className="text-white/70 hover:text-white text-xs"
                >
                  Clear
                </button>
              </div>
              <p className="text-[10px] text-white/70 mt-1">
                Ask me to write options, deposit collateral, or get quotes
              </p>
            </div>

            {/* Chat Messages */}
            <div className="h-64 overflow-y-auto p-3 space-y-3 bg-[#0a0a0a]">
              {agent.messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/30 text-xs">Start a conversation with the AI agent</p>
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] text-white/20">Try:</p>
                    <button
                      onClick={() => setChatInput("Deposit 100 HBAR as collateral")}
                      className="text-[10px] text-orange-400/70 hover:text-orange-400 block"
                    >
                      "Deposit 100 HBAR as collateral"
                    </button>
                    <button
                      onClick={() => setChatInput("Write a 7-day HBAR call at $0.15 strike for 1000 HBAR")}
                      className="text-[10px] text-orange-400/70 hover:text-orange-400 block"
                    >
                      "Write a 7-day HBAR call at $0.15"
                    </button>
                    <button
                      onClick={() => setChatInput("What's the current HBAR price?")}
                      className="text-[10px] text-orange-400/70 hover:text-orange-400 block"
                    >
                      "What's the current HBAR price?"
                    </button>
                  </div>
                </div>
              ) : (
                agent.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                        msg.role === "user"
                          ? "bg-orange-600/30 text-white"
                          : "bg-white/5 text-white/90"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className="text-[9px] text-white/30 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {agent.isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-white/10 bg-[#111]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder={wallet.isConnected ? "Ask the AI agent..." : "Connect wallet to chat"}
                  disabled={!wallet.isConnected || agent.isLoading}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500/50 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!wallet.isConnected || agent.isLoading || !chatInput.trim()}
                  className="px-3 py-2 bg-orange-600 rounded-lg text-xs font-medium hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              {agent.error && (
                <p className="text-red-400 text-[10px] mt-1">{agent.error}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transaction Confirmation Modal */}
      {showTxModal && agent.pendingTransaction && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 w-[420px] max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Confirm Transaction</h3>
                  <p className="text-[10px] text-white/50">{getTxType(agent.pendingTransaction)}</p>
                </div>
              </div>
              <button
                onClick={handleCloseTxModal}
                className="text-white/40 hover:text-white text-xl"
                disabled={isProcessingTx}
              >
                ×
              </button>
            </div>

            {/* Transaction Details */}
            <div className="bg-white/5 rounded-lg p-4 mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/50">To Contract</span>
                <span className="text-xs font-mono text-white">
                  {agent.pendingTransaction.to.slice(0, 8)}...{agent.pendingTransaction.to.slice(-6)}
                </span>
              </div>

              {agent.pendingTransaction.value && agent.pendingTransaction.value !== "0" && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Value</span>
                  <span className="text-sm font-bold text-orange-400">
                    {formatTxValue(agent.pendingTransaction.value)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-xs text-white/50">Gas Limit</span>
                <span className="text-xs font-mono text-white">
                  {agent.pendingTransaction.gasLimit.toLocaleString()}
                </span>
              </div>

              {/* Data preview */}
              <div>
                <span className="text-xs text-white/50">Transaction Data</span>
                <div className="mt-1 bg-black/30 rounded p-2 max-h-20 overflow-y-auto">
                  <code className="text-[10px] text-white/60 font-mono break-all">
                    {agent.pendingTransaction.data.slice(0, 100)}
                    {agent.pendingTransaction.data.length > 100 && "..."}
                  </code>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3 mb-4">
              <div className="flex gap-2">
                <svg className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[10px] text-yellow-200/80">
                  Review the transaction carefully. This will interact with a smart contract on Hedera.
                </p>
              </div>
            </div>

            {/* Result Display */}
            {txResult && (
              <div className={`rounded-lg p-3 mb-4 ${txResult.success ? "bg-green-600/20 border border-green-600/30" : "bg-red-600/20 border border-red-600/30"}`}>
                {txResult.success ? (
                  <div>
                    <p className="text-xs text-green-400 font-medium">Transaction Successful!</p>
                    <p className="text-[10px] text-green-400/70 mt-1 font-mono break-all">
                      Hash: {txResult.hash}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-red-400 font-medium">Transaction Failed</p>
                    <p className="text-[10px] text-red-400/70 mt-1">{txResult.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!txResult?.success && (
                <>
                  <button
                    onClick={handleCloseTxModal}
                    disabled={isProcessingTx}
                    className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmTransaction}
                    disabled={isProcessingTx || !wallet.isConnected}
                    className="flex-1 py-2.5 bg-orange-600 rounded-lg text-xs font-bold text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessingTx ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Signing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Confirm & Sign</span>
                      </>
                    )}
                  </button>
                </>
              )}
              {txResult?.success && (
                <button
                  onClick={handleCloseTxModal}
                  className="flex-1 py-2.5 bg-green-600 rounded-lg text-xs font-bold text-white hover:bg-green-500"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}