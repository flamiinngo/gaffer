/**
 * GAFFER — full autonomous cycle on real WC2026 data + 0G (testnet).
 *
 *   pick XI (0G Compute) → store decision (0G Storage) → score (real stats)
 *   → record onchain (decision root hash = verifiable proof)
 *
 * Produces a real PointsRecorded event the Verify page reads, and a 0G-stored
 * decision the dashboard renders.
 */
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- config ----------
const EVM_RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
const HOST = process.env.SPORTAPI_HOST || "sportapi7.p.rapidapi.com";
const KEYS = [process.env.SPORTAPI_KEY, process.env.SPORTAPI_KEY_2, process.env.SPORTAPI_KEY_3, process.env.SPORTAPI_KEY_4, process.env.SPORTAPI_KEY_5].filter(Boolean);
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const wallet = new ethers.Wallet(pk, provider);
const indexer = new Indexer(INDEXER_RPC);

const ABI = [
  "function nextContestId() view returns (uint256)",
  "function createContest(string,uint256,uint256,uint256) returns (uint256)",
  "function enterContest(uint256,string) payable",
  "function recordPoints(uint256,address,uint256,uint256,string)",
  "function getManager(uint256,address) view returns (string,uint256,uint256,uint256,uint256,uint256,bool)",
];
const contract = new ethers.Contract(dep.address, ABI, wallet);

// ---------- helpers ----------
async function sofa(path) {
  for (const key of KEYS) {
    const res = await fetch(`https://${HOST}${path}`, { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": key } });
    if (res.status === 429 || res.status === 403) continue;
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return res.json();
  }
  throw new Error("all SofaScore keys exhausted");
}
const flagOf = (a2) => (!a2 || a2.length !== 2 ? "⚽" : String.fromCodePoint(...[...a2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))));
const POS = (p) => (p === "G" ? "GK" : p === "D" ? "DEF" : p === "M" ? "MID" : "FWD");
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function sendAndWait(txPromise, label) {
  const tx = await txPromise;
  console.log(`   ${label} → ${tx.hash}`);
  for (let i = 0; i < 40; i++) {
    try { const r = await provider.getTransactionReceipt(tx.hash); if (r) return r; } catch {}
    await delay(2000);
  }
  throw new Error(`${label}: no receipt after timeout`);
}

async function storeJSON(obj, label) {
  const file = new MemData(new TextEncoder().encode(JSON.stringify(obj)));
  const [tree, terr] = await file.merkleTree();
  if (terr) throw terr;
  const root = tree.rootHash();
  const [, uerr] = await indexer.upload(file, EVM_RPC, wallet);
  if (uerr) throw uerr;
  console.log(`   ${label} stored on 0G → ${root}`);
  return root;
}

// FPL scoring
function fplPoints(s, pos, conceded, isCaptain = false) {
  let pts = 0;
  const mins = s.minutesPlayed ?? 0;
  if (mins > 0) pts += 1;
  if (mins >= 60) pts += 1;
  const gp = pos === "GK" || pos === "DEF" ? 6 : pos === "MID" ? 5 : 4;
  pts += (s.goals ?? 0) * gp + (s.goalAssist ?? 0) * 3;
  if (mins >= 60 && conceded === 0) pts += pos === "GK" || pos === "DEF" ? 4 : pos === "MID" ? 1 : 0;
  if (pos === "GK" || pos === "DEF") pts -= Math.floor(conceded / 2);
  if (pos === "GK") pts += Math.floor((s.saves ?? 0) / 3);
  if (s.yellowCard) pts -= 1;
  if (s.redCard) pts -= 3;
  if (s.ownGoals) pts -= 2 * s.ownGoals;
  return isCaptain ? pts * 2 : pts;
}

// 0G Compute: pick an XI, validated to exactly 1-4-3-3
async function pickXI(broker, pool, match) {
  const services = await broker.inference.listService();
  const chat = services.find((s) => s.serviceType === "chatbot");
  if (!chat) throw new Error("no chatbot provider");
  console.log(`   brain: ${chat.model}`);
  try { await broker.inference.acknowledgeProviderSigner(chat.provider); } catch {}
  const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);

  const sys = "You are GAFFER, an elite autonomous AI football manager with an attacking bias. Pick a valid 4-3-3 (1 GK, 4 DEF, 3 MID, 3 FWD) using ONLY the provided pool. Captain your most explosive attacker.";
  const poolText = pool.map((p) => `${p.name} | ${p.pos} | ${p.team}`).join("\n");
  const user = `Match: ${match}.\nPOOL (name | pos | team):\n${poolText}\n\nReturn ONLY JSON: {"captain":"","reasoning":"<2 sentences>","xi":[{"name":"","pos":""}]} with exactly 1 GK,4 DEF,3 MID,3 FWD.`;

  let content = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = await broker.inference.getRequestHeaders(chat.provider, user);
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ model, temperature: 0.5, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
      });
      if (!res.ok) { await delay(2500); continue; }
      content = (await res.json()).choices?.[0]?.message?.content ?? "";
      if (content) break;
    } catch { await delay(2500); }
  }
  const m = content.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : { xi: [], captain: "", reasoning: "" };

  // Validate + repair to exactly 1-4-3-3 from the real pool
  const need = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
  const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
  const used = new Set();
  const findInPool = (name) => pool.find((p) => norm(p.name) === norm(name));
  for (const pick of parsed.xi ?? []) {
    const pl = findInPool(pick.name || "");
    if (!pl || used.has(pl.name)) continue;
    if (byPos[pl.pos].length < need[pl.pos]) { byPos[pl.pos].push(pl); used.add(pl.name); }
  }
  for (const pos of Object.keys(need)) {
    for (const p of pool.filter((x) => x.pos === pos && !used.has(x.name))) {
      if (byPos[pos].length >= need[pos]) break;
      byPos[pos].push(p); used.add(p.name);
    }
  }
  const xi = [...byPos.GK, ...byPos.DEF, ...byPos.MID, ...byPos.FWD];
  let captain = parsed.captain && findInPool(parsed.captain) && used.has(findInPool(parsed.captain).name) ? findInPool(parsed.captain).name : byPos.FWD[0]?.name;
  return { xi, captain, reasoning: parsed.reasoning || "Attacking 4-3-3 built from the in-form pool.", model: chat.model };
}

// ---------- main ----------
console.log(`\n🤖 GAFFER cycle — wallet ${wallet.address}`);
console.log(`   balance ${ethers.formatEther(await provider.getBalance(wallet.address))} OG`);

// 1. pick a finished WC match (most goals = most interesting)
const { events } = await sofa(`/api/v1/sport/football/scheduled-events/2026-06-22`);
const finished = events.filter((e) => e.tournament?.name?.startsWith("FIFA World Cup") && e.status?.type === "finished");
finished.sort((a, b) => ((b.homeScore?.current ?? 0) + (b.awayScore?.current ?? 0)) - ((a.homeScore?.current ?? 0) + (a.awayScore?.current ?? 0)));
const game = finished[0];
const hs = game.homeScore?.current ?? 0, as = game.awayScore?.current ?? 0;
const home = { name: game.homeTeam.name, flag: flagOf(game.homeTeam.country?.alpha2), id: game.homeTeam.id };
const away = { name: game.awayTeam.name, flag: flagOf(game.awayTeam.country?.alpha2), id: game.awayTeam.id };
console.log(`\n⚽ ${home.flag} ${home.name} ${hs}-${as} ${away.name} ${away.flag}  (match ${game.id})`);

// 2. build real player pool
const pool = [];
for (const t of [home, away]) {
  const { players } = await sofa(`/api/v1/team/${t.id}/players`);
  for (const p of players) if (p.player?.name && p.player?.position) pool.push({ name: p.player.name, pos: POS(p.player.position), team: t.name, flag: t.flag });
}
console.log(`   pool: ${pool.length} players`);

// 3. brain
const broker = await createZGComputeNetworkBroker(wallet);
try { await broker.ledger.getLedger(); } catch { await broker.ledger.addLedger(3); }
console.log(`\n🧠 thinking on 0G Compute…`);
const { xi, captain, reasoning, model } = await pickXI(broker, pool, `${home.name} vs ${away.name}`);
console.log(`   XI ready · captain ${captain}`);

// 4. score from real stats
const lu = await sofa(`/api/v1/event/${game.id}/lineups`);
const statsByName = new Map();
for (const side of ["home", "away"]) for (const p of lu[side]?.players ?? []) statsByName.set(norm(p.player.name), p.statistics ?? {});
let total = 0;
const xiScored = xi.map((p) => {
  const conceded = p.team === home.name ? as : hs;
  const st = statsByName.get(norm(p.name)) ?? {};
  const pts = fplPoints(st, p.pos, conceded, p.name === captain);
  total += pts;
  return { ...p, points: pts, captain: p.name === captain };
});
console.log(`   total points: ${total}`);

// 5. store config + decision on 0G
console.log(`\n💾 0G Storage…`);
const configRoot = await storeJSON({ name: "The Catenaccio Kid", strategy: "attacking 4-3-3", philosophy: "back the in-form, captain the explosive", owner: wallet.address }, "config");
const decision = { manager: wallet.address, managerName: "The Catenaccio Kid", matchId: game.id, match: `${home.name} vs ${away.name}`, home, away, score: `${hs}-${as}`, formation: "4-3-3", captain, reasoning, xi: xiScored, totalPoints: total, model, ts: new Date().toISOString() };
const decisionRoot = await storeJSON(decision, "decision");

// 6. onchain: create contest (open), enter, record points with the 0G proof hash
console.log(`\n⛓️  onchain…`);
const contestId = Number(await contract.nextContestId());
const now = Math.floor(Date.now() / 1000);
await sendAndWait(contract.createContest(`World Cup 2026 — Live ${game.id}`, 0n, now + 3600, now + 30 * 86400), `createContest #${contestId}`);
await sendAndWait(contract.enterContest(contestId, `0g://${configRoot}`, { value: 0 }), "enterContest");
await sendAndWait(contract.recordPoints(contestId, wallet.address, game.id, total, `0g://${decisionRoot}`), "recordPoints");
const mgr = await contract.getManager(contestId, wallet.address);
console.log(`   onchain points: ${mgr[1]}  multiplier: ${Number(mgr[3]) / 100}x  effective: ${mgr[4]}`);

// 7. summary + drop a pointer the frontend can read
const out = { contestId, matchId: game.id, decisionRoot, configRoot, totalPoints: total, explorer: `https://chainscan-galileo.0g.ai/address/${dep.address}` };
writeFileSync(join(here, "last-cycle.json"), JSON.stringify(out, null, 2));
console.log(`\n✅ CYCLE COMPLETE`);
console.log(`   contest #${contestId} · ${total} pts · decision 0g://${decisionRoot}`);
console.log(`   ${out.explorer}`);
