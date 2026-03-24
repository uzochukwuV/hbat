"use client";

/**
 * useChart Hook
 * Manages price chart data and updates using Pyth feeds
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchPythHistoricalData,
  fetchLatestPrice,
  type PricePoint,
  type TimeResolution,
} from "@/lib/pyth-charts";
import type { AssetSymbol } from "@/lib/config";

export function useChart(symbol: AssetSymbol, resolution: TimeResolution = "15") {
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch historical chart data
   */
  const fetchChartData = useCallback(
    async (timeRange: { from: number; to: number }) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchPythHistoricalData(
          symbol,
          resolution,
          timeRange.from,
          timeRange.to
        );

        setPriceData(data);

        // Set latest price from most recent data point
        if (data.length > 0) {
          setLatestPrice(data[data.length - 1].close);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch chart data");
      } finally {
        setIsLoading(false);
      }
    },
    [symbol, resolution]
  );

  /**
   * Update latest price (for real-time updates)
   */
  const updateLatestPrice = useCallback(async () => {
    try {
      const priceUpdate = await fetchLatestPrice(symbol);

      if (priceUpdate) {
        setLatestPrice(priceUpdate.price);

        // Append to chart data if we have existing data
        setPriceData((prev) => {
          if (prev.length === 0) return prev;

          const lastPoint = prev[prev.length - 1];

          // Update last candle if within same time period
          const newPoint: PricePoint = {
            time: priceUpdate.timestamp,
            open: lastPoint.close,
            high: Math.max(lastPoint.high, priceUpdate.price),
            low: Math.min(lastPoint.low, priceUpdate.price),
            close: priceUpdate.price,
          };

          // Check if we should update last candle or append new one
          const resolutionSeconds = getResolutionSeconds(resolution);
          if (priceUpdate.timestamp - lastPoint.time < resolutionSeconds) {
            // Update last candle
            return [...prev.slice(0, -1), newPoint];
          } else {
            // Append new candle
            return [...prev, newPoint];
          }
        });
      }
    } catch (err) {
      console.error("Failed to update latest price:", err);
    }
  }, [symbol, resolution]);

  /**
   * Start real-time price updates
   */
  const startRealTimeUpdates = useCallback(
    (intervalMs: number = 5000) => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      // Update immediately
      updateLatestPrice();

      // Then update at interval
      updateIntervalRef.current = setInterval(updateLatestPrice, intervalMs);
    },
    [updateLatestPrice]
  );

  /**
   * Stop real-time updates
   */
  const stopRealTimeUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  /**
   * Load initial chart data
   */
  useEffect(() => {
    // Default to last 24 hours
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 24 * 60 * 60;

    fetchChartData({ from: oneDayAgo, to: now });
  }, [fetchChartData]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopRealTimeUpdates();
    };
  }, [stopRealTimeUpdates]);

  return {
    priceData,
    latestPrice,
    isLoading,
    error,
    fetchChartData,
    updateLatestPrice,
    startRealTimeUpdates,
    stopRealTimeUpdates,
  };
}

/**
 * Convert resolution to seconds
 */
function getResolutionSeconds(resolution: TimeResolution): number {
  switch (resolution) {
    case "1":
      return 60;
    case "5":
      return 5 * 60;
    case "15":
      return 15 * 60;
    case "60":
      return 60 * 60;
    case "240":
      return 4 * 60 * 60;
    case "1D":
      return 24 * 60 * 60;
    default:
      return 15 * 60;
  }
}
