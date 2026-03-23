/**
 * Hedera Tools — Unsigned Transaction Pattern
 *
 * Architecture:
 *   Frontend → AI Agent API → Returns unsigned tx → Frontend → User signs with wallet
 *
 * - Read operations: Use Mirror Node API (no signing needed)
 * - Write operations: Return unsigned transactions for user to sign
 * - NO private keys are handled by the backend for user operations
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ethers } from "ethers";
import {
  HEDERA_NETWORK,
  HEDERA_MIRROR_NODE,
  OPTIONS_VAULT_ADDRESS,
} from "../config";
import { VAULT_ABI } from "../utils/hedera";

// ── Mirror Node API for read-only queries ────────────────────────────────────

async function fetchMirrorNode(path: string): Promise<unknown> {
  const res = await fetch(`${HEDERA_MIRROR_NODE}${path}`);
  if (!res.ok) {
    throw new Error(`Mirror node error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Tool: Get HBAR Balance (Read-Only) ───────────────────────────────────────

export const getHbarBalanceTool = tool(
  async ({ accountId }) => {
    try {
      const data = await fetchMirrorNode(`/api/v1/accounts/${accountId}`) as {
        account: string;
        balance: { balance: number };
        evm_address: string;
      };

      const hbarBalance = data.balance.balance / 1e8; // tinybars to HBAR

      return [
        `💰 HBAR Balance`,
        ``,
        `Account:     ${data.account}`,
        `EVM Address: ${data.evm_address || "N/A"}`,
        `Balance:     ${hbarBalance.toFixed(8)} HBAR`,
        `Network:     ${HEDERA_NETWORK}`,
      ].join("\n");
    } catch (err) {
      return `Error fetching balance: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "get_hbar_balance",
    description:
      "Get the HBAR balance for a Hedera account (read-only, no signing). " +
      "Accepts account ID (0.0.XXXXX) or EVM address (0x...).",
    schema: z.object({
      accountId: z
        .string()
        .describe("Hedera account ID (0.0.XXXXX) or EVM address (0x...)"),
    }),
  }
);

// ── Tool: Get Account Info (Read-Only) ───────────────────────────────────────

export const getAccountInfoTool = tool(
  async ({ accountId }) => {
    try {
      const data = await fetchMirrorNode(`/api/v1/accounts/${accountId}`) as {
        account: string;
        evm_address: string;
        balance: { balance: number };
        auto_renew_period: number;
        memo: string;
        key: { _type: string };
        created_timestamp: string;
      };

      const hbarBalance = data.balance.balance / 1e8;

      return [
        `📋 Account Info: ${data.account}`,
        ``,
        `EVM Address:     ${data.evm_address || "N/A"}`,
        `HBAR Balance:    ${hbarBalance.toFixed(8)} HBAR`,
        `Auto-Renew:      ${data.auto_renew_period || "N/A"} seconds`,
        `Memo:            ${data.memo || "(none)"}`,
        `Key Type:        ${data.key?._type || "N/A"}`,
        `Created:         ${data.created_timestamp || "N/A"}`,
        ``,
        `Network: ${HEDERA_NETWORK}`,
      ].join("\n");
    } catch (err) {
      return `Error fetching account info: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "get_account_info",
    description:
      "Get detailed information about a Hedera account (read-only). " +
      "Returns EVM address, balance, auto-renew settings, and key info.",
    schema: z.object({
      accountId: z
        .string()
        .describe("Hedera account ID (0.0.XXXXX) or EVM address"),
    }),
  }
);

// ── Tool: Transfer HBAR (Returns Unsigned Tx) ────────────────────────────────

export const transferHbarTool = tool(
  async ({ toAccountId, amount }) => {
    try {
      // Resolve destination to EVM address if needed
      let toAddress = toAccountId;
      if (toAccountId.startsWith("0.0.")) {
        const data = await fetchMirrorNode(`/api/v1/accounts/${toAccountId}`) as {
          evm_address: string;
        };
        toAddress = data.evm_address;
        if (!toAddress) {
          return `Error: Account ${toAccountId} has no EVM address.`;
        }
      }

      // Build unsigned EVM transfer
      const amountWei = ethers.parseEther(amount.toString()).toString();

      const unsignedTx = {
        to: toAddress,
        value: amountWei,
        data: "0x",
        gasLimit: 21000,
      };

      return [
        `📤 HBAR Transfer — Sign with Your Wallet`,
        ``,
        `To:      ${toAccountId}`,
        `         (${toAddress})`,
        `Amount:  ${amount} HBAR`,
        ``,
        `Sign and submit this transaction:`,
        ``,
        `\`\`\`unsigned-tx`,
        JSON.stringify(unsignedTx, null, 2),
        `\`\`\``,
      ].join("\n");
    } catch (err) {
      return `Error building transfer: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "transfer_hbar",
    description:
      "Build an unsigned HBAR transfer transaction. " +
      "Returns tx data for the user to sign with their wallet.",
    schema: z.object({
      toAccountId: z
        .string()
        .describe("Destination account ID (0.0.XXXXX) or EVM address"),
      amount: z
        .number()
        .positive()
        .describe("Amount of HBAR to transfer"),
    }),
  }
);

// ── Tool: Deposit HBAR to Vault (Returns Unsigned Tx) ────────────────────────

export const depositHbarTool = tool(
  async ({ amount }) => {
    try {
      if (!OPTIONS_VAULT_ADDRESS) {
        return "Error: OPTIONS_VAULT_ADDRESS not configured. Deploy the vault first.";
      }

      const vault = new ethers.Interface(VAULT_ABI);
      const calldata = vault.encodeFunctionData("depositHBAR", []);
      const amountWei = ethers.parseEther(amount.toString()).toString();

      const unsignedTx = {
        to: OPTIONS_VAULT_ADDRESS,
        value: amountWei,
        data: calldata,
        gasLimit: 100_000,
      };

      return [
        `💰 Deposit HBAR Collateral — Sign with Your Wallet`,
        ``,
        `Amount:  ${amount} HBAR`,
        `Vault:   ${OPTIONS_VAULT_ADDRESS}`,
        ``,
        `This deposits collateral for writing covered calls/puts.`,
        ``,
        `\`\`\`unsigned-tx`,
        JSON.stringify(unsignedTx, null, 2),
        `\`\`\``,
      ].join("\n");
    } catch (err) {
      return `Error building deposit: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "deposit_hbar",
    description:
      "Build an unsigned transaction to deposit HBAR collateral into the Options Vault. " +
      "Required before writing options.",
    schema: z.object({
      amount: z
        .number()
        .positive()
        .describe("Amount of HBAR to deposit as collateral"),
    }),
  }
);

// ── Tool: Withdraw Collateral from Vault ─────────────────────────────────────

export const withdrawCollateralTool = tool(
  async ({ amount }) => {
    try {
      if (!OPTIONS_VAULT_ADDRESS) {
        return "Error: OPTIONS_VAULT_ADDRESS not configured.";
      }

      const vault = new ethers.Interface(VAULT_ABI);
      const amountWad = ethers.parseEther(amount.toString());
      const calldata = vault.encodeFunctionData("withdrawCollateral", [
        ethers.ZeroAddress, // HBAR
        amountWad,
      ]);

      const unsignedTx = {
        to: OPTIONS_VAULT_ADDRESS,
        value: "0",
        data: calldata,
        gasLimit: 100_000,
      };

      return [
        `💸 Withdraw HBAR Collateral — Sign with Your Wallet`,
        ``,
        `Amount:  ${amount} HBAR`,
        `Vault:   ${OPTIONS_VAULT_ADDRESS}`,
        ``,
        `Note: Only unlocked collateral can be withdrawn.`,
        ``,
        `\`\`\`unsigned-tx`,
        JSON.stringify(unsignedTx, null, 2),
        `\`\`\``,
      ].join("\n");
    } catch (err) {
      return `Error building withdrawal: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "withdraw_collateral",
    description:
      "Build an unsigned transaction to withdraw unlocked HBAR collateral. " +
      "Collateral locked in active options cannot be withdrawn.",
    schema: z.object({
      amount: z
        .number()
        .positive()
        .describe("Amount of HBAR to withdraw"),
    }),
  }
);

// ── Export all tools ─────────────────────────────────────────────────────────

console.log("[hederaKit] tools array building...");
export const hederaKitTools = [
  // Read-only (no signing)
  getHbarBalanceTool,
  getAccountInfoTool,
  // Write operations (return unsigned tx for user to sign)
  transferHbarTool,
  depositHbarTool,
  withdrawCollateralTool,
];
