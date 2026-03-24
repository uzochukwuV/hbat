"use client";

/**
 * usePortfolio Hook
 * Fetches user's options portfolio from Mirror Node and contract
 */

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { config } from "@/lib/config";
import { OPTION_TOKEN_ABI, OPTIONS_VAULT_ABI, type Position, OptionType } from "@/lib/contracts";

export interface PortfolioOption {
  tokenId: number;
  symbol: string;
  optionType: "CALL" | "PUT";
  strikeWad: string;
  expiry: number;
  sizeWad: string;
  premiumWad: string;
  writer: string;
  buyer: string;
  collateralWad: string;
  settled: boolean;
  isWriter: boolean; // true if user is the writer
  isBuyer: boolean; // true if user is the buyer
  status: "active" | "expired" | "exercised";
}

export interface PortfolioSummary {
  totalWritten: number;
  totalBought: number;
  activePositions: number;
  totalCollateralLocked: string;
  totalPremiumsReceived: string;
  totalPremiumsPaid: string;
}

export function usePortfolio(userAddress: string | null) {
  const [options, setOptions] = useState<PortfolioOption[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [collateralBalance, setCollateralBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user's collateral balance
   */
  const fetchCollateralBalance = useCallback(async () => {
    if (!userAddress || !config.optionsVault) return;

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(
        config.optionsVault,
        OPTIONS_VAULT_ABI,
        provider
      );

      // Fetch HBAR collateral (address(0))
      const hbarCollateral = await contract.availableCollateral(
        userAddress,
        ethers.ZeroAddress
      );

      setCollateralBalance(ethers.formatEther(hbarCollateral));
    } catch (err) {
      console.error("Failed to fetch collateral balance:", err);
    }
  }, [userAddress]);

  /**
   * Fetch user's options from Mirror Node events
   */
  const fetchPortfolio = useCallback(async () => {
    if (!userAddress || !config.optionsVault) {
      setOptions([]);
      setSummary(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(
        config.optionsVault,
        OPTIONS_VAULT_ABI,
        provider
      );

      // Query OptionWritten events where user is writer or buyer
      const writerFilter = contract.filters.OptionWritten(null, userAddress);
      const buyerFilter = contract.filters.OptionWritten(null, null, userAddress);

      // Get events from last 10000 blocks (adjust as needed)
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000);

      const [writerEvents, buyerEvents] = await Promise.all([
        contract.queryFilter(writerFilter, fromBlock),
        contract.queryFilter(buyerFilter, fromBlock),
      ]);

      // Combine and dedupe events
      const allEvents = [...writerEvents, ...buyerEvents];
      const tokenIds = [...new Set(allEvents.map((e) => Number(e.args?.tokenId)))];

      // Fetch position details for each token
      const positionPromises = tokenIds.map(async (tokenId) => {
        try {
          const position = await contract.getPosition(tokenId);
          return {
            tokenId,
            position,
          };
        } catch {
          return null;
        }
      });

      const positionResults = await Promise.all(positionPromises);
      const validPositions = positionResults.filter((p) => p !== null);

      // Transform to PortfolioOption
      const portfolioOptions: PortfolioOption[] = validPositions.map(({ tokenId, position }) => {
        const isWriter = position.writer.toLowerCase() === userAddress.toLowerCase();
        const isBuyer = position.buyer.toLowerCase() === userAddress.toLowerCase();
        const now = Math.floor(Date.now() / 1000);
        const isExpired = Number(position.expiry) < now;

        let status: "active" | "expired" | "exercised" = "active";
        if (position.settled) {
          status = isExpired ? "expired" : "exercised";
        } else if (isExpired) {
          status = "expired";
        }

        return {
          tokenId,
          symbol: position.symbol,
          optionType: position.optionType === OptionType.Call ? "CALL" : "PUT",
          strikeWad: ethers.formatEther(position.strikeWad),
          expiry: Number(position.expiry),
          sizeWad: ethers.formatEther(position.sizeWad),
          premiumWad: ethers.formatEther(position.premiumWad),
          writer: position.writer,
          buyer: position.buyer,
          collateralWad: ethers.formatEther(position.collateralWad),
          settled: position.settled,
          isWriter,
          isBuyer,
          status,
        };
      });

      setOptions(portfolioOptions);

      // Calculate summary
      const written = portfolioOptions.filter((o) => o.isWriter);
      const bought = portfolioOptions.filter((o) => o.isBuyer);
      const active = portfolioOptions.filter((o) => o.status === "active");

      const totalCollateralLocked = written
        .filter((o) => o.status === "active")
        .reduce((sum, o) => sum + parseFloat(o.collateralWad), 0);

      const totalPremiumsReceived = written.reduce(
        (sum, o) => sum + parseFloat(o.premiumWad),
        0
      );

      const totalPremiumsPaid = bought.reduce(
        (sum, o) => sum + parseFloat(o.premiumWad),
        0
      );

      setSummary({
        totalWritten: written.length,
        totalBought: bought.length,
        activePositions: active.length,
        totalCollateralLocked: totalCollateralLocked.toFixed(4),
        totalPremiumsReceived: totalPremiumsReceived.toFixed(4),
        totalPremiumsPaid: totalPremiumsPaid.toFixed(4),
      });

      // Also fetch collateral balance
      await fetchCollateralBalance();
    } catch (err: any) {
      console.error("Failed to fetch portfolio:", err);
      setError(err.message || "Failed to load portfolio");
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, fetchCollateralBalance]);

  /**
   * Fetch on address change
   */
  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  return {
    options,
    summary,
    collateralBalance,
    isLoading,
    error,
    refresh: fetchPortfolio,
    refreshCollateral: fetchCollateralBalance,
  };
}
