/**
 * Builds frontend/public/leaderboard.json for the featured contest:
 * onchain ranking (points × multiplier) + each gaffer's decision read back from 0G
 * (name, captain, reasoning, XI). Fast + reliable for the homepage; links prove it onchain.
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
const featured = JSON.parse(readFileSync(join(here, "..", "frontend", "public", "featured.json"), "utf8"));

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const indexer = new Indexer(INDEXER_RPC);
const ABI = [
  "function getContest(uint256) view returns (uint256,string,uint256,uint256,uint256,uint256,bool,uint256)",
  "function getParticipants(uint256) view returns (address[])",
  "function getManager(uint256,address) view returns (string,uint256,uint256,uint256,uint256,uint256,bool)",
  "event PointsRecorded(uint256 indexed contestId, address indexed owner, uint256 indexed matchId, uint256 points, string decisionHash)",
];
const c = new ethers.Contract(dep.address, ABI, provider);
const id = featured.contestId;

async function dl(root) {
  const tmp = join(tmpdir(), `lb-${Math.random().toString(36).slice(2)}.json`);
  const e = await indexer.download(root, tmp, true);
  if (e) return null;
  const data = JSON.parse(readFileSync(tmp, "utf8"));
  rmSync(tmp, { force: true });
  return data;
}

const contest = await c.getContest(id);
const prizePoolOG = ethers.formatEther(contest[2]);
const participants = await c.getParticipants(id);

// map owner -> decisionHash from events
const logs = await c.queryFilter(c.filters.PointsRecorded(id), 0, "latest");
const decByOwner = new Map();
for (const l of logs) decByOwner.set(l.args.owner.toLowerCase(), l.args.decisionHash);

const rows = [];
for (const addr of participants) {
  const m = await c.getManager(id, addr);
  const root = (decByOwner.get(addr.toLowerCase()) ?? "").replace(/^0g:\/\//, "");
  const decision = root ? await dl(root).catch(() => null) : null;
  rows.push({
    address: addr,
    name: decision?.managerName ?? "Unknown gaffer",
    captain: decision?.captain ?? "—",
    reasoning: decision?.reasoning ?? "",
    xi: decision?.xi ?? [],
    points: Number(m[1]),
    overrideCount: Number(m[2]),
    multiplier: Number(m[3]) / 100,
    effectiveScore: Number(m[4]),
    decisionRoot: root,
  });
}
rows.sort((a, b) => b.effectiveScore - a.effectiveScore);
rows.forEach((r, i) => (r.rank = i + 1));

const king = rows[0]
  ? { ...rows[0], match: featured.match, score: featured.score }
  : null;

const out = {
  contestId: id,
  match: featured.match,
  score: featured.score,
  prizePoolOG,
  participants: participants.length,
  rows: rows.map(({ xi, ...r }) => r), // leaderboard rows without full XI
  king, // full king incl XI + reasoning
  updatedAt: new Date().toISOString(),
};
writeFileSync(join(here, "..", "frontend", "public", "leaderboard.json"), JSON.stringify(out, null, 2));
console.log(`✅ leaderboard.json — ${rows.length} gaffers, king: ${king?.name} (${king?.effectiveScore} eff)`);
