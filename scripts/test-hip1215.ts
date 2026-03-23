/**
 * HIP-1215 Auto-Expiry Test
 *
 * Creates an option with a SHORT expiry (5-10 minutes) to test
 * whether Hedera's Schedule Service auto-executes expireOption().
 *
 * Usage:
 *   npx hardhat run scripts/test-hip1215.ts --network testnet
 */

import { ethers } from "hardhat";
import { join } from "path";
import { readFileSync } from "fs";
import { OptionsVault__factory } from "../typechain-types";

const HERMES_URL = "https://hermes.pyth.network";
const HBAR_FEED_ID = "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd";

async function fetchPythVaa(): Promise<{ vaas: string[]; spotWad: bigint }> {
  const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${HBAR_FEED_ID}&encoding=hex`;
  const res = await fetch(url);
  const json = await res.json() as {
    binary: { data: string[] };
    parsed: { price: { price: string; expo: number } }[];
  };

  const vaas = json.binary.data.map((d: string) => "0x" + d);
  const price = BigInt(json.parsed[0]!.price.price);
  const expo = json.parsed[0]!.price.expo;
  const spotWad = expo >= 0
    ? price * BigInt(10 ** expo) * BigInt(1e18)
    : price * BigInt(1e18) / BigInt(10 ** (-expo));

  return { vaas, spotWad };
}

function loadDeployment(chainId: number): { OptionsVault: string } {
  const path = join(__dirname, `../deployments/${chainId}.json`);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return raw.contracts;
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const addrs = loadDeployment(chainId);

  console.log("═══════════════════════════════════════════════════");
  console.log(" HIP-1215 Auto-Expiry Test");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Network:  testnet (chainId: ${chainId})`);
  console.log(`Signer:   ${deployer.address}`);
  console.log(`Vault:    ${addrs.OptionsVault}`);
  console.log();

  const vault = OptionsVault__factory.connect(addrs.OptionsVault, deployer);

  // 1. Fetch Pyth price
  console.log("1. Fetching live HBAR price...");
  const { vaas, spotWad } = await fetchPythVaa();
  console.log(`   Spot: $${(Number(spotWad) / 1e18).toFixed(6)}`);

  // 2. Deposit collateral
  console.log("\n2. Depositing 20 HBAR collateral...");
  const depositTx = await vault.depositHBAR({ value: ethers.parseEther("20"), gasLimit: 100_000 });
  await depositTx.wait();
  console.log("   Done.");

  // 3. Write option with SHORT expiry (contract requires MIN 1 hour)
  const EXPIRY_MINUTES = 65; // 1 hour + 5 min buffer (contract MIN_EXPIRY_SECS = 1 hour)
  const expiry = BigInt(Math.floor(Date.now() / 1000) + EXPIRY_MINUTES * 60);
  const expiryDate = new Date(Number(expiry) * 1000);

  console.log(`\n3. Writing HBAR CALL with ${EXPIRY_MINUTES}-minute expiry...`);
  console.log(`   Expiry: ${expiryDate.toISOString()}`);

  const strikeWad = spotWad * 110n / 100n; // 10% OTM
  const sizeWad = ethers.parseEther("50");
  const sigmaWad = ethers.parseEther("0.80");

  const pythAddr = await vault.pyth();
  const pythContract = await ethers.getContractAt("IPyth", pythAddr, deployer);
  const pythFee = await pythContract.getUpdateFee(vaas);

  // Quote premium first (required for msg.value)
  const [premiumWad] = await vault.quotePremium({
    symbol: "HBAR",
    optionType: 0,
    strikeWad,
    expiry,
    sizeWad,
    sigmaWad,
  });
  console.log(`   Premium: ${Number(premiumWad) / 1e18} HBAR`);

  const writeCalldata = vault.interface.encodeFunctionData("writeOption", [
    {
      symbol: "HBAR",
      optionType: 0, // Call
      strikeWad,
      expiry,
      sizeWad,
      sigmaWad,
      collateralToken: ethers.ZeroAddress,
      pythUpdateData: vaas,
    },
    premiumWad * 120n / 100n, // maxPremium with 20% slippage
  ]);

  // Value = pythFee + premium + buffer (same as smoke-test)
  const msgValue = pythFee + premiumWad + ethers.parseEther("0.5");

  const writeTx = await deployer.sendTransaction({
    to: addrs.OptionsVault,
    data: writeCalldata,
    value: msgValue,
    gasLimit: 4_000_000,
  });
  const writeReceipt = await writeTx.wait();

  // Parse tokenId from event
  const writtenEvent = writeReceipt!.logs
    .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "OptionWritten");

  const tokenId = writtenEvent!.args[0];
  console.log(`   Option minted: tokenId = ${tokenId}`);

  // 4. Check schedule ID
  const pos = await vault.getPosition(tokenId);
  const scheduleId = pos.scheduleId;

  console.log(`\n4. HIP-1215 Schedule Status:`);
  if (scheduleId === ethers.ZeroAddress) {
    console.log("   ⚠️  Schedule ID = 0x0 (HSS precompile not available)");
    console.log("   → Manual expiry via expireOption() will be needed.");
    console.log("   → This is expected on Hardhat/local networks.");
  } else {
    console.log(`   ✅ Schedule ID: ${scheduleId}`);
    console.log(`   → Hedera will auto-execute expireOption(${tokenId}) at ${expiryDate.toISOString()}`);
    console.log(`   → Monitor: https://hashscan.io/testnet/schedule/${scheduleId}`);
  }

  // 5. Instructions for verifying
  console.log("\n═══════════════════════════════════════════════════");
  console.log(" Verification Steps");
  console.log("═══════════════════════════════════════════════════");
  console.log(`\n1. Wait until ${expiryDate.toISOString()} (~${EXPIRY_MINUTES} mins)`);
  console.log(`\n2. Check if option was auto-settled:`);
  console.log(`   npx hardhat console --network testnet`);
  console.log(`   > const vault = await ethers.getContractAt("OptionsVault", "${addrs.OptionsVault}")`);
  console.log(`   > const pos = await vault.getPosition(${tokenId})`);
  console.log(`   > pos.settled  // Should be true if HIP-1215 worked`);

  console.log(`\n3. If not auto-settled, manually expire (owner only):`);
  console.log(`   > await vault.expireOption(${tokenId})`);

  console.log(`\n4. Check HashScan for transaction:`);
  console.log(`   https://hashscan.io/testnet/account/${addrs.OptionsVault}`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log(` Option #${tokenId} created. Expires at ${expiryDate.toLocaleTimeString()}`);
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
