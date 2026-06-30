import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

dotenv.config();

// Prefer an explicit PRIVATE_KEY env var; otherwise fall back to the generated
// throwaway testnet wallet at repo root (.deployer-wallet.json).
function loadDeployerKey(): string | undefined {
  if (process.env.PRIVATE_KEY) return process.env.PRIVATE_KEY;
  const walletPath = resolve(__dirname, "..", ".deployer-wallet.json");
  if (existsSync(walletPath)) {
    try {
      return JSON.parse(readFileSync(walletPath, "utf8")).privateKey;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const deployerKey = loadDeployerKey();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true, // needed for GafferArena's multi-field views (stack-too-deep); stays paris-safe
      evmVersion: "paris", // 0G Galileo is pre-Cancun-opcode safe with paris
    },
  },
  networks: {
    galileo: {
      url: process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
};

export default config;
