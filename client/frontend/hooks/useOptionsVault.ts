"use client";

/**
 * useOptionsVault Hook
 * Contract read operations for OptionsVault
 */

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { config } from "@/lib/config";
import {
  OPTIONS_VAULT_ABI,
  type Position,
  type QuoteParams,
  type QuoteResult,
  type WriteParams,
  OptionType,
} from "@/lib/contracts";

export function useOptionsVault() {
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contract state
  const [supportedSymbols, setSupportedSymbols] = useState<string[]>([]);
  const [collateralTokens, setCollateralTokens] = useState<string[]>([]);
  const [riskFreeRate, setRiskFreeRate] = useState<string>("0");

  /**
   * Initialize provider and contract
   */
  useEffect(() => {
    const init = async () => {
      try {
        const rpcProvider = new ethers.JsonRpcProvider(config.rpcUrl);
        setProvider(rpcProvider);

        if (config.optionsVault) {
          const optionsContract = new ethers.Contract(
            config.optionsVault,
            OPTIONS_VAULT_ABI,
            rpcProvider
          );
          setContract(optionsContract);
        } else {
          console.warn("OptionsVault address not configured");
        }
      } catch (err) {
        console.error("Failed to initialize contract:", err);
        setError("Failed to connect to Hedera network");
      }
    };

    init();
  }, []);

  /**
   * Fetch supported symbols
   */
  const fetchSupportedSymbols = useCallback(async (): Promise<string[]> => {
    if (!contract) return [];

    try {
      const symbols = await contract.getSupportedSymbols();
      setSupportedSymbols(symbols);
      return symbols;
    } catch (err) {
      console.error("Failed to fetch supported symbols:", err);
      return [];
    }
  }, [contract]);

  /**
   * Fetch collateral tokens
   */
  const fetchCollateralTokens = useCallback(async (): Promise<string[]> => {
    if (!contract) return [];

    try {
      const tokens = await contract.getCollateralTokens();
      setCollateralTokens(tokens);
      return tokens;
    } catch (err) {
      console.error("Failed to fetch collateral tokens:", err);
      return [];
    }
  }, [contract]);

  /**
   * Get position by token ID
   */
  const getPosition = useCallback(
    async (tokenId: number): Promise<Position | null> => {
      if (!contract) {
        setError("Contract not initialized");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await contract.getPosition(tokenId);

        const position: Position = {
          tokenId: result.tokenId,
          feedId: result.feedId,
          symbol: result.symbol,
          optionType: result.optionType as OptionType,
          strikeWad: result.strikeWad,
          expiry: result.expiry,
          sizeWad: result.sizeWad,
          premiumWad: result.premiumWad,
          writer: result.writer,
          buyer: result.buyer,
          collateralToken: result.collateralToken,
          collateralWad: result.collateralWad,
          scheduleId: result.scheduleId,
          settled: result.settled,
        };

        return position;
      } catch (err: any) {
        console.error("Failed to get position:", err);
        setError(err.message || "Failed to fetch position");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contract]
  );

  /**
   * Get available collateral for a writer
   */
  const getAvailableCollateral = useCallback(
    async (writer: string, token: string = ethers.ZeroAddress): Promise<string> => {
      if (!contract) return "0";

      try {
        const collateral = await contract.availableCollateral(writer, token);
        return ethers.formatEther(collateral);
      } catch (err) {
        console.error("Failed to get collateral:", err);
        return "0";
      }
    },
    [contract]
  );

  /**
   * Quote option premium
   */
  const quotePremium = useCallback(
    async (params: QuoteParams): Promise<QuoteResult | null> => {
      if (!contract) {
        setError("Contract not initialized");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await contract.quotePremium({
          symbol: params.symbol,
          optionType: params.optionType,
          strikeWad: params.strikeWad,
          expiry: params.expiry,
          sizeWad: params.sizeWad,
          sigmaWad: params.sigmaWad,
        });

        return {
          premiumWad: result.premiumWad,
          greeks: {
            premium: result.greeks.premium,
            delta: result.greeks.delta,
            gamma: result.greeks.gamma,
            vega: result.greeks.vega,
            theta: result.greeks.theta,
            rho: result.greeks.rho,
          },
        };
      } catch (err: any) {
        console.error("Failed to quote premium:", err);
        setError(err.message || "Failed to get quote");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contract]
  );

  /**
   * Get intrinsic value of an option
   */
  const getIntrinsicValue = useCallback(
    async (tokenId: number, spotWad: bigint): Promise<string> => {
      if (!contract) return "0";

      try {
        const value = await contract.intrinsicValue(tokenId, spotWad);
        return ethers.formatEther(value);
      } catch (err) {
        console.error("Failed to get intrinsic value:", err);
        return "0";
      }
    },
    [contract]
  );

  /**
   * Get feed ID for a symbol
   */
  const getFeedId = useCallback(
    async (symbol: string): Promise<string | null> => {
      if (!contract) return null;

      try {
        const feedId = await contract.feedIds(symbol);
        return feedId;
      } catch (err) {
        console.error("Failed to get feed ID:", err);
        return null;
      }
    },
    [contract]
  );

  /**
   * Get risk-free rate
   */
  const fetchRiskFreeRate = useCallback(async (): Promise<string> => {
    if (!contract) return "0";

    try {
      const rate = await contract.riskFreeRateWad();
      const formattedRate = ethers.formatEther(rate);
      setRiskFreeRate(formattedRate);
      return formattedRate;
    } catch (err) {
      console.error("Failed to get risk-free rate:", err);
      return "0";
    }
  }, [contract]);

  /**
   * Load initial contract data
   */
  useEffect(() => {
    if (contract) {
      fetchSupportedSymbols();
      fetchCollateralTokens();
      fetchRiskFreeRate();
    }
  }, [contract, fetchSupportedSymbols, fetchCollateralTokens, fetchRiskFreeRate]);

  // Fetch user positions (by querying events or indexer - simplified here)
  const fetchUserPositions = useCallback(
    async (userAddress: string): Promise<Position[]> => {
      if (!contract || !userAddress) return [];
      
      try {
        // Get user's collateral tokens
        const tokens = await contract.getCollateralTokens();
        const positions: Position[] = [];
        
        // For now, return empty - would need event parsing or indexer for full implementation
        return positions;
      } catch (err) {
        console.error("Failed to fetch user positions:", err);
        return [];
      }
    },
    [contract]
  );

  return {
    // State
    provider,
    contract,
    supportedSymbols,
    collateralTokens,
    riskFreeRate,
    isLoading,
    error,

    // Read functions
    getPosition,
    getAvailableCollateral,
    quotePremium,
    getIntrinsicValue,
    getFeedId,
    fetchUserPositions,

    // Refresh functions
    fetchSupportedSymbols,
    fetchCollateralTokens,
    fetchRiskFreeRate,
  };
}
