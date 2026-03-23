import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY || "0x" + "0".repeat(64);
const TESTNET_OPERATOR_PRIVATE_KEY =
  process.env.TESTNET_OPERATOR_PRIVATE_KEY || "0x" + "0".repeat(64);

// ── Forking configuration ────────────────────────────────────────────────────
// Set ENABLE_FORKING=true and FORK_RPC_URL in .env to fork a live network.
// Optionally set FORK_BLOCK_NUMBER to pin a specific block.
//
// Examples:
//   ENABLE_FORKING=true FORK_RPC_URL=https://testnet.hashio.io/api          (Hedera testnet)
//   ENABLE_FORKING=true FORK_RPC_URL=https://mainnet.hashio.io/api          (Hedera mainnet)
//   ENABLE_FORKING=true FORK_RPC_URL=https://mainnet.infura.io/v3/<key>     (Ethereum mainnet)

const enableForking = process.env.ENABLE_FORKING === "true";
const forkRpcUrl    = process.env.FORK_RPC_URL;
const forkBlock     = process.env.FORK_BLOCK_NUMBER ? parseInt(process.env.FORK_BLOCK_NUMBER) : undefined;

if (enableForking && !forkRpcUrl) {
  throw new Error("FORK_RPC_URL must be set when ENABLE_FORKING=true");
}

console.log("Network mode:", enableForking ? `Forking ${forkRpcUrl}${forkBlock ? ` @ block ${forkBlock}` : ""}` : "Pure Hardhat");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
       metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 800,
      },
      viaIR: true,
      evmVersion: "paris", // Hedera EVM supports up to Paris (London hardfork); cancun opcodes not available
    },
  },
  networks: {
    // Hedera Testnet (public JSON-RPC relay)
    testnet: {
      url: process.env.HEDERA_TESTNET_RPC || "https://testnet.hashio.io/api",
      accounts: [TESTNET_OPERATOR_PRIVATE_KEY],
      chainId: 296,
      gas: 15_000_000,
      gasPrice: 2_000_000_000_000, // 2000 gwei — required for large contract deployment on Hedera
      timeout: 120_000,
    },
    // Hedera Mainnet
    mainnet: {
      url: process.env.HEDERA_MAINNET_RPC || "https://mainnet.hashio.io/api",
      accounts: [OPERATOR_PRIVATE_KEY],
      chainId: 295,
      gas: 10_000_000,
      gasPrice: 700_000_000_000, // 700 gwei
      timeout: 60_000,
    },
    // Local Hedera mirror node (e.g., hedera-local-node)
    local: {
      url: "http://localhost:7546",
      accounts: [OPERATOR_PRIVATE_KEY],
      chainId: 298,
    },
    hardhat: {
      chainId: 31337,
      forking: enableForking
        ? {
            url: forkRpcUrl!,
            blockNumber: forkBlock,
            enabled: true,
          }
        : undefined,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  mocha: {
    timeout: 120_000,
  },
};

export default config;
