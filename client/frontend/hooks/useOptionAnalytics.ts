"use client";

/**
 * useOptionAnalytics Hook
 * Calculate option value curves, P&L, and Greeks for visualization
 */

import { useState, useCallback, useEffect } from "react";
import {
  calculateOptionValueCurve,
  calculatePnLCurve,
  calculateBreakeven,
  type OptionValuePoint,
  type PnLPoint,
} from "@/lib/pyth-charts";
import type { OptionType } from "@/types";

export interface OptionAnalytics {
  valueCurve: OptionValuePoint[];
  pnlCurve: PnLPoint[];
  breakeven: number;
  currentValue: number;
  maxProfit: number;
  maxLoss: number;
}

export function useOptionAnalytics(
  optionType: OptionType,
  strikePrice: number,
  currentPrice: number,
  premium: number,
  daysToExpiry: number,
  positionType: "long" | "short",
  impliedVol: number = 0.8 // Default 80% IV
) {
  const [analytics, setAnalytics] = useState<OptionAnalytics | null>(null);

  /**
   * Calculate all analytics
   */
  const calculateAnalytics = useCallback(() => {
    // Define price range for curves (±50% of current price)
    const priceRange = {
      min: currentPrice * 0.5,
      max: currentPrice * 1.5,
    };

    // Calculate option value curve
    const valueCurve = calculateOptionValueCurve(
      optionType,
      strikePrice,
      currentPrice,
      daysToExpiry,
      impliedVol,
      priceRange,
      100
    );

    // Calculate P&L curve
    const pnlCurve = calculatePnLCurve(
      optionType,
      strikePrice,
      premium,
      positionType,
      priceRange,
      100
    );

    // Calculate breakeven
    const breakeven = calculateBreakeven(
      optionType,
      strikePrice,
      premium,
      positionType
    );

    // Find current option value from curve
    const currentValuePoint = valueCurve.find(
      (point) =>
        point.underlyingPrice >= currentPrice - 0.01 &&
        point.underlyingPrice <= currentPrice + 0.01
    );
    const currentValue = currentValuePoint?.optionValue || premium;

    // Calculate max profit/loss
    let maxProfit: number;
    let maxLoss: number;

    if (positionType === "long") {
      // Long options
      if (optionType === "CALL") {
        maxProfit = Infinity; // Unlimited upside
        maxLoss = premium; // Limited to premium paid
      } else {
        // PUT
        maxProfit = strikePrice - premium; // Strike minus premium
        maxLoss = premium; // Limited to premium paid
      }
    } else {
      // Short options
      if (optionType === "CALL") {
        maxProfit = premium; // Limited to premium received
        maxLoss = Infinity; // Unlimited downside
      } else {
        // PUT
        maxProfit = premium; // Limited to premium received
        maxLoss = strikePrice - premium; // Strike minus premium
      }
    }

    setAnalytics({
      valueCurve,
      pnlCurve,
      breakeven,
      currentValue,
      maxProfit,
      maxLoss,
    });
  }, [
    optionType,
    strikePrice,
    currentPrice,
    premium,
    daysToExpiry,
    positionType,
    impliedVol,
  ]);

  /**
   * Recalculate when inputs change
   */
  useEffect(() => {
    calculateAnalytics();
  }, [calculateAnalytics]);

  return {
    analytics,
    recalculate: calculateAnalytics,
  };
}



