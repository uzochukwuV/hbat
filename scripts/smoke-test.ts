/**
 * Smoke test — full user flow on Hedera testnet
 *
 * Covers:
 *   1. Connect to deployed vault
 *   2. Collateral deposit (HBAR)
 *   3. Quote premium (read-only)
 *   4. Write a covered HBAR call option (fetches live Pyth VAA)
 *   5. Inspect minted NFT position
 *   6. Write a cash-secured HBAR put option
 *   7. Exercise the call (ITM scenario — fetches fresh Pyth VAA)
 *   8. Collateral withdrawal (residual after exercise)
 *
 * Usage:
 *   npx hardhat run scripts/smoke-test.ts --network testnet
 */

import { ethers } from "hardhat";
import { join } from "path";
import { readFileSync } from "fs";
import { OptionsVault__factory, OptionToken__factory } from "../typechain-types";

// ── Pyth Hermes endpoint for pulling fresh VAAs ───────────────────────────────
const HERMES_URL = "https://hermes.pyth.network";

const HBAR_FEED_ID = "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(wad: bigint, decimals = 4): string {
  const WAD = 10n ** 18n;
  const whole = wad / WAD;
  const frac  = (wad % WAD) * (10n ** BigInt(decimals)) / WAD;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

function log(msg: string) { console.log(`  ${msg}`); }
function section(title: string) {
  console.log();
  console.log(`${"─".repeat(52)}`);
  console.log(` ${title}`);
  console.log(`${"─".repeat(52)}`);
}

/** Fetch a fresh Pyth price update VAA from Hermes for the given feed IDs. */
async function fetchPythVaa(feedIds: string[]): Promise<{ vaas: string[]; price: bigint; expo: number }> {
  // Hermes API expects feed IDs without 0x prefix
  const ids = feedIds.map(id => `ids[]=${id.replace(/^0x/, "")}`).join("&");
  const url  = `${HERMES_URL}/v2/updates/price/latest?${ids}&encoding=hex`;

  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Hermes fetch failed: ${res.status} ${await res.text()}`);

  const json = await res.json() as {
    binary: { data: string[] };
    parsed: { price: { price: string; expo: number } }[];
  };

  const vaas  = json.binary.data.map((d: string) => "0x" + d);
  const price = BigInt(json.parsed[0]!.price.price);
  const expo  = json.parsed[0]!.price.expo;

  return { vaas, price, expo };
}

/** Convert Pyth price + expo to WAD (1e18). */
function pythToWad(price: bigint, expo: number): bigint {
  const WAD = BigInt("1000000000000000000");
  if (expo >= 0) {
    return price * WAD * (10n ** BigInt(expo));
  } else {
    const divisor = 10n ** BigInt(-expo);
    return price * WAD / divisor;
  }
}

// ── Load deployment artifact ──────────────────────────────────────────────────

function loadDeployment(chainId: number): { OptionsVault: string; OptionToken: string } {
  const path = join(__dirname, `../deployments/${chainId}.json`);
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return raw.contracts;
  } catch {
    throw new Error(`No deployment artifact found at ${path}. Run deploy:testnet first.`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();
  const chainId    = Number(network.chainId);

  console.log("═══════════════════════════════════════════════════");
  console.log(" Hedera Options Vault — Smoke Test");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Network:  testnet (chainId: ${chainId})`);
  console.log(`Signer:   ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} HBAR`);

  const addrs = loadDeployment(chainId);
  console.log(`Vault:    ${addrs.OptionsVault}`);
  console.log(`NFT:      ${addrs.OptionToken}`);

  const vault = OptionsVault__factory.connect(addrs.OptionsVault, deployer);
  const nft   = OptionToken__factory.connect(addrs.OptionToken,  deployer);

  const GAS       = { gasLimit: 2_000_000 };
  const GAS_WRITE = { gasLimit: 4_000_000 }; // writeOption: Pyth update + BSM + NFT mint

  // ── 1. Fetch live HBAR price ──────────────────────────────────────────────
  section("1. Fetch live HBAR/USD price from Pyth Hermes");
  const { vaas, price: rawPrice, expo } = await fetchPythVaa([HBAR_FEED_ID]);
  const spotWad = pythToWad(rawPrice, expo);
  log(`Spot HBAR/USD: $${fmt(spotWad)} (raw: ${rawPrice}e${expo})`);
  log(`VAA length:    ${vaas[0]!.length / 2 - 1} bytes`);

  // ── 2. Collateral deposit ─────────────────────────────────────────────────
  section("2. Deposit HBAR collateral");

  // Check collateral before deposit
  const collateralBefore = await vault.availableCollateral(deployer.address, ethers.ZeroAddress);
  log(`Before deposit: ${fmt(collateralBefore)} HBAR`);

  // Deposit 50 HBAR — enough to cover a small covered call
  const depositAmount = ethers.parseEther("50");
  log(`Sending depositHBAR with ${ethers.formatEther(depositAmount)} HBAR...`);

  const depositTx = await vault.depositHBAR({ value: depositAmount, gasLimit: 2_000_000 });
  log(`Tx hash: ${depositTx.hash}`);

  const depositReceipt = await depositTx.wait();
  if (!depositReceipt) throw new Error("Deposit receipt is null");

  log(`Tx status: ${depositReceipt.status} (1=success, 0=fail)`);
  log(`Gas used: ${depositReceipt.gasUsed.toString()}`);
  log(`Logs count: ${depositReceipt.logs.length}`);

  // Parse deposit event
  if (depositReceipt.logs.length > 0) {
    for (const logEntry of depositReceipt.logs) {
      try {
        const parsed = vault.interface.parseLog(logEntry);
        if (parsed) {
          log(`Event: ${parsed.name} - amount: ${parsed.args[2]?.toString()}`);
        }
      } catch {
        log(`Unparsed log: ${logEntry.topics[0]}`);
      }
    }
  }

  const collateralAfter = await vault.availableCollateral(deployer.address, ethers.ZeroAddress);
  log(`After deposit: ${fmt(collateralAfter)} HBAR`);

  if (collateralAfter === 0n) {
    log(`WARNING: Collateral is still 0 after deposit!`);
    log(`This suggests the depositHBAR function call was not properly executed.`);
    log(`The contract may have received the HBAR via receive() instead of depositHBAR().`);
  }

  // ── 3. Quote premium (read-only, no VAA needed) ───────────────────────────
  section("3. Quote HBAR call premium (Black-Scholes, read-only)");

  // Strike = spot + 10% (OTM call)
  const strikeWad  = spotWad * 110n / 100n;
  const sizeWad    = ethers.parseEther("100");   // 100 HBAR
  const sigmaWad   = ethers.parseEther("0.80");  // 80% IV
  const expiry     = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600); // 7 days

  const [premiumWad] = await vault.quotePremium({
    symbol:     "HBAR",
    optionType: 0, // Call
    strikeWad,
    expiry,
    sizeWad,
    sigmaWad,
  });

  log(`Spot:     $${fmt(spotWad)}`);
  log(`Strike:   $${fmt(strikeWad)} (+10% OTM)`);
  log(`Size:     100 HBAR`);
  log(`IV:       80%`);
  log(`Premium:  ${fmt(premiumWad)} HBAR`);

  // ── 4. Write covered HBAR call ────────────────────────────────────────────
  section("4. Write covered HBAR call option");

  const pythAddr     = await vault.pyth();
  const pythContract = await ethers.getContractAt("IPyth", pythAddr, deployer);
  const pythFee      = await pythContract.getUpdateFee(vaas);
  const msgValue     = pythFee + premiumWad + ethers.parseEther("0.5");

  // Manually encode + send to work around Hedera JSON-RPC relay dropping
  // calldata for complex structs with dynamic types (bytes[] in WriteParams)
  const writeCalldata = vault.interface.encodeFunctionData("writeOption", [
    {
      symbol:          "HBAR",
      optionType:      0,
      strikeWad,
      expiry,
      sizeWad,
      sigmaWad,
      collateralToken: ethers.ZeroAddress,
      pythUpdateData:  vaas,
    },
    premiumWad * 120n / 100n,
  ]);
  log(`Calldata length: ${writeCalldata.length} chars`);

  const writeTxRaw = await deployer.sendTransaction({
    to:       addrs.OptionsVault,
    data:     writeCalldata,
    value:    msgValue,
    gasLimit: 4_000_000,
  });
  log(`Write tx hash: ${writeTxRaw.hash}`);

  const writeReceipt = await writeTxRaw.wait();
  if (!writeReceipt) throw new Error("writeOption tx failed");

  // Parse OptionWritten event to get tokenId
  const writtenEvent = writeReceipt.logs
    .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "OptionWritten");

  if (!writtenEvent) throw new Error("OptionWritten event not found");
  const tokenId: bigint = writtenEvent.args[0];

  log(`✓ Option minted — tokenId: ${tokenId}`);
  log(`  Tx: ${writeReceipt.hash}`);

  // ── 5. Inspect position ───────────────────────────────────────────────────
  section("5. Inspect minted position");

  const pos = await vault.getPosition(tokenId);
  log(`tokenId:    ${pos.tokenId}`);
  log(`symbol:     ${pos.symbol}`);
  log(`type:       ${pos.optionType === 0n ? "CALL" : "PUT"}`);
  log(`strike:     $${fmt(pos.strikeWad)}`);
  log(`size:       ${fmt(pos.sizeWad)} HBAR`);
  log(`premium:    ${fmt(pos.premiumWad)} HBAR`);
  log(`expiry:     ${new Date(Number(pos.expiry) * 1000).toISOString()}`);
  log(`collateral: ${fmt(pos.collateralWad)} HBAR locked`);
  log(`settled:    ${pos.settled}`);
  log(`scheduleId: ${pos.scheduleId}`);

  const nftOwner = await nft.ownerOf(tokenId);
  log(`NFT owner:  ${nftOwner}`);

  // ── 6. Write a cash-secured HBAR put ─────────────────────────────────────
  section("6. Write cash-secured HBAR put option");

  // Fetch fresh VAA for put
  const { vaas: vaas2, price: rawPrice2, expo: expo2 } = await fetchPythVaa([HBAR_FEED_ID]);
  const spotWad2 = pythToWad(rawPrice2, expo2);

  // Strike = spot - 10% (OTM put)
  const putStrikeWad = spotWad2 * 90n / 100n;
  const putSizeWad   = ethers.parseEther("100");
  const putExpiry    = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);

  const [putPremiumWad] = await vault.quotePremium({
    symbol:     "HBAR",
    optionType: 1, // Put
    strikeWad:  putStrikeWad,
    expiry:     putExpiry,
    sizeWad:    putSizeWad,
    sigmaWad,
  });

  log(`Strike:   $${fmt(putStrikeWad)} (-10% OTM)`);
  log(`Premium:  ${fmt(putPremiumWad)} HBAR`);

  // For a put, collateral required = strike * size (cash-secured)
  // We need to deposit more HBAR to cover it
  const putCollateralNeeded = putStrikeWad * putSizeWad / ethers.parseEther("1");
  const currentCollateral   = await vault.availableCollateral(deployer.address, ethers.ZeroAddress);

  if (currentCollateral < putCollateralNeeded) {
    const topUp = putCollateralNeeded - currentCollateral + ethers.parseEther("5");
    const topUpTx = await vault.depositHBAR({ value: topUp, gasLimit: 2_000_000 });
    await topUpTx.wait();
    log(`Topped up collateral by ${fmt(topUp)} HBAR`);
  }

  const pythFee2    = await pythContract.getUpdateFee(vaas2);
  const putMsgValue = pythFee2 + putPremiumWad + ethers.parseEther("0.5");

  const putCalldata = vault.interface.encodeFunctionData("writeOption", [
    {
      symbol:          "HBAR",
      optionType:      1,
      strikeWad:       putStrikeWad,
      expiry:          putExpiry,
      sizeWad:         putSizeWad,
      sigmaWad,
      collateralToken: ethers.ZeroAddress,
      pythUpdateData:  vaas2,
    },
    putPremiumWad * 120n / 100n,
  ]);

  const putTxRaw = await deployer.sendTransaction({
    to:       addrs.OptionsVault,
    data:     putCalldata,
    value:    putMsgValue,
    gasLimit: 4_000_000,
  });

  const putReceipt = await putTxRaw.wait();
  if (!putReceipt) throw new Error("put writeOption tx failed");

  const putEvent = putReceipt.logs
    .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "OptionWritten");

  const putTokenId: bigint = putEvent!.args[0];
  log(`✓ Put minted — tokenId: ${putTokenId}`);
  log(`  Tx: ${putReceipt.hash}`);

  // ── 7. Exercise the call (ITM if spot > strike, else shows OTM path) ──────
  section("7. Exercise call option");

  const { vaas: vaas3, price: rawPrice3, expo: expo3 } = await fetchPythVaa([HBAR_FEED_ID]);
  const spotAtExercise = pythToWad(rawPrice3, expo3);

  log(`Spot at exercise: $${fmt(spotAtExercise)}`);
  log(`Call strike:      $${fmt(strikeWad)}`);
  log(`ITM: ${spotAtExercise > strikeWad ? "YES — payout expected" : "NO — OTM, payout = 0"}`);

  const pythFee3 = await pythContract.getUpdateFee(vaas3);

  const exerciseCalldata = vault.interface.encodeFunctionData("exercise", [tokenId, vaas3]);

  const exerciseTxRaw = await deployer.sendTransaction({
    to:       addrs.OptionsVault,
    data:     exerciseCalldata,
    value:    pythFee3 + ethers.parseEther("0.5"),
    gasLimit: 4_000_000,
  });

  const exerciseReceipt = await exerciseTxRaw.wait();
  if (!exerciseReceipt) throw new Error("exercise tx failed");

  const exercisedEvent = exerciseReceipt.logs
    .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "OptionExercised" || e?.name === "OptionExpired");

  if (exercisedEvent?.name === "OptionExercised") {
    log(`✓ Exercised — payout: ${fmt(exercisedEvent.args[3])} HBAR`);
  } else {
    log(`✓ Settled OTM — no payout (option expired worthless)`);
  }
  log(`  Tx: ${exerciseReceipt.hash}`);

  // ── 8. Withdraw residual collateral ───────────────────────────────────────
  section("8. Withdraw residual collateral");

  const residual = await vault.availableCollateral(deployer.address, ethers.ZeroAddress);
  log(`Available to withdraw: ${fmt(residual)} HBAR`);

  if (residual > 0n) {
    const withdrawTx = await vault.withdrawCollateral(
      ethers.ZeroAddress,
      residual,
      { gasLimit: 2_000_000 }
    );
    await withdrawTx.wait();
    log(`✓ Withdrew ${fmt(residual)} HBAR`);
  } else {
    log(`Nothing to withdraw (all collateral still locked in open put)`);
  }

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  log(`Final wallet balance: ${ethers.formatEther(finalBalance)} HBAR`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log(" Smoke Test Complete ✓");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Call tokenId:  ${tokenId}  (exercised)`);
  console.log(`  Put  tokenId:  ${putTokenId} (open — expires in 7 days)`);
  console.log();
  console.log("  Settlement (expireOption) skipped — requires Pyth");
  console.log("  price update at expiry timestamp via HIP-1215.");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nSmoke test failed:", err);
    process.exit(1);
  });
