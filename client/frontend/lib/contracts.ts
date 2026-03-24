/**
 * Contract ABIs and Configuration
 * Based on OptionsVault.sol
 */

import { config } from "./config";

// ── OptionsVault ABI (View Functions) ────────────────────────────────────────

export const OPTIONS_VAULT_ABI = [
  // View functions
  "function getPosition(uint256 tokenId) view returns (tuple(uint256 tokenId, bytes32 feedId, string symbol, uint8 optionType, uint256 strikeWad, uint256 expiry, uint256 sizeWad, uint256 premiumWad, address writer, address buyer, address collateralToken, uint256 collateralWad, address scheduleId, bool settled))",
  "function getSupportedSymbols() view returns (string[])",
  "function getCollateralTokens() view returns (address[])",
  "function availableCollateral(address writer, address token) view returns (uint256)",
  "function intrinsicValue(uint256 tokenId, uint256 spotWad) view returns (uint256)",
  "function quotePremium(tuple(string symbol, uint8 optionType, uint256 strikeWad, uint256 expiry, uint256 sizeWad, uint256 sigmaWad) q) view returns (uint256 premiumWad, tuple(uint256 premium, int256 delta, int256 gamma, int256 vega, int256 theta, int256 rho) greeks)",
  "function riskFreeRateWad() view returns (uint256)",
  "function accruedFees(address token) view returns (uint256)",
  "function feedIds(string symbol) view returns (bytes32)",
  "function positions(uint256 tokenId) view returns (uint256 tokenId, bytes32 feedId, string symbol, uint8 optionType, uint256 strikeWad, uint256 expiry, uint256 sizeWad, uint256 premiumWad, address writer, address buyer, address collateralToken, uint256 collateralWad, address scheduleId, bool settled)",

  // Write functions
  "function depositHBAR() payable",
  "function depositERC20(address token, uint256 amount)",
  "function withdrawCollateral(address token, uint256 amount)",
  "function writeOption(tuple(string symbol, uint8 optionType, uint256 strikeWad, uint256 expiry, uint256 sizeWad, uint256 sigmaWad, address collateralToken, bytes[] pythUpdateData) wp, uint256 maxPremium) payable returns (uint256 tokenId, uint256 premiumWad)",
  "function exercise(uint256 tokenId, bytes[] pythUpdateData) payable",
  "function expireOption(uint256 tokenId)",

  // Events
  "event OptionWritten(uint256 indexed tokenId, address indexed writer, address indexed buyer, string symbol, uint8 optionType, uint256 strikeWad, uint256 sizeWad, uint256 expiry, uint256 premiumWad, address scheduleId)",
  "event OptionExercised(uint256 indexed tokenId, address indexed exerciser, uint256 spotWad, uint256 payoutWad)",
  "event OptionExpired(uint256 indexed tokenId, bool automated)",
  "event CollateralDeposited(address indexed writer, address indexed token, uint256 amount)",
  "event CollateralWithdrawn(address indexed writer, address indexed token, uint256 amount)",
] as const;

// ── OptionToken ABI ──────────────────────────────────────────────────────────

export const OPTION_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getOptionData(uint256 tokenId) view returns (tuple(bytes32 feedId, string underlyingSymbol, uint8 optionType, uint256 strikeWad, uint256 expiry, uint256 sizeWad, uint256 premiumWad, address writer, address collateralToken, address scheduleId, uint8 status, uint256 createdAt))",
] as const;

// ── Contract Addresses ───────────────────────────────────────────────────────

export function getContractAddresses() {
  return {
    optionsVault: config.optionsVault,
    // OptionToken address is deployed by OptionsVault - fetch from contract
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export enum OptionType {
  Call = 0,
  Put = 1,
}

export interface Position {
  tokenId: bigint;
  feedId: string;
  symbol: string;
  optionType: OptionType;
  strikeWad: bigint;
  expiry: bigint;
  sizeWad: bigint;
  premiumWad: bigint;
  writer: string;
  buyer: string;
  collateralToken: string;
  collateralWad: bigint;
  scheduleId: string;
  settled: boolean;
}

export interface Greeks {
  premium: bigint;
  delta: bigint;
  gamma: bigint;
  vega: bigint;
  theta: bigint;
  rho: bigint;
}

export interface QuoteResult {
  premiumWad: bigint;
  greeks: Greeks;
}

export interface QuoteParams {
  symbol: string;
  optionType: OptionType;
  strikeWad: bigint;
  expiry: bigint;
  sizeWad: bigint;
  sigmaWad: bigint;
}

// Write Option Parameters (matches contract's WriteParams struct)
export interface WriteParams {
  symbol: string;
  optionType: OptionType;
  strikeWad: bigint;
  expiry: bigint;
  sizeWad: bigint;
  sigmaWad: bigint;
  collateralToken: string;
  pythUpdateData: string[];
}

// Collateral Token info
export interface CollateralToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Supported collateral tokens (USDC and HBAR)
export const COLLATERAL_TOKENS: CollateralToken[] = [
  { address: "0x0000000000000000000000000000000000000000", symbol: "HBAR", name: "Hedera", decimals: 8 },
  { address: "0x1234567890abcdef1234567890abcdef12345678", symbol: "USDC", name: "USD Coin", decimals: 6 },
];

// Token symbol to address lookup
export const TOKEN_ADDRESS_MAP: Record<string, string> = {
  HBAR: "0x0000000000000000000000000000000000000000",
  USDC: "0x1234567890abcdef1234567890abcdef12345678",
};

// ── Transaction Builders ───────────────────────────────────────────────────────

import { Interface } from "ethers";

const vaultInterface = new Interface(OPTIONS_VAULT_ABI);

/**
 * Encode depositHBAR transaction data
 */
export function encodeDepositHBAR(amount: bigint): string {
  // depositHBAR is payable - amount sent is the collateral
  return vaultInterface.encodeFunctionData("depositHBAR");
}

/**
 * Encode depositERC20 transaction data
 */
export function encodeDepositERC20(tokenAddress: string, amount: bigint): string {
  return vaultInterface.encodeFunctionData("depositERC20", [tokenAddress, amount]);
}

/**
 * Encode withdrawCollateral transaction data
 */
export function encodeWithdrawCollateral(tokenAddress: string, amount: bigint): string {
  return vaultInterface.encodeFunctionData("withdrawCollateral", [tokenAddress, amount]);
}

/**
 * Encode writeOption transaction data
 */
export function encodeWriteOption(writeParams: WriteParams, maxPremium: bigint): string {
  return vaultInterface.encodeFunctionData("writeOption", [writeParams, maxPremium]);
}

/**
 * Encode exercise transaction data
 */
export function encodeExercise(tokenId: bigint, pythUpdateData: string[]): string {
  return vaultInterface.encodeFunctionData("exercise", [tokenId, pythUpdateData]);
}
