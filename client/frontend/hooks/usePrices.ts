"use client";

/**
 * usePrices Hook
 * Fetch and manage real-time price data from Pyth
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { agentClient } from "@/lib/agent";

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

export function usePrices() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch latest prices
   */
  const fetchPrices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const priceData = await agentClient.getPrices();

      const formattedPrices: Record<string, PriceData> = {};
      for (const [symbol, price] of Object.entries(priceData)) {
        formattedPrices[symbol] = {
          symbol,
          price,
          timestamp: Date.now(),
        };
      }

      setPrices(formattedPrices);
    } catch (err: any) {
      setError(err.message || "Failed to fetch prices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Start auto-refresh
   */
  const startAutoRefresh = useCallback(
    (intervalMs: number = 10000) => {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Fetch immediately
      fetchPrices();

      // Set up interval
      intervalRef.current = setInterval(fetchPrices, intervalMs);
    },
    [fetchPrices]
  );

  /**
   * Stop auto-refresh
   */
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Get price for a specific symbol
   */
  const getPrice = useCallback(
    (symbol: string): number | null => {
      return prices[symbol]?.price ?? null;
    },
    [prices]
  );

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopAutoRefresh();
    };
  }, [stopAutoRefresh]);

  return {
    prices,
    isLoading,
    error,
    fetchPrices,
    startAutoRefresh,
    stopAutoRefresh,
    getPrice,
  };
}
