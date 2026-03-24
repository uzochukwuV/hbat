/**
 * Hedera Wallet Integration using DAppConnector
 * Uses @hashgraph/hedera-wallet-connect with WalletConnect
 */

import {
  LedgerId,
  ContractExecuteTransaction,
  ContractId,
  Hbar,
  TransactionId,
  AccountId,
} from "@hashgraph/sdk";
import {
  DAppConnector,
  HederaChainId,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  transactionToBase64String,
} from "@hashgraph/hedera-wallet-connect";
import { ethers } from "ethers";
import { config } from "./config";
import type { UnsignedTransaction } from "@/types";

// Extend Window for ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ── Configuration ────────────────────────────────────────────────────────────

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const metadata = {
  name: "Hedera Options Vault",
  description: "AI-powered options trading on Hedera with auto-settlement",
  url: typeof window !== "undefined" ? window.location.origin : "https://localhost:3000",
  icons: ["/icon.png"],
};

// ── State ────────────────────────────────────────────────────────────────────

let dAppConnector: DAppConnector | null = null;
let isInitialized = false;

// ── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize DAppConnector
 * Call this once at app startup
 */
export async function initializeWallet(): Promise<DAppConnector> {
  if (isInitialized && dAppConnector) {
    return dAppConnector;
  }

  if (!projectId) {
    throw new Error(
      "WalletConnect Project ID not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local"
    );
  }

  const network = config.network === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET;

  dAppConnector = new DAppConnector(
    metadata,
    network,
    projectId,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Mainnet, HederaChainId.Testnet]
  );

  await dAppConnector.init({ logger: "error" });

  isInitialized = true;
  return dAppConnector;
}

// ── Connection ───────────────────────────────────────────────────────────────

/**
 * Open wallet connection modal
 */
export async function openConnectModal(): Promise<void> {
  const connector = await initializeWallet();
  await connector.openModal();
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (dAppConnector) {
    try {
      await dAppConnector.disconnectAll();
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  }
}

/**
 * Get connected signers
 */
export function getSigners() {
  return dAppConnector?.signers || [];
}

/**
 * Get first connected account ID
 */
export function getAccountId(): string | null {
  const signers = getSigners();
  if (signers.length > 0) {
    return signers[0].getAccountId().toString();
  }
  return null;
}

/**
 * Check if wallet is connected
 */
export function isConnected(): boolean {
  const signers = getSigners();
  return signers.length > 0;
}

// ── Balance ──────────────────────────────────────────────────────────────────

/**
 * Get HBAR balance from Mirror Node
 */
export async function getBalance(accountId: string): Promise<string> {
  try {
    const response = await fetch(
      `${config.mirrorNode}/api/v1/accounts/${accountId}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch balance");
    }

    const data = await response.json();
    // Balance in tinybars, convert to HBAR
    const balanceHbar = Number(data.balance?.balance || 0) / 1e8;
    return balanceHbar.toFixed(4);
  } catch (error) {
    console.error("Failed to get balance:", error);
    return "0";
  }
}

// ── Signing ──────────────────────────────────────────────────────────────────

/**
 * Sign a message
 */
export async function signMessage(
  accountId: string,
  message: string
): Promise<string> {
  if (!dAppConnector) {
    throw new Error("Wallet not initialized");
  }

  const result = await dAppConnector.signMessage({
    signerAccountId: accountId,
    message,
  });

  // Result is JsonRpcResult with signatureMap in result property
  return (result as any).result?.signatureMap || (result as any).signatureMap || "";
}

/**
 * Sign and execute a Hedera transaction
 */
export async function signAndExecuteTransaction(
  accountId: string,
  transaction: any
): Promise<{ transactionId: string }> {
  if (!dAppConnector) {
    throw new Error("Wallet not initialized");
  }

  const result = await dAppConnector.signAndExecuteTransaction({
    signerAccountId: accountId,
    transactionList: transactionToBase64String(transaction),
  });

  // Result is JsonRpcResult<TransactionResponseJSON>
  const txResponse = (result as any).result || result;
  return { transactionId: txResponse.transactionId || txResponse.nodeTransactionPrecheckCode || "" };
}

/**
 * Send EVM transaction
 * Supports both HashPack (via DAppConnector) and MetaMask (via window.ethereum)
 */
export async function sendEvmTransaction(tx: UnsignedTransaction): Promise<string> {
  const signers = getSigners();

  // If we have a DAppConnector signer (HashPack/WalletConnect), use native Hedera tx
  if (signers.length > 0 && dAppConnector) {
    return sendHederaContractTransaction(tx);
  }

  // Fallback to MetaMask/EVM wallet
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet available. Connect HashPack or MetaMask.");
  }

  // Check if window.ethereum is a valid EIP-1193 provider
  if (window.ethereum["app.hashpack"]) {
    // HashPack is injected but we should use DAppConnector instead
    throw new Error("Please use the Connect Wallet button to connect HashPack properly.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  const txResponse = await signer.sendTransaction({
    to: tx.to,
    value: tx.value,
    data: tx.data,
    gasLimit: tx.gasLimit,
  });

  const receipt = await txResponse.wait();
  return receipt?.hash || txResponse.hash;
}

/**
 * Resolve EVM address to Hedera Contract ID via Mirror Node
 */
async function resolveContractId(evmAddress: string): Promise<string> {
  const cleanAddress = evmAddress.toLowerCase().replace("0x", "");

  // Check if it's a long-zero address (native Hedera contract)
  if (cleanAddress.startsWith("000000000000000000000000")) {
    const contractNum = parseInt(cleanAddress.slice(24), 16);
    return `0.0.${contractNum}`;
  }

  // Query Mirror Node to get the contract ID
  try {
    const response = await fetch(
      `${config.mirrorNode}/api/v1/contracts/${evmAddress}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.contract_id) {
        console.log(`[Wallet] Resolved ${evmAddress} to ${data.contract_id}`);
        return data.contract_id;
      }
    }
  } catch (err) {
    console.warn(`[Wallet] Mirror node lookup failed for ${evmAddress}:`, err);
  }

  // Fallback: throw error since we can't properly identify the contract
  throw new Error(`Could not resolve contract ID for ${evmAddress}. Check if contract is deployed.`);
}

/**
 * Send transaction via Hedera SDK + DAppConnector (for HashPack)
 * Converts EVM-style tx to Hedera ContractExecuteTransaction
 */
async function sendHederaContractTransaction(tx: UnsignedTransaction): Promise<string> {
  if (!dAppConnector) {
    throw new Error("DAppConnector not initialized");
  }

  const signers = getSigners();
  if (signers.length === 0) {
    throw new Error("No signers available");
  }

  const signer = signers[0];
  const accountIdStr = signer.getAccountId().toString();
  const accountIdObj = AccountId.fromString(accountIdStr);

  // Resolve EVM address to Hedera Contract ID via Mirror Node
  const contractIdStr = await resolveContractId(tx.to);
  const contractId = ContractId.fromString(contractIdStr);

  console.log(`[Wallet] Using Contract ID: ${contractId.toString()} for address ${tx.to}`);

  // Parse the value (in wei for HBAR, 1e18 = 1 HBAR)
  let hbarValue = Hbar.fromTinybars(0);
  if (tx.value && tx.value !== "0") {
    // Value is in wei (1e18), convert to HBAR
    const valueWei = BigInt(tx.value);
    // 1 HBAR = 1e18 wei = 1e8 tinybars
    // So wei / 1e10 = tinybars
    const tinybars = valueWei / BigInt(1e10);
    hbarValue = Hbar.fromTinybars(Number(tinybars));
  }

  // Get the network node account IDs for testnet
  const nodeAccountId = AccountId.fromString("0.0.3"); // Testnet node

  // Build ContractExecuteTransaction with all required fields
  const contractTx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(tx.gasLimit || 100000)
    .setPayableAmount(hbarValue)
    .setFunctionParameters(Buffer.from(tx.data.slice(2), "hex")) // Remove 0x prefix
    .setTransactionId(TransactionId.generate(accountIdObj))
    .setNodeAccountIds([nodeAccountId]);

  // Freeze the transaction (no signer needed since we set all fields)
  const frozenTx = contractTx.freeze();

  // Sign and execute via DAppConnector
  const result = await dAppConnector.signAndExecuteTransaction({
    signerAccountId: accountIdStr,
    transactionList: transactionToBase64String(frozenTx),
  });

  // Extract transaction ID from result
  const txResponse = (result as any).result || result;
  const transactionId = txResponse.transactionId || "";

  // Convert Hedera transaction ID to a hash-like format for display
  // Format: accountId@seconds.nanos
  if (transactionId) {
    // Return the transaction ID - user can look it up on HashScan
    return transactionId;
  }

  throw new Error("Transaction executed but no ID returned");
}

// ── Account Subscription ─────────────────────────────────────────────────────

type AccountCallback = (accountId: string | null) => void;
const accountCallbacks: AccountCallback[] = [];

/**
 * Subscribe to account changes
 */
export function subscribeToAccount(callback: AccountCallback): () => void {
  accountCallbacks.push(callback);

  // Check current state
  const accountId = getAccountId();
  if (accountId) {
    callback(accountId);
  }

  return () => {
    const index = accountCallbacks.indexOf(callback);
    if (index > -1) {
      accountCallbacks.splice(index, 1);
    }
  };
}

/**
 * Notify subscribers of account change
 */
export function notifyAccountChange(accountId: string | null): void {
  accountCallbacks.forEach((cb) => cb(accountId));
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Convert Hedera account ID to EVM address
 * 0.0.12345 -> 0x0000000000000000000000000000000000003039
 */
export function accountIdToEvmAddress(accountId: string): string {
  const parts = accountId.split(".");
  if (parts.length !== 3) return accountId;

  const num = parseInt(parts[2]);
  return "0x" + num.toString(16).padStart(40, "0");
}

/**
 * Convert EVM address to Hedera account ID
 */
export function evmAddressToAccountId(evmAddress: string): string {
  const cleanAddress = evmAddress.toLowerCase().replace("0x", "");

  // Check if it's a long-zero address (Hedera native account)
  if (cleanAddress.startsWith("000000000000000000000000")) {
    const accountNum = parseInt(cleanAddress.slice(24), 16);
    return `0.0.${accountNum}`;
  }

  return evmAddress;
}

/**
 * Get DAppConnector instance
 */
export function getDAppConnector(): DAppConnector | null {
  return dAppConnector;
}

// Re-export for convenience
export { transactionToBase64String };
