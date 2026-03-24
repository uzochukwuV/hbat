/**
 * Pyth Price Chart Integration
 * TradingView-style charts for underlying assets using Pyth Benchmarks API
 */

import { config } from "./config";

export interface PricePoint {
  time: number; // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type TimeResolution = "1" | "5" | "15" | "60" | "240" | "1D";

/**
 * Fetch historical price data from Pyth Benchmarks
 * @param symbol Asset symbol (HBAR, BTC, ETH)
 * @param resolution Timeframe in minutes (1, 5, 15, 60, 240) or "1D"
 * @param fromTimestamp Start time (unix seconds)
 * @param toTimestamp End time (unix seconds)
 */
export async function fetchPythHistoricalData(
  symbol: keyof typeof config.priceFeeds,
  resolution: TimeResolution,
  fromTimestamp: number,
  toTimestamp: number
): Promise<PricePoint[]> {
  const priceId = config.priceFeeds[symbol];

  // Pyth Benchmarks API endpoint
  const baseUrl = "https://benchmarks.pyth.network/v1/shims/tradingview";

  // Convert resolution to Pyth format
  const pythResolution = resolution === "1D" ? "1D" : `${resolution}`;

  // Use format: Crypto.HBAR/USD for benchmarks API
  // If that fails, try with price ID directly
  let url = `${baseUrl}/history?symbol=Crypto.${symbol}/USD&resolution=${pythResolution}&from=${fromTimestamp}&to=${toTimestamp}`;

  try {
    let response = await fetch(url);
    let data = await response.json();
    
    // If first format fails, try price ID format
    if (data.s === 'error') {
      url = `${baseUrl}/history?symbol=${priceId}&resolution=${pythResolution}&from=${fromTimestamp}&to=${toTimestamp}`;
      response = await fetch(url);
      data = await response.json();
    }
    
    // If still fails, return mock data for demo purposes
    if (data.s === 'error') {
      console.warn("Pyth historical data unavailable, using mock data for", symbol);
      return generateMockPriceData(symbol, fromTimestamp, toTimestamp, resolution);
    }

    // Pyth returns data in TradingView format: { t, o, h, l, c, v }
    if (!data.t || data.t.length === 0) {
      return [];
    }

    const pricePoints: PricePoint[] = [];
    for (let i = 0; i < data.t.length; i++) {
      pricePoints.push({
        time: data.t[i],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v?.[i],
      });
    }

    return pricePoints;
  } catch (error) {
    console.error("Failed to fetch Pyth historical data:", error);
    // Return mock data as fallback
    return generateMockPriceData(symbol, fromTimestamp, toTimestamp, resolution);
  }
}

/**
 * Generate mock price data when Pyth API is unavailable
 */
function generateMockPriceData(
  symbol: string,
  fromTimestamp: number,
  toTimestamp: number,
  resolution: TimeResolution
): PricePoint[] {
  const points: PricePoint[] = [];
  const basePrice = symbol === 'HBAR' ? 0.12 : symbol === 'BTC' ? 45000 : symbol === 'ETH' ? 2500 : 100;
  
  const interval = resolution === "1D" ? 86400 : parseInt(resolution) * 60;
  let time = fromTimestamp;
  let price = basePrice;
  
  while (time <= toTimestamp) {
    // Add some random variation
    const change = (Math.random() - 0.5) * basePrice * 0.02;
    price = Math.max(price + change, basePrice * 0.8);
    
    const open = price;
    const close = price + (Math.random() - 0.5) * basePrice * 0.01;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.005;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.005;
    
    points.push({
      time,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000,
    });
    
    time += interval;
  }
  
  return points;
}

/**
 * Fetch latest price update from Pyth Hermes
 */
export async function fetchLatestPrice(
  symbol: keyof typeof config.priceFeeds
): Promise<{ price: number; timestamp: number } | null> {
  const priceId = config.priceFeeds[symbol];
  const url = `${config.pythHermesUrl}/v2/updates/price/latest?ids[]=${priceId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Pyth Hermes API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.parsed || data.parsed.length === 0) {
      return null;
    }

    const priceData = data.parsed[0];
    const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
    const timestamp = priceData.price.publish_time;

    return { price, timestamp };
  } catch (error) {
    console.error("Failed to fetch latest price:", error);
    return null;
  }
}

/**
 * Calculate option value curve for charting
 * Shows how option value changes with underlying price
 */
export interface OptionValuePoint {
  underlyingPrice: number;
  optionValue: number;
  intrinsicValue: number;
  timeValue: number;
}

export function calculateOptionValueCurve(
  optionType: "CALL" | "PUT",
  strikePrice: number,
  currentPrice: number,
  daysToExpiry: number,
  impliedVol: number,
  priceRange: { min: number; max: number },
  points: number = 100
): OptionValuePoint[] {
  const curve: OptionValuePoint[] = [];
  const step = (priceRange.max - priceRange.min) / points;

  for (let i = 0; i <= points; i++) {
    const underlyingPrice = priceRange.min + step * i;

    // Calculate intrinsic value
    const intrinsic =
      optionType === "CALL"
        ? Math.max(0, underlyingPrice - strikePrice)
        : Math.max(0, strikePrice - underlyingPrice);

    // Simplified Black-Scholes approximation for time value
    // In production, use full Black-Scholes from your contract
    const timeDecayFactor = Math.sqrt(daysToExpiry / 365);
    const volatilityComponent = impliedVol * underlyingPrice * timeDecayFactor;
    const timeValue = volatilityComponent * 0.4; // Simplified

    const optionValue = intrinsic + timeValue;

    curve.push({
      underlyingPrice,
      optionValue,
      intrinsicValue: intrinsic,
      timeValue,
    });
  }

  return curve;
}

/**
 * Calculate P&L curve for an option position
 */
export interface PnLPoint {
  underlyingPrice: number;
  pnl: number;
  breakeven: boolean;
}

export function calculatePnLCurve(
  optionType: "CALL" | "PUT",
  strikePrice: number,
  premium: number,
  positionType: "long" | "short",
  priceRange: { min: number; max: number },
  points: number = 100
): PnLPoint[] {
  const curve: PnLPoint[] = [];
  const step = (priceRange.max - priceRange.min) / points;

  for (let i = 0; i <= points; i++) {
    const underlyingPrice = priceRange.min + step * i;

    // Calculate intrinsic value at expiry
    const intrinsic =
      optionType === "CALL"
        ? Math.max(0, underlyingPrice - strikePrice)
        : Math.max(0, strikePrice - underlyingPrice);

    // Calculate P&L
    let pnl: number;
    if (positionType === "long") {
      // Buyer: paid premium, receives intrinsic value
      pnl = intrinsic - premium;
    } else {
      // Writer: received premium, pays intrinsic value
      pnl = premium - intrinsic;
    }

    const breakeven = Math.abs(pnl) < 0.01; // Within 1 cent of breakeven

    curve.push({
      underlyingPrice,
      pnl,
      breakeven,
    });
  }

  return curve;
}

/**
 * Get breakeven price for an option
 */
export function calculateBreakeven(
  optionType: "CALL" | "PUT",
  strikePrice: number,
  premium: number,
  positionType: "long" | "short"
): number {
  if (positionType === "long") {
    // For buyers
    return optionType === "CALL"
      ? strikePrice + premium
      : strikePrice - premium;
  } else {
    // For writers (same calculation, different meaning)
    return optionType === "CALL"
      ? strikePrice + premium
      : strikePrice - premium;
  }
}
