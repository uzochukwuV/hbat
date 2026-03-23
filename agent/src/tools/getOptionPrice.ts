/**
 * Tool: get_option_price
 * Quote Black-Scholes premium and Greeks for an option using live Pyth prices.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { fetchPythPrice } from "../utils/pyth";
import {
  getVaultContractReadOnly,
  toWad,
  fromWad,
  parseOptionType,
  daysFromNow,
  formatExpiry,
  formatGreeks,
} from "../utils/hedera";
import { DEFAULT_VOLATILITY, DEFAULT_EXPIRY_DAYS } from "../config";

// @ts-ignore TS2589: Zod+LangChain inference depth — runtime is correct
export const getOptionPriceTool = tool(
  async ({ symbol, optionType, strikeUsd, expiryDays, sizeUnits, volatilityPct }) => {
    try {
      const upperSymbol = symbol.toUpperCase();

      // 1. Fetch live Pyth price
      const pythPrice = await fetchPythPrice(upperSymbol);

      // 2. Build quote params
      const strikeWad = toWad(strikeUsd);
      const sizeWad   = toWad(sizeUnits);
      const sigmaWad  = volatilityPct
        ? BigInt(Math.round(volatilityPct * 1e16))
        : DEFAULT_VOLATILITY;
      const expiry    = daysFromNow(expiryDays ?? DEFAULT_EXPIRY_DAYS);
      const optType   = parseOptionType(optionType);

      // 3. Call quotePremium on-chain
      const vault = getVaultContractReadOnly();
      const [premiumWad, greeks] = await vault.quotePremium({
        symbol:     upperSymbol,
        optionType: optType,
        strikeWad,
        expiry,
        sizeWad,
        sigmaWad,
      });

      // 4. Compute moneyness
      const spotUsd   = pythPrice.price;
      const isCall    = optType === 0;
      const intrinsic = isCall
        ? Math.max(0, spotUsd - strikeUsd) * sizeUnits
        : Math.max(0, strikeUsd - spotUsd) * sizeUnits;
      const premiumUsd = Number(fromWad(premiumWad as bigint));
      const timeValue  = premiumUsd - intrinsic;

      const moneyness = isCall
        ? spotUsd > strikeUsd ? "ITM" : spotUsd < strikeUsd ? "OTM" : "ATM"
        : spotUsd < strikeUsd ? "ITM" : spotUsd > strikeUsd ? "OTM" : "ATM";

      // 5. Format response
      const lines = [
        `📊 Option Quote: ${upperSymbol} ${optionType.toUpperCase()}`,
        ``,
        `┌─────────────────────────────────────┐`,
        `│ Spot Price:   $${spotUsd.toFixed(6).padStart(14)}  │`,
        `│ Strike:       $${strikeUsd.toFixed(4).padStart(14)}  │`,
        `│ Expiry:       ${formatExpiry(expiry).padStart(16)}  │`,
        `│ Size:         ${sizeUnits.toString().padStart(14)} units │`,
        `│ IV:           ${(Number(sigmaWad) / 1e16).toFixed(0).padStart(14)}%  │`,
        `├─────────────────────────────────────┤`,
        `│ Premium:      $${premiumUsd.toFixed(4).padStart(14)}  │`,
        `│ Moneyness:    ${moneyness.padStart(16)}  │`,
        `│ Intrinsic:    $${intrinsic.toFixed(4).padStart(14)}  │`,
        `│ Time Value:   $${timeValue.toFixed(4).padStart(14)}  │`,
        `└─────────────────────────────────────┘`,
        ``,
        `Greeks:`,
        formatGreeks(greeks as {
          premium: bigint;
          delta: bigint;
          gamma: bigint;
          vega: bigint;
          theta: bigint;
          rho: bigint;
        }),
        ``,
        `💡 ${moneyness === "OTM" ? "This option is out-of-the-money. Premium is all time value." : moneyness === "ITM" ? "This option is in-the-money. Consider early exercise risk." : "This option is at-the-money. Maximum time value."}`,
      ];

      return lines.join("\n");
    } catch (err) {
      return `Error quoting option: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "get_option_price",
    description:
      "Get a live Black-Scholes option quote with Greeks (Delta, Gamma, Vega, Theta, Rho). " +
      "Uses live Pyth Network prices for the underlying asset. " +
      "Returns premium in USD and explains moneyness (ITM/ATM/OTM).",
    schema: z.object({
      symbol: z
        .string()
        .describe("Underlying asset: HBAR, BTC, ETH, XAU, EUR"),
      optionType: z
        .enum(["call", "put", "CALL", "PUT"])
        .describe("CALL: right to buy. PUT: right to sell."),
      strikeUsd: z
        .number()
        .positive()
        .describe("Strike price in USD"),
      expiryDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe("Days until expiry (default: 7)"),
      sizeUnits: z
        .number()
        .positive()
        .describe("Notional size in units of underlying"),
      volatilityPct: z
        .number()
        .min(1)
        .max(500)
        .optional()
        .describe("Implied volatility % (default: 80)"),
    }),
  }
);
