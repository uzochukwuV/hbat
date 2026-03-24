/**
 * Application Configuration
 * Environment variables and constants
 */

export const config = {
  // Hedera Network
  network: process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet",

  // Contract Addresses - Deployed on 2026-03-23
  optionsVault: process.env.NEXT_PUBLIC_OPTIONS_VAULT_ADDRESS || "0xd4C7B5D38ca256702455D87eC11b36101C68e2d3",
  optionToken: process.env.NEXT_PUBLIC_OPTION_TOKEN_ADDRESS || "0x3225e38c79d09765348cbbc35b792152Fc5e6B8C",
  pythOracle: process.env.NEXT_PUBLIC_PYTH_ORACLE_ADDRESS || "0xa2aa501b19aff244d90cc15a4cf739d2725b5729",

  // AI Agent API
  agentApiUrl: process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001",

  // Hedera Mirror Node
  mirrorNode:
    process.env.NEXT_PUBLIC_HEDERA_NETWORK === "mainnet"
      ? "https://mainnet-public.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com",

  // JSON-RPC endpoint for EVM calls
  rpcUrl:
    process.env.NEXT_PUBLIC_HEDERA_NETWORK === "mainnet"
      ? "https://mainnet.hashio.io/api"
      : "https://testnet.hashio.io/api",

  // Pyth Hermes API
  pythHermesUrl: "https://hermes.pyth.network",

  // Price Feed IDs
  priceFeeds: {
    HBAR: "0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd",
    BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    XAU: "0x44465e17d2e9d390e70c999d5a11fda4f092847fcd2e3e5aa089d96c98a30e67",
    EUR: "0x76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c",
  },
} as const;

export type NetworkType = "mainnet" | "testnet" | "previewnet";
export type AssetSymbol = keyof typeof config.priceFeeds;
