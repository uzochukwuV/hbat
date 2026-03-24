"use client";

/**
 * useVaultActions Hook
 * Write operations for OptionsVault - deposit collateral, write options, etc.
 */

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { config } from "@/lib/config";
import {
  OPTIONS_VAULT_ABI,
  encodeDepositHBAR,
  encodeDepositERC20,
  encodeWriteOption,
  encodeWithdrawCollateral,
  type WriteParams,
  OptionType,
} from "@/lib/contracts";
import type { UnsignedTransaction } from "@/types";

interface VaultActionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export function useVaultActions() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Build deposit HBAR transaction data
   * Returns unsigned transaction data for wallet signing
   */
  const buildDepositHBARTx = useCallback((amount: string): UnsignedTransaction => {
    const amountWei = ethers.parseEther(amount); // Convert to wei
    const vaultAddress = config.optionsVault;
    
    // For payable functions, the value is sent with the transaction
    // The function data is empty since depositHBAR has no parameters
    return {
      to: vaultAddress,
      value: amountWei.toString(),
      data: "0x", // depositHBAR() - no parameters
      gasLimit: 100000, // Estimate
    };
  }, []);

  /**
   * Build deposit ERC20 transaction data
   */
  const buildDepositERC20Tx = useCallback((tokenAddress: string, amount: string, decimals: number = 18): UnsignedTransaction => {
    const amountWei = ethers.parseUnits(amount, decimals);
    const vaultAddress = config.optionsVault;
    
    const data = encodeDepositERC20(tokenAddress, amountWei);
    
    return {
      to: vaultAddress,
      value: "0",
      data,
      gasLimit: 150000,
    };
  }, []);

  /**
   * Build withdraw collateral transaction
   */
  const buildWithdrawTx = useCallback((tokenAddress: string, amount: string, decimals: number = 18): UnsignedTransaction => {
    const amountWei = ethers.parseUnits(amount, decimals);
    const vaultAddress = config.optionsVault;
    
    const data = encodeWithdrawCollateral(tokenAddress, amountWei);
    
    return {
      to: vaultAddress,
      value: "0",
      data,
      gasLimit: 100000,
    };
  }, []);

  /**
   * Build write option transaction
   * Note: This requires Pyth price update data which needs to be fetched separately
   */
  const buildWriteOptionTx = useCallback((params: {
    symbol: string;
    optionType: OptionType;
    strikePrice: string; // In USD, e.g., "0.12"
    expiryTimestamp: number; // Unix timestamp
    size: string; // Amount of underlying
    volatility: string; // IV as decimal, e.g., "0.5" for 50%
    collateralToken: string; // address(0) for HBAR, token address for ERC20
    maxPremium: string; // Max premium in USD
  }): UnsignedTransaction => {
    const vaultAddress = config.optionsVault;
    
    // Convert parameters to WAD format
    const strikeWad = ethers.parseEther(params.strikePrice);
    const sizeWad = ethers.parseEther(params.size);
    const sigmaWad = ethers.parseEther(params.volatility);
    const maxPremiumWad = ethers.parseEther(params.maxPremium);
    
    // Create write params (pythUpdateData would need to be fetched from Pyth)
    const writeParams: WriteParams = {
      symbol: params.symbol,
      optionType: params.optionType,
      strikeWad,
      expiry: BigInt(params.expiryTimestamp),
      sizeWad,
      sigmaWad,
      collateralToken: params.collateralToken,
      pythUpdateData: [], // Would need to fetch from Pyth
    };
    
    const data = encodeWriteOption(writeParams, maxPremiumWad);
    
    return {
      to: vaultAddress,
      value: "0", // Premium is paid by buyer, writer receives it
      data,
      gasLimit: 500000, // Write option is complex
    };
  }, []);

  /**
   * Simulate quote preview without executing
   */
  const previewQuote = useCallback(async (params: {
    symbol: string;
    optionType: OptionType;
    strikePrice: number;
    expiryDays: number;
    size: number;
    volatility: number;
  }): Promise<{ premium: string; collateral: string; greeks: any } | null> => {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(config.optionsVault, OPTIONS_VAULT_ABI, provider);
      
      const strikeWad = ethers.parseEther(params.strikePrice.toString());
      const sizeWad = ethers.parseEther(params.size.toString());
      const sigmaWad = ethers.parseEther(params.volatility.toString());
      
      // Calculate expiry timestamp
      const expiry = Math.floor(Date.now() / 1000) + (params.expiryDays * 24 * 60 * 60);
      
      const result = await contract.quotePremium({
        symbol: params.symbol,
        optionType: params.optionType,
        strikeWad,
        expiry: BigInt(expiry),
        sizeWad,
        sigmaWad,
      });
      
      return {
        premium: ethers.formatEther(result.premiumWad),
        collateral: "0", // Would need _requiredCollateral calculation
        greeks: result.greeks,
      };
    } catch (err) {
      console.error("Failed to preview quote:", err);
      return null;
    }
  }, []);

  /**
   * Get estimated collateral required for a position
   */
  const estimateCollateral = useCallback(async (params: {
    optionType: OptionType;
    strikePrice: number;
    size: number;
    currentPrice: number;
    collateralToken: string;
  }): Promise<string> => {
    // Simplified collateral estimation
    // Call: size * strike (or size * current for covered call)
    // Put: size * strike
    
    let required: number;
    
    if (params.optionType === OptionType.Call) {
      // For covered call: need the underlying (size) or equivalent in USDC
      required = params.size * params.currentPrice; 
    } else {
      // For cash-secured put: need strike * size
      required = params.size * params.strikePrice;
    }
    
    return required.toFixed(2);
  }, []);

  return {
    isProcessing,
    error,
    
    // Transaction builders (return data for wallet signing)
    buildDepositHBARTx,
    buildDepositERC20Tx,
    buildWithdrawTx,
    buildWriteOptionTx,
    
    // Utility functions
    previewQuote,
    estimateCollateral,
    
    // Error handling
    setError,
  };
}