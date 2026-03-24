/**
 * TypeScript Type Definitions
 */

// ── Wallet Types ─────────────────────────────────────────────────────────────

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  accountId: string | null; // Hedera account ID (e.g., "0.0.12345")
  balance: string | null; // HBAR balance in wei
}

export interface WalletConnection {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: UnsignedTransaction) => Promise<string>;
}

// ── Transaction Types ────────────────────────────────────────────────────────

export interface UnsignedTransaction {
  to: string;
  value: string;
  data: string;
  gasLimit: number;
}

export interface SignedTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  data: string;
}

// ── AI Agent Types ───────────────────────────────────────────────────────────

export interface AgentMessage {
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

export interface AgentChatRequest {
  message: string;
  sessionId: string;
  userAddress?: string;
}

export interface AgentChatResponse {
  message: string;
  rawMessage: string;
  unsignedTx: UnsignedTransaction | null;
  hasTransaction: boolean;
  timestamp: number;
}

// ── Options Contract Types ───────────────────────────────────────────────────

export type OptionType = "CALL" | "PUT";

export interface Option {
  id: number;
  optionType: OptionType;
  asset: string;
  strike: string; // in wei
  expiry: number; // unix timestamp
  size: string; // amount of underlying
  premium: string; // in wei
  writer: string;
  buyer: string | null;
  exercised: boolean;
  expired: boolean;
  collateral: string; // in wei
}

export interface Greeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface OptionQuote {
  premium: string;
  collateral: string;
  greeks: Greeks;
  impliedVolatility: number;
}

// ── Price Feed Types ─────────────────────────────────────────────────────────

export interface PriceData {
  price: number;
  expo: number;
  publishTime: number;
}

export interface PriceFeed {
  symbol: string;
  priceData: PriceData;
  confidence: string;
}

// ── Contract Interaction Types ───────────────────────────────────────────────

export interface WriteOptionParams {
  optionType: OptionType;
  asset: string;
  strike: string;
  expiry: number;
  size: string;
}

export interface BuyOptionParams {
  optionId: number;
  premium: string;
}

export interface ExerciseOptionParams {
  optionId: number;
}

// ── UI State Types ───────────────────────────────────────────────────────────

export interface Portfolio {
  options: Option[];
  totalCollateral: string;
  totalPremiumsEarned: string;
  totalPremiumsPaid: string;
  activePositions: number;
}

export interface MarketData {
  prices: Record<string, PriceData>;
  volatility: Record<string, number>;
  openInterest: string;
  totalVolume: string;
}
