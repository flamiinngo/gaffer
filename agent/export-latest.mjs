/**
 * Reads the latest gaffer decision BACK from 0G Storage + onchain state,
 * and writes a dashboard-ready snapshot to frontend/public/gaffer-latest.json.
 * Proves the 0G read path and feeds the live UI.
 */
import { ethers } from "ethers";
import { Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const EVM_RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo.json"), "utf8"));
const last = JSON.parse(readFileSync(join(here, "last-cycle.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const wallet = new ethers.Wallet(pk, provider);
const indexer = new Indexer(INDEXER_RPC);
const contract = new ethers.Contract(
  dep.address,
  ["function getManager(uint256,address) view returns (string,uint256,uint256,uint256,uint256,uint256,bool)"],
  provider
);

// 1. download the decision back from 0G
console.log(`Downloading decision ${last.decisionRoot} from 0G…`);
const tmp = join(tmpdir(), `gaffer-${Date.now()}.json`);
const derr = await indexer.download(last.decisionRoot, tmp, true);
if (derr) throw derr;
const decision = JSON.parse(readFileSync(tmp, "utf8"));
rmSync(tmp, { force: true });
console.log(`✅ Read back from 0G. Captain: ${decision.captain}, ${decision.totalPoints} pts`);

// 2. read onchain manager state
const m = await contract.getManager(last.contestId, wallet.address);
const onchain = {
  totalPoints: Number(m[1]),
  overrideCount: Number(m[2]),
  multiplier: Number(m[3]) / 100,
  effectiveScore: Number(m[4]),
};
console.log(`Onchain: ${onchain.totalPoints} pts · ${onchain.multiplier}x · eff ${onchain.effectiveScore}`);

// 3. write dashboard snapshot
const snapshot = {
  ...decision,
  contestId: last.contestId,
  decisionRoot: last.decisionRoot,
  configRoot: last.configRoot,
  contract: dep.address,
  onchain,
  updatedAt: new Date().toISOString(),
};
const outPath = join(here, "..", "frontend", "public", "gaffer-latest.json");
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log(`✅ Wrote ${outPath}`);
