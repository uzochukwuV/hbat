/**
 * Tool: exercise_option
 * Builds an UNSIGNED transaction to exercise an in-the-money option.
 * Returns calldata for the user to sign with their wallet.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ethers } from "ethers";
import { fetchPythPrice, encodeUpdateData } from "../utils/pyth";
import { getVaultContractReadOnly, fromWad } from "../utils/hedera";

// @ts-ignore TS2589: Zod+LangChain inference depth — runtime is correct
export const exerciseOptionTool = tool(
  async ({ tokenId }) => {
    try {
      const vault = getVaultContractReadOnly();

      // 1. Fetch position details
      const pos = await vault.getPosition(tokenId);
      if (!pos || pos.tokenId === 0n) {
        return `Option #${tokenId} not found.`;
      }

      if (pos.settled) {
        return `Option #${tokenId} has already been settled.`;
      }

      const symbol   = pos.symbol as string;
      const isCall   = Number(pos.optionType) === 0;
      const strikeWad = pos.strikeWad as bigint;
      const sizeWad   = pos.sizeWad as bigint;

      // 2. Fetch live price + VAA for the underlying
      const pythPrice = await fetchPythPrice(symbol);
      const vaaBytes  = encodeUpdateData([pythPrice.vaa]);

      // 3. Calculate current intrinsic value
      const spotWad   = pythPrice.priceWad;
      const intrinsic = await vault.intrinsicValue(tokenId, spotWad);
      const payoutUsd = fromWad(intrinsic as bigint);

      // 4. Determine if ITM
      const spotUsd   = pythPrice.price;
      const strikeUsd = Number(fromWad(strikeWad));
      const isItm     = isCall ? spotUsd > strikeUsd : spotUsd < strikeUsd;
      const moneyness = isCall
        ? spotUsd > strikeUsd ? "ITM" : "OTM"
        : spotUsd < strikeUsd ? "ITM" : "OTM";

      // 5. Encode exercise calldata
      const calldata = vault.interface.encodeFunctionData("exercise", [
        tokenId,
        vaaBytes,
      ]);

      // Include buffer for Pyth fee
      const valueWei = ethers.parseEther("0.05").toString();

      const unsignedTx = {
        to:       vault.target as string,
        data:     calldata,
        value:    valueWei,
        gasLimit: 500_000,
      };

      const lines = [
        `🎯 Exercise Option #${tokenId}`,
        ``,
        `Position:`,
        `  Type:     ${symbol} ${isCall ? "CALL" : "PUT"}`,
        `  Strike:   $${strikeUsd.toFixed(4)}`,
        `  Size:     ${fromWad(sizeWad)} units`,
        ``,
        `Current Market:`,
        `  Spot:     $${spotUsd.toFixed(6)}`,
        `  Status:   ${moneyness} (${isItm ? "profitable" : "no value"})`,
        `  Payout:   $${payoutUsd}`,
        ``,
      ];

      if (!isItm) {
        lines.push(
          `⚠️  This option is OUT-OF-THE-MONEY. Exercising will result in ZERO payout.`,
          `    Consider waiting for price movement or letting it expire.`,
          ``
        );
      } else {
        lines.push(
          `✅ This option is IN-THE-MONEY. Expected payout: $${payoutUsd}`,
          ``
        );
      }

      lines.push(
        `Sign and submit with your Hedera wallet:`,
        ``,
        `\`\`\`unsigned-tx`,
        JSON.stringify(unsignedTx),
        `\`\`\``,
        ``,
        `The vault will fetch the latest Pyth price, calculate intrinsic value,`,
        `and transfer the cash settlement to your wallet.`
      );

      return lines.join("\n");
    } catch (err) {
      return `Error building exercise transaction: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "exercise_option",
    description:
      "Exercise an in-the-money option for cash settlement. " +
      "Fetches live Pyth price to calculate intrinsic value payout. " +
      "Returns an unsigned transaction for the user to sign. " +
      "Only the NFT owner can exercise their option.",
    schema: z.object({
      tokenId: z
        .number()
        .int()
        .nonnegative()
        .describe("The OptionToken NFT ID to exercise"),
    }),
  }
);
