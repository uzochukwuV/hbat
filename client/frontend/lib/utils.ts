/**
 * Utility Functions
 * Helper functions for formatting, parsing, and validation
 */

import { ethers } from "ethers";

// ── Address Formatting ───────────────────────────────────────────────────────

/**
 * Shorten an address for display
 * @example "0x1234...5678"
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.substring(0, chars + 2)}...${address.substring(
    address.length - chars
  )}`;
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

// ── Number Formatting ────────────────────────────────────────────────────────

/**
 * Format wei to HBAR/tokens
 */
export function formatUnits(value: string | bigint, decimals = 18): string {
  return ethers.formatUnits(value, decimals);
}

/**
 * Parse HBAR/tokens to wei
 */
export function parseUnits(value: string, decimals = 18): bigint {
  return ethers.parseUnits(value, decimals);
}

/**
 * Format number with commas
 * @example 1234567 -> "1,234,567"
 */
export function formatNumber(num: number | string): string {
  const n = typeof num === "string" ? parseFloat(num) : num;
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
}

/**
 * Format USD price
 * @example 1234.56 -> "$1,234.56"
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage
 * @example 0.1234 -> "12.34%"
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ── Date/Time Formatting ─────────────────────────────────────────────────────

/**
 * Format timestamp to human-readable date
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format timestamp to human-readable date and time
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get time remaining until expiry
 * @returns Human-readable string like "2 days 5 hours"
 */
export function getTimeRemaining(expiryTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiryTimestamp - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// ── Transaction Helpers ──────────────────────────────────────────────────────

/**
 * Build transaction data for contract call
 */
export function encodeContractCall(
  contractInterface: ethers.Interface,
  functionName: string,
  args: any[]
): string {
  return contractInterface.encodeFunctionData(functionName, args);
}

/**
 * Decode transaction data
 */
export function decodeContractCall(
  contractInterface: ethers.Interface,
  data: string
): { name: string; args: any[] } {
  const fragment = contractInterface.parseTransaction({ data });
  if (!fragment) {
    throw new Error("Failed to decode transaction data");
  }
  return {
    name: fragment.name,
    args: Array.from(fragment.args),
  };
}

// ── Option Helpers ───────────────────────────────────────────────────────────

/**
 * Calculate intrinsic value of an option
 */
export function calculateIntrinsicValue(
  optionType: "CALL" | "PUT",
  spotPrice: number,
  strikePrice: number,
  size: number
): number {
  if (optionType === "CALL") {
    return Math.max(0, (spotPrice - strikePrice) * size);
  } else {
    return Math.max(0, (strikePrice - spotPrice) * size);
  }
}

/**
 * Check if option is in the money
 */
export function isInTheMoney(
  optionType: "CALL" | "PUT",
  spotPrice: number,
  strikePrice: number
): boolean {
  if (optionType === "CALL") {
    return spotPrice > strikePrice;
  } else {
    return spotPrice < strikePrice;
  }
}

/**
 * Get moneyness label
 */
export function getMoneyness(
  optionType: "CALL" | "PUT",
  spotPrice: number,
  strikePrice: number
): "ITM" | "ATM" | "OTM" {
  const threshold = 0.02; // 2% threshold for ATM

  if (Math.abs(spotPrice - strikePrice) / strikePrice < threshold) {
    return "ATM";
  }

  return isInTheMoney(optionType, spotPrice, strikePrice) ? "ITM" : "OTM";
}

// ── Error Handling ───────────────────────────────────────────────────────────

/**
 * Parse contract error message
 */
export function parseContractError(error: any): string {
  if (error?.reason) {
    return error.reason;
  }

  if (error?.data?.message) {
    return error.data.message;
  }

  if (error?.message) {
    // Extract revert reason from error message
    const match = error.message.match(/reverted with reason string '(.+)'/);
    if (match) {
      return match[1];
    }

    // Clean up common error messages
    if (error.message.includes("user rejected")) {
      return "Transaction rejected by user";
    }

    return error.message;
  }

  return "An unknown error occurred";
}

// ── Session Management ───────────────────────────────────────────────────────

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Store session ID in localStorage
 */
export function saveSessionId(sessionId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("agent_session_id", sessionId);
  }
}

/**
 * Retrieve session ID from localStorage
 */
export function getSessionId(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("agent_session_id");
  }
  return null;
}

/**
 * Clear session ID from localStorage
 */
export function clearSessionId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("agent_session_id");
  }
}
