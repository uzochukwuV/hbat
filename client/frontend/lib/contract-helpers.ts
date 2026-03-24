/**
 * Contract Transaction Helpers
 * Build unsigned transactions with Pyth price updates
 */

import { ethers } from "ethers";
import { fetchSinglePriceUpdate, encodePriceUpdate } from "./pyth-updates";
import type { AssetSymbol } from "./config";
import type { UnsignedTransaction } from "@/types";

/**
 * Build write option transaction with Pyth price update
 *
 * @param contractAddress Options vault contract address
 * @param contractABI Contract ABI
 * @param params Option parameters
 * @returns Unsigned transaction ready for wallet signing
 */
export async function buildWriteOptionTx(
  contractAddress: string,
  contractABI: ethers.InterfaceAbi,
  params: {
    optionType: 0 | 1; // 0 = CALL, 1 = PUT
    asset: AssetSymbol;
    strike: bigint;
    expiry: number;
    size: bigint;
    collateral: bigint;
  }
): Promise<UnsignedTransaction> {
  // Fetch latest Pyth price update
  const priceUpdate = await fetchSinglePriceUpdate(params.asset);

  // Encode price update VAA
  const pythUpdateData = encodePriceUpdate(priceUpdate.vaa);

  // Create contract interface
  const iface = new ethers.Interface(contractABI);

  // Encode function call
  // Assuming contract function: writeOption(uint8 optionType, address asset, uint256 strike, uint256 expiry, uint256 size, bytes[] pythUpdateData)
  const data = iface.encodeFunctionData("writeOption", [
    params.optionType,
    // Asset address would come from a registry
    ethers.ZeroAddress, // Placeholder - use actual asset address
    params.strike,
    params.expiry,
    params.size,
    [pythUpdateData], // Pyth update data as bytes array
  ]);

  return {
    to: contractAddress,
    value: params.collateral.toString(), // Collateral sent as msg.value
    data,
    gasLimit: 500000, // Estimate gas
  };
}

/**
 * Build buy option transaction
 */
export async function buildBuyOptionTx(
  contractAddress: string,
  contractABI: ethers.InterfaceAbi,
  params: {
    optionId: number;
    premium: bigint;
  }
): Promise<UnsignedTransaction> {
  const iface = new ethers.Interface(contractABI);

  const data = iface.encodeFunctionData("buyOption", [params.optionId]);

  return {
    to: contractAddress,
    value: params.premium.toString(), // Premium sent as msg.value
    data,
    gasLimit: 300000,
  };
}

/**
 * Build exercise option transaction with Pyth price update
 */
export async function buildExerciseOptionTx(
  contractAddress: string,
  contractABI: ethers.InterfaceAbi,
  params: {
    optionId: number;
    asset: AssetSymbol;
  }
): Promise<UnsignedTransaction> {
  // Fetch latest price update for settlement
  const priceUpdate = await fetchSinglePriceUpdate(params.asset);
  const pythUpdateData = encodePriceUpdate(priceUpdate.vaa);

  const iface = new ethers.Interface(contractABI);

  // Assuming contract function: exerciseOption(uint256 optionId, bytes[] pythUpdateData)
  const data = iface.encodeFunctionData("exerciseOption", [
    params.optionId,
    [pythUpdateData],
  ]);

  return {
    to: contractAddress,
    value: "0",
    data,
    gasLimit: 400000,
  };
}

/**
 * Build quote option transaction (view function - no tx needed)
 * This is for getting premium quote from contract
 */
export async function quoteOptionPremium(
  contractAddress: string,
  contractABI: ethers.InterfaceAbi,
  provider: ethers.Provider,
  params: {
    optionType: 0 | 1;
    asset: AssetSymbol;
    strike: bigint;
    expiry: number;
    size: bigint;
  }
): Promise<{
  premium: bigint;
  collateral: bigint;
}> {
  // Fetch latest price update
  const priceUpdate = await fetchSinglePriceUpdate(params.asset);
  const pythUpdateData = encodePriceUpdate(priceUpdate.vaa);

  const contract = new ethers.Contract(contractAddress, contractABI, provider);

  // Call view function
  const result = await contract.quoteOption(
    params.optionType,
    ethers.ZeroAddress, // Asset address placeholder
    params.strike,
    params.expiry,
    params.size,
    [pythUpdateData]
  );

  return {
    premium: result.premium,
    collateral: result.collateral,
  };
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  provider: ethers.Provider,
  tx: UnsignedTransaction
): Promise<bigint> {
  try {
    const gasEstimate = await provider.estimateGas({
      to: tx.to,
      value: tx.value,
      data: tx.data,
    });

    // Add 20% buffer
    return (gasEstimate * BigInt(120)) / BigInt(100);
  } catch (error) {
    console.error("Gas estimation failed:", error);
    // Return default gas limit
    return BigInt(tx.gasLimit);
  }
}
