"use client";

/**
 * usePythUpdates Hook
 * Manages Pyth price update VAAs for on-chain transactions
 */

import { useState, useCallback, useEffect } from "react";
import {
  fetchPriceUpdateVAA,
  fetchSinglePriceUpdate,
  isPriceFresh,
  PythPriceSubscription,
  type PriceUpdateData,
} from "@/lib/pyth-updates";
import type { AssetSymbol } from "@/lib/config";

export function usePythUpdates(symbols: AssetSymbol[]) {
  const [updates, setUpdates] = useState<Map<AssetSymbol, PriceUpdateData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PythPriceSubscription | null>(null);

  /**
   * Fetch latest price update VAAs
   */
  const fetchUpdates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const updateData = await fetchPriceUpdateVAA(symbols);

      const newUpdates = new Map<AssetSymbol, PriceUpdateData>();
      symbols.forEach((symbol, index) => {
        if (updateData[index]) {
          newUpdates.set(symbol, updateData[index]);
        }
      });

      setUpdates(newUpdates);
    } catch (err: any) {
      setError(err.message || "Failed to fetch price updates");
    } finally {
      setIsLoading(false);
    }
  }, [symbols]);

  /**
   * Get update for a specific symbol
   */
  const getUpdate = useCallback(
    (symbol: AssetSymbol): PriceUpdateData | null => {
      return updates.get(symbol) || null;
    },
    [updates]
  );

  /**
   * Get fresh update for contract call
   * Ensures price is not stale before submitting transaction
   */
  const getFreshUpdate = useCallback(
    async (symbol: AssetSymbol, maxAgeSeconds: number = 30): Promise<PriceUpdateData> => {
      const existingUpdate = updates.get(symbol);

      // Check if existing update is fresh enough
      if (existingUpdate && isPriceFresh(existingUpdate.price.publishTime, maxAgeSeconds)) {
        return existingUpdate;
      }

      // Fetch new update
      const freshUpdate = await fetchSinglePriceUpdate(symbol);

      // Update cache
      setUpdates((prev) => new Map(prev).set(symbol, freshUpdate));

      return freshUpdate;
    },
    [updates]
  );

  /**
   * Subscribe to real-time price updates via WebSocket
   */
  const subscribeToUpdates = useCallback(() => {
    if (subscription) {
      subscription.disconnect();
    }

    const newSubscription = new PythPriceSubscription(symbols, (updateData) => {
      const newUpdates = new Map<AssetSymbol, PriceUpdateData>();
      symbols.forEach((symbol, index) => {
        if (updateData[index]) {
          newUpdates.set(symbol, updateData[index]);
        }
      });
      setUpdates(newUpdates);
    });

    newSubscription.connect();
    setSubscription(newSubscription);
  }, [symbols, subscription]);

  /**
   * Unsubscribe from updates
   */
  const unsubscribe = useCallback(() => {
    if (subscription) {
      subscription.disconnect();
      setSubscription(null);
    }
  }, [subscription]);

  /**
   * Check if all updates are fresh
   */
  const areUpdatesFresh = useCallback(
    (maxAgeSeconds: number = 60): boolean => {
      if (updates.size === 0) return false;

      for (const [, update] of updates) {
        if (!isPriceFresh(update.price.publishTime, maxAgeSeconds)) {
          return false;
        }
      }

      return true;
    },
    [updates]
  );

  /**
   * Fetch initial updates on mount
   */
  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  /**
   * Cleanup subscription on unmount
   */
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    updates,
    isLoading,
    error,
    fetchUpdates,
    getUpdate,
    getFreshUpdate,
    subscribeToUpdates,
    unsubscribe,
    areUpdatesFresh,
  };
}
