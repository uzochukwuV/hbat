/**
 * Pyth Price Update VAAs
 * Fetch verifiable price updates for on-chain contract calls
 */

import { config } from "./config";
import type { AssetSymbol } from "./config";

export interface PriceUpdateData {
  vaa: string; // Hex-encoded VAA (Verifiable Action Approval)
  updateFee: bigint; // Fee in wei to update price on-chain
  price: {
    price: number;
    expo: number;
    publishTime: number;
  };
}

/**
 * Fetch latest price update VAA from Pyth Hermes
 * This VAA is submitted to the smart contract to verify prices on-chain
 *
 * @param symbols Asset symbols to fetch updates for
 * @returns Price update data including VAA bytes
 */
export async function fetchPriceUpdateVAA(
  symbols: AssetSymbol[]
): Promise<PriceUpdateData[]> {
  // Get price feed IDs for requested symbols
  const priceIds = symbols.map((symbol) => config.priceFeeds[symbol]);

  // Build Hermes API URL
  const idsParam = priceIds.map((id) => `ids[]=${id}`).join("&");
  const url = `${config.pythHermesUrl}/v2/updates/price/latest?${idsParam}&encoding=hex`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Pyth Hermes API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.binary || !data.parsed) {
      throw new Error("Invalid response from Pyth Hermes");
    }

    // Extract VAA and price data
    const updates: PriceUpdateData[] = [];

    for (let i = 0; i < data.parsed.length; i++) {
      const priceData = data.parsed[i];

      updates.push({
        vaa: data.binary.data[0], // Hex-encoded VAA
        updateFee: BigInt(0), // Hedera doesn't charge update fees on testnet
        price: {
          price: Number(priceData.price.price) * Math.pow(10, priceData.price.expo),
          expo: priceData.price.expo,
          publishTime: priceData.price.publish_time,
        },
      });
    }

    return updates;
  } catch (error) {
    console.error("Failed to fetch Pyth price update VAA:", error);
    throw error;
  }
}

/**
 * Fetch price update for a single asset
 */
export async function fetchSinglePriceUpdate(
  symbol: AssetSymbol
): Promise<PriceUpdateData> {
  const updates = await fetchPriceUpdateVAA([symbol]);

  if (updates.length === 0) {
    throw new Error(`No price update available for ${symbol}`);
  }

  return updates[0];
}

/**
 * Encode price update for contract call
 * Converts hex VAA to bytes for Solidity contract
 */
export function encodePriceUpdate(vaa: string): string {
  // Remove '0x' prefix if present
  const cleanVaa = vaa.startsWith("0x") ? vaa.slice(2) : vaa;

  // Return as 0x-prefixed hex
  return `0x${cleanVaa}`;
}

/**
 * Calculate total update fee for multiple price feeds
 * On Hedera testnet, this is typically 0
 * On mainnet, check with Pyth Network for current fees
 */
export function calculateUpdateFee(updateCount: number): bigint {
  // Hedera testnet: free
  // Hedera mainnet: TBD (check Pyth docs)
  return BigInt(0);
}

/**
 * Verify price freshness
 * Pyth prices are considered fresh if published within last 60 seconds
 */
export function isPriceFresh(publishTime: number, maxAgeSeconds: number = 60): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = now - publishTime;
  return age <= maxAgeSeconds;
}

/**
 * Subscribe to price feed updates via WebSocket
 * Real-time streaming of price updates
 */
export class PythPriceSubscription {
  private ws: WebSocket | null = null;
  private priceIds: string[];
  private onUpdate: (updates: PriceUpdateData[]) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    symbols: AssetSymbol[],
    onUpdate: (updates: PriceUpdateData[]) => void
  ) {
    this.priceIds = symbols.map((symbol) => config.priceFeeds[symbol]);
    this.onUpdate = onUpdate;
  }

  connect() {
    try {
      // Pyth Hermes WebSocket endpoint
      const wsUrl = "wss://hermes.pyth.network/ws";
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("Pyth WebSocket connected");
        this.reconnectAttempts = 0;

        // Subscribe to price feeds
        this.ws?.send(
          JSON.stringify({
            type: "subscribe",
            ids: this.priceIds,
          })
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "price_update") {
            // Parse price updates
            const updates: PriceUpdateData[] = data.price_feeds.map((feed: any) => ({
              vaa: data.vaa || "",
              updateFee: BigInt(0),
              price: {
                price: Number(feed.price.price) * Math.pow(10, feed.price.expo),
                expo: feed.price.expo,
                publishTime: feed.price.publish_time,
              },
            }));

            this.onUpdate(updates);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Pyth WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("Pyth WebSocket disconnected");

        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 5000 * this.reconnectAttempts);
        }
      };
    } catch (error) {
      console.error("Failed to connect to Pyth WebSocket:", error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Get price with confidence interval
 * Pyth provides confidence intervals for price accuracy
 */
export interface PriceWithConfidence {
  price: number;
  confidence: number;
  publishTime: number;
}

export async function fetchPriceWithConfidence(
  symbol: AssetSymbol
): Promise<PriceWithConfidence> {
  const priceId = config.priceFeeds[symbol];
  const url = `${config.pythHermesUrl}/v2/updates/price/latest?ids[]=${priceId}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.parsed || data.parsed.length === 0) {
      throw new Error("No price data available");
    }

    const priceData = data.parsed[0];

    return {
      price: Number(priceData.price.price) * Math.pow(10, priceData.price.expo),
      confidence: Number(priceData.price.conf) * Math.pow(10, priceData.price.expo),
      publishTime: priceData.price.publish_time,
    };
  } catch (error) {
    console.error("Failed to fetch price with confidence:", error);
    throw error;
  }
}
