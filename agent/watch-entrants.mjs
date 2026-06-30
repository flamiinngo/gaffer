/**
 * Watches the live contest and auto-picks any newly-deployed gaffer within seconds — so deploy →
 * pick happens on its own, no manual run. Cheap: every tick it only does two onchain reads
 * (participants + the PointsRecorded log); it only fires the heavy 0G-Compute pick when a brand-new
 * entrant actually shows up. Run locally during testing (`node watch-entrants.mjs`) or as a small
 * always-on service in production.
 */
import { ethers } from "ethers";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const EVM_RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo-v2.json"), "utf8"));
const featured = JSON.parse(readFileSync(join(here, "..", "frontend", "public", "featured.json"), "utf8"));
const INTERVAL = Number(process.env.WATCH_INTERVAL || 45) * 1000;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const ABI = [
  "function nextContestId() view returns (uint256)",
  "function getParticipants(uint256) view returns (uint256[])",
  "event PointsRecorded(uint256 indexed contestId, uint256 indexed agentId, uint256 indexed matchId, uint256 points, string decisionHash)",
];
const c = new ethers.Contract(dep.address, ABI, provider);

const contestId = featured.contestId ?? (Number(await c.nextContestId()) - 1);
console.log(`👀 Watching contest #${contestId} — new gaffers auto-pick within ~${INTERVAL / 1000}s. Ctrl+C to stop.`);

for (;;) {
  try {
    const parts = (await c.getParticipants(contestId)).map(Number);
    const evs = await c.queryFilter(c.filters.PointsRecorded(contestId), 0, "latest");
    const scored = new Set(evs.map((e) => Number(e.args.agentId)));
    const unpicked = parts.filter((a) => !scored.has(a));
    if (unpicked.length) {
      console.log(`\n⚡ new gaffer(s) ${unpicked.join(", ")} — picking on 0G Compute…`);
      execFileSync("node", ["score-entrants.mjs"], { stdio: "inherit", cwd: here });
      execFileSync("node", ["export-leaderboard.mjs"], { stdio: "inherit", cwd: here });
      console.log("✓ done — UI refreshed.\n");
    } else {
      process.stdout.write(".");
    }
  } catch (e) {
    console.log("watch tick error:", e.message);
  }
  await delay(INTERVAL);
}
