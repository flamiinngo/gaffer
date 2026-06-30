/**
 * Builds the frontend data for the featured contest from GafferArena v2 (agents = NFTs):
 *  - onchain ranking (effective score) per agentId + each gaffer's decision read back from 0G
 *  - each agent's verifiable career (tier, wins, rounds, tradeable, listing price)
 * Writes leaderboard.json, proofs.json, gaffer-latest.json. Identity is the agentId (tokenId).
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
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo-v2.json"), "utf8"));
const featured = JSON.parse(readFileSync(join(here, "..", "frontend", "public", "featured.json"), "utf8"));

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const indexer = new Indexer(INDEXER_RPC);
const ABI = [
  "function getContest(uint256) view returns (uint256,string,uint256,uint256,uint256,uint256,bool,uint256,address,bool,string)",
  "function getParticipants(uint256) view returns (uint256[])",
  "function getEntry(uint256,uint256) view returns (bool,uint256,uint256,uint256,uint256,uint256)",
  "function getAgent(uint256) view returns (address,string,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256)",
  "function nextContestId() view returns (uint256)",
  "event PointsRecorded(uint256 indexed contestId, uint256 indexed agentId, uint256 indexed matchId, uint256 points, string decisionHash)",
];
const c = new ethers.Contract(dep.address, ABI, provider);
const TIERS = ["Rookie", "Pro", "Elite", "Legend"];

async function dl(root) {
  const tmp = join(tmpdir(), `lb-${Math.random().toString(36).slice(2)}.json`);
  const e = await indexer.download(root, tmp, true);
  if (e) return null;
  const data = JSON.parse(readFileSync(tmp, "utf8"));
  rmSync(tmp, { force: true });
  return data;
}

// Latest FULLY-POPULATED contest (highest id whose agent participants all recorded a decision).
const next = Number(await c.nextContestId());
let id = featured.contestId;
for (let i = next - 1; i >= 1; i--) {
  const meta = await c.getContest(i);
  if (meta[9]) continue; // skip PRIVATE contests (e.g. veterans' proving ground) — homepage stays on the public showcase
  const parts = await c.getParticipants(i);
  if (parts.length < 3) continue;
  const evs = await c.queryFilter(c.filters.PointsRecorded(i), 0, "latest");
  const scored = new Set(evs.map((e) => e.args.agentId.toString()));
  if (parts.every((p) => scored.has(p.toString()))) { id = i; break; }
}
console.log(`Latest populated contest: #${id}`);

const contest = await c.getContest(id);
const prizePoolOG = ethers.formatEther(contest[2]);
const participants = await c.getParticipants(id); // agentIds (bigint[])

// agentId -> { hash, tx, block } from the anchoring events
const logs = await c.queryFilter(c.filters.PointsRecorded(id), 0, "latest");
const decByAgent = new Map();
for (const l of logs) decByAgent.set(l.args.agentId.toString(), { hash: l.args.decisionHash, tx: l.transactionHash, block: l.blockNumber });

const rows = [];
let firstDecision = null;
for (const aid of participants) {
  const agentId = Number(aid);
  const e = await c.getEntry(id, aid);     // [active, points, overrideCount, multiplier, effective, entryTime]
  const ag = await c.getAgent(aid);        // [owner, configHash, contestsEntered, roundsScored, totalPoints, totalEffective, wins, overrideCount, tier, tradeable, price]
  const ev = decByAgent.get(aid.toString()) ?? {};
  const root = (ev.hash ?? "").replace(/^0g:\/\//, "");
  const decision = root ? await dl(root).catch(() => null) : null;
  if (decision && !firstDecision) firstDecision = decision;
  rows.push({
    agentId,
    owner: ag[0],
    name: decision?.managerName ?? "Unknown gaffer",
    captain: decision?.captain ?? "—",
    reasoning: decision?.reasoning ?? "",
    model: decision?.model ?? "0G Compute",
    formation: decision?.formation ?? "4-3-3",
    xi: decision?.xi ?? [],
    bench: decision?.bench ?? [],
    squadValue: decision?.squadValue ?? null,
    budget: decision?.budget ?? null,
    inTheBank: decision?.inTheBank ?? null,
    gamesPlayed: decision?.gamesPlayed ?? null,
    gamesTotal: decision?.gamesTotal ?? null,
    numTeams: decision?.numTeams ?? null,
    maxPerNation: decision?.maxPerNation ?? null,
    points: Number(e[1]),
    overrideCount: Number(e[2]),
    multiplier: Number(e[3]) / 100,
    effectiveScore: Number(e[4]),
    // verifiable career (drives level + marketplace value)
    career: {
      tier: Number(ag[8]),
      tierName: TIERS[Number(ag[8])] ?? "Rookie",
      contestsEntered: Number(ag[2]),
      roundsScored: Number(ag[3]),
      careerPoints: Number(ag[4]),
      careerEffective: Number(ag[5]),
      wins: Number(ag[6]),
      eligible: ag[9],
      minted: ag[10],
      priceWei: ag[11].toString(),
      priceOG: ethers.formatEther(ag[11]),
    },
    configHash: (ag[1] ?? "").replace(/^0g:\/\//, ""),
    decisionRoot: root,
    tx: ev.tx ?? null,
    block: ev.block ? Number(ev.block) : null,
  });
}
rows.sort((a, b) => b.effectiveScore - a.effectiveScore);
rows.forEach((r, i) => (r.rank = i + 1));

const matchName = contest[1] || featured.match;
const matchId = firstDecision?.matchId ?? featured.matchId;
const scoreLabel = firstDecision?.score ?? featured.score;
writeFileSync(
  join(here, "..", "frontend", "public", "featured.json"),
  JSON.stringify({ contestId: id, matchId, match: matchName, score: scoreLabel }, null, 2)
);

const king = rows[0] ? { ...rows[0], match: matchName, score: scoreLabel } : null;

const out = {
  contestId: id,
  match: matchName,
  score: scoreLabel,
  prizePoolOG,
  participants: participants.length,
  rows: rows.map(({ xi, bench, ...r }) => r),
  king,
  updatedAt: new Date().toISOString(),
};
writeFileSync(join(here, "..", "frontend", "public", "leaderboard.json"), JSON.stringify(out, null, 2));

const proofs = {
  contestId: id,
  contractAddress: dep.address,
  match: matchName,
  matchId,
  score: scoreLabel,
  agents: rows.map((r) => ({
    rank: r.rank,
    agentId: r.agentId,
    owner: r.owner,
    name: r.name,
    formation: r.formation,
    captain: r.captain,
    reasoning: r.reasoning,
    model: r.model,
    xi: r.xi,
    bench: r.bench,
    squadValue: r.squadValue,
    budget: r.budget,
    inTheBank: r.inTheBank,
    gamesPlayed: r.gamesPlayed,
    gamesTotal: r.gamesTotal,
    numTeams: r.numTeams,
    maxPerNation: r.maxPerNation,
    points: r.points,
    overrideCount: r.overrideCount,
    multiplier: r.multiplier,
    effectiveScore: r.effectiveScore,
    career: r.career,
    layers: {
      compute: { model: r.model, provider: "0G Compute Network" },
      storage: { decisionRoot: r.decisionRoot, configHash: r.configHash },
      chain: { tx: r.tx, block: r.block, contract: dep.address },
      da: { anchored: Boolean(r.tx) },
    },
  })),
  updatedAt: new Date().toISOString(),
};
writeFileSync(join(here, "..", "frontend", "public", "proofs.json"), JSON.stringify(proofs, null, 2));

if (king) {
  const snapshot = {
    agentId: king.agentId,
    managerName: king.name,
    match: `Matchday ${matchId}`,
    score: scoreLabel,
    formation: king.formation ?? "4-3-3",
    captain: king.captain,
    reasoning: king.reasoning,
    xi: king.xi,
    bench: king.bench ?? [],
    squadValue: king.squadValue,
    budget: king.budget,
    inTheBank: king.inTheBank,
    totalPoints: king.points,
    model: king.model,
    contestId: id,
    decisionRoot: king.decisionRoot,
    career: king.career,
    onchain: { totalPoints: king.points, overrideCount: king.overrideCount, multiplier: king.multiplier, effectiveScore: king.effectiveScore },
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(join(here, "..", "frontend", "public", "gaffer-latest.json"), JSON.stringify(snapshot, null, 2));
  console.log("wrote gaffer-latest.json (King:", king.name + ")");
}
console.log(`✅ leaderboard.json — ${rows.length} gaffers, king: ${king?.name} (${king?.effectiveScore} eff)`);
