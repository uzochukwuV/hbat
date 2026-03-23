import * as dotenv from "dotenv";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables FIRST
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

// ── Auto-load deployment addresses from deployments/*.json ───────────────────

interface DeploymentArtifact {
  contracts: {
    OptionsVault: string;
    OptionToken: string;
    Pyth: string;
  };
  feeds: Record<string, string>;
}

function loadDeployment(chainId: number): DeploymentArtifact | null {
  const deployPath = path.resolve(__dirname, `../../deployments/${chainId}.json`);
  if (existsSync(deployPath)) {
    try {
      return JSON.parse(readFileSync(deployPath, "utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

// Load testnet (296) or mainnet (295) deployment
const deployment = loadDeployment(296) || loadDeployment(295);

// ── Hedera Network ────────────────────────────────────────────────────────────

export const HEDERA_NETWORK        = (process.env.HEDERA_NETWORK || "testnet") as "mainnet" | "testnet" | "local";
export const OPERATOR_ACCOUNT_ID   = process.env["OPERATOR_ACCOUNT_ID"]  || "";
export const OPERATOR_PRIVATE_KEY  = process.env["OPERATOR_PRIVATE_KEY"] || "";
export const HEDERA_TESTNET_RPC    = process.env.HEDERA_TESTNET_RPC  || "https://testnet.hashio.io/api";
export const HEDERA_MAINNET_RPC    = process.env.HEDERA_MAINNET_RPC  || "https://mainnet.hashio.io/api";
export const HEDERA_MIRROR_NODE    = process.env.HEDERA_MIRROR_NODE  || "https://testnet.mirrornode.hedera.com";

// ── Deployed Contracts (auto-loaded from deployment artifact) ────────────────

export const OPTIONS_VAULT_ADDRESS = process.env.OPTIONS_VAULT_ADDRESS || deployment?.contracts.OptionsVault || "";
export const OPTION_TOKEN_ADDRESS  = process.env.OPTION_TOKEN_ADDRESS  || deployment?.contracts.OptionToken  || "";

// ── Pyth Oracle ───────────────────────────────────────────────────────────────

export const PYTH_HERMES_ENDPOINT  = process.env.PYTH_HERMES_ENDPOINT || "https://hermes.pyth.network";
export const PYTH_CONTRACT_ADDRESS = process.env.PYTH_CONTRACT_ADDRESS || deployment?.contracts.Pyth || "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";

/// Pyth price feed IDs (auto-loaded from deployment or defaults)
export const PYTH_FEEDS: Record<string, `0x${string}`> = {
  "HBAR": (deployment?.feeds.HBAR || "0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd") as `0x${string}`,
  "BTC":  (deployment?.feeds.BTC  || "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43") as `0x${string}`,
  "ETH":  (deployment?.feeds.ETH  || "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace") as `0x${string}`,
  "XAU":  (deployment?.feeds.XAU  || "0x44465e17d2e9d390e70c999d5a11fda4f092847fcd2e3e5aa089d96c98a30e67") as `0x${string}`,
  "EUR":  (deployment?.feeds.EUR  || "0x76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c") as `0x${string}`,
  "USDC": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a" as `0x${string}`,
};

// ── AI Provider ───────────────────────────────────────────────────────────────
// Supports: OpenRouter, Anthropic, Google Gemini, or AkashML (detected by env var)

export const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"] || "";
export const ANTHROPIC_API_KEY  = process.env["ANTHROPIC_API_KEY"]  || "";
export const GEMINI_API_KEY     = process.env["GEMINI_API_KEY"]     || "";
export const AKASHML_API_KEY    = process.env["AKASHML_API_KEY"]    || "";

// Detect which provider is configured
export const AI_PROVIDER: "openrouter" | "anthropic" | "gemini" | "akashml" = (() => {
   if (OPENROUTER_API_KEY) return "openrouter";
  if (AKASHML_API_KEY)    return "akashml";
 
  if (ANTHROPIC_API_KEY)  return "anthropic";
  if (GEMINI_API_KEY)     return "gemini";
  throw new Error(
    "No AI API key configured. Set one of: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or AKASHML_API_KEY in .env"
  );
})();

// Default model per provider
export const OPENROUTER_MODEL  = process.env["OPENROUTER_MODEL"] || "stepfun/step-3.5-flash:free";
export const CLAUDE_MODEL      = "claude-opus-4-6";
export const AKASHML_MODEL     = process.env["AKASHML_MODEL"]    || "Qwen/Qwen3-30B-A3B";

// ── Protocol Defaults ─────────────────────────────────────────────────────────

export const DEFAULT_RISK_FREE_RATE = BigInt(process.env.DEFAULT_RISK_FREE_RATE || "50000000000000000"); // 5%
export const DEFAULT_VOLATILITY     = BigInt(process.env.DEFAULT_VOLATILITY     || "800000000000000000"); // 80%
export const DEFAULT_EXPIRY_DAYS    = Number(process.env.DEFAULT_EXPIRY_DURATION_DAYS || "7");

export const WAD = BigInt("1000000000000000000"); // 1e18