/**
 * Seeds a small stable of VETERAN agents with a REAL multi-round career, so the mint→list→buy
 * marketplace is demoable while the live tournament is only one knockout round in.
 *
 * How it stays honest: each veteran actually plays the THREE World Cup group-stage matchdays that
 * were already played (rounds 1–3, real fixtures + real results, real AI picks on 0G Compute,
 * scored with the same FPL engine). After 3 scored rounds it clears the experience threshold, so
 * we mint it into a tradeable NFT and list a couple on the marketplace. Their proving-ground
 * contest is PRIVATE, so the public homepage stays on the live Round of 32.
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

const EVM_RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
const HOST = process.env.SPORTAPI_HOST || "sportapi7.p.rapidapi.com";
const KEYS = [process.env.SPORTAPI_KEY].filter(Boolean);
const TOUR = process.env.WC_TOURNAMENT_ID || "16";
const SEASON = process.env.WC_SEASON_ID || "58210";
const DRY = !!process.env.DRY_RUN;
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo-v2.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const admin = new ethers.Wallet(pk, provider);
const indexer = new Indexer(INDEXER_RPC);
const ABI = [
  "function nextContestId() view returns (uint256)",
  "function nextAgentId() view returns (uint256)",
  "function createAgent(string) returns (uint256)",
  "function mintAgent(uint256)",
  "function listAgent(uint256,uint256)",
  "function isEligible(uint256) view returns (bool)",
  "function getAgent(uint256) view returns (address,string,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256)",
  "function createContest(string,uint256,uint256,uint256,bool,string) returns (uint256)",
  "function enterContest(uint256,uint256) payable",
  "function recordPoints(uint256,uint256,uint256,uint256,string)",
  "function recordOverride(uint256,uint256)",
];
const adminContract = new ethers.Contract(dep.address, ABI, admin);
const TIERS = ["Rookie", "Pro", "Elite", "Legend"];

// Distinct veterans (different from the live showcase gaffers). `price` => listed on the market.
const VETERANS = [
  { name: "El Profesor", strat: "cerebral possession football: technically elite midfielders and creators from nations that dominate the ball; controls games through the middle. Balanced 4-3-3.", overrides: 0, price: "0.6" },
  { name: "The Alchemist", strat: "value differentials: unfashionable, underpriced players from dark-horse nations with a high points-per-million; turns base metal into gold. Bold 3-4-3.", overrides: 1, price: "0.9" },
  { name: "Iron Curtain", strat: "defensive fortress: the meanest defences and a world-class keeper, grinding out clean sheets. Disciplined 5-3-2.", overrides: 0, price: null }, // held, not listed
];

async function sofa(path) {
  for (const key of KEYS) {
    const res = await fetch(`https://${HOST}${path}`, { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": key } });
    if (res.status === 429 || res.status === 403) continue;
    if (res.ok) return res.json();
  }
  throw new Error("all keys exhausted/limited");
}
const flagOf = (a2) => (!a2 || a2.length !== 2 ? "⚽" : String.fromCodePoint(...[...a2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))));
const POS = (p) => (p === "G" ? "GK" : p === "D" ? "DEF" : p === "M" ? "MID" : p === "F" ? "FWD" : null);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
async function wait(hash, label) { for (let i = 0; i < 40; i++) { try { const r = await provider.getTransactionReceipt(hash); if (r) return r; } catch {} await delay(2000); } throw new Error(`${label}: no receipt`); }
async function storeJSON(obj) { const f = new MemData(new TextEncoder().encode(JSON.stringify(obj))); const [t, e] = await f.merkleTree(); if (e) throw e; const [, ue] = await indexer.upload(f, EVM_RPC, admin); if (ue) throw ue; return t.rootHash(); }
function fpl(s, pos, conceded, cap) {
  let p = 0; const m = s.minutesPlayed ?? 0;
  if (m > 0) p += 1; if (m >= 60) p += 1;
  p += (s.goals ?? 0) * (pos === "GK" || pos === "DEF" ? 6 : pos === "MID" ? 5 : 4) + (s.goalAssist ?? 0) * 3;
  if (m >= 60 && conceded === 0) p += pos === "GK" || pos === "DEF" ? 4 : pos === "MID" ? 1 : 0;
  if (pos === "GK" || pos === "DEF") p -= Math.floor(conceded / 2);
  if (pos === "GK") p += Math.floor((s.saves ?? 0) / 3);
  if (s.redCard) p -= 3; if (s.yellowCard) p -= 1;
  return cap ? p * 2 : p;
}
const BUDGET = 100.0;
function priceOf(pos, mvEuros) {
  const cap = { GK: 6.5, DEF: 8.5, MID: 13.5, FWD: 14.0 };
  const mvM = Math.max(0, (mvEuros || 0) / 1e6);
  const p = Math.min(cap[pos] ?? 13.5, 4.0 + Math.sqrt(mvM) * 0.72);
  return Math.round(Math.max(4.0, p) * 10) / 10;
}
const squadCost = (players) => Math.round(players.reduce((s, p) => s + (p.price || 0), 0) * 10) / 10;
function enforceBudget(xi, bench, pool, used, captain, maxPerNation) {
  let guard = 0;
  while (squadCost([...xi, ...bench]) > BUDGET && guard++ < 80) {
    const squad = [...xi, ...bench];
    const candidates = [...bench, ...xi.filter((p) => p.name !== captain)].sort((a, b) => (b.price || 0) - (a.price || 0));
    let swapped = false;
    for (const target of candidates) {
      const counts = {}; for (const p of squad) if (p !== target) counts[p.team] = (counts[p.team] || 0) + 1;
      const repl = pool
        .filter((p) => p.pos === target.pos && !used.has(p.name) && (p.price || 0) < (target.price || 0) && (p.team === target.team || (counts[p.team] || 0) < maxPerNation))
        .sort((a, b) => (a.price || 0) - (b.price || 0))[0];
      if (!repl) continue;
      used.delete(target.name); used.add(repl.name);
      const xiIdx = xi.indexOf(target); if (xiIdx >= 0) xi[xiIdx] = repl;
      const bIdx = bench.indexOf(target); if (bIdx >= 0) bench[bIdx] = repl;
      swapped = true; break;
    }
    if (!swapped) break;
  }
}

// Build the selection pool + live stats for a specific (historical) group-stage round number.
async function buildRoundByNumber(rd) {
  const ev = await sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/round/${rd}`);
  const fixtures = ev.events ?? [];
  const finished = fixtures.filter((e) => e.status?.type === "finished");
  const teams = new Map();
  for (const e of fixtures) for (const t of [e.homeTeam, e.awayTeam]) if (t) teams.set(t.id, t);
  const numTeams = teams.size;
  const maxPerNation = Math.max(3, Math.ceil(15 / Math.max(1, numTeams)));
  console.log(`MD${rd}: ${fixtures.length} fixtures · ${numTeams} nations · ${finished.length} played · max ${maxPerNation}/nation`);

  const pool = [];
  for (const [id, t] of teams) {
    let squad; try { squad = await sofa(`/api/v1/team/${id}/players`); } catch { continue; }
    const flag = flagOf(t.country?.alpha2 ?? t.alpha2);
    const tc = t.teamColors;
    const colors = tc?.primary ? { primary: tc.primary, secondary: tc.secondary || tc.primary } : null;
    const players = (squad.players ?? [])
      .map((row) => row.player).filter((pl) => pl && pl.name && ["G", "D", "M", "F"].includes(pl.position))
      .map((pl) => ({ name: pl.name, pos: POS(pl.position), team: t.name, flag, colors, mv: Number(pl.proposedMarketValue ?? pl.proposedMarketValueRaw?.value ?? 0) }));
    players.sort((a, b) => b.mv - a.mv);
    const gks = players.filter((p) => p.pos === "GK").slice(0, 1);
    const outs = players.filter((p) => p.pos !== "GK").slice(0, 6);
    for (const p of [...gks, ...outs]) pool.push({ ...p, price: priceOf(p.pos, p.mv) });
    await delay(120);
  }
  pool.sort((a, b) => b.mv - a.mv);

  const stats = new Map();
  const playedTeams = new Set();
  for (const e of finished) {
    const hs = e.homeScore?.current ?? 0, as = e.awayScore?.current ?? 0;
    const sides = [{ t: e.homeTeam, conceded: as }, { t: e.awayTeam, conceded: hs }];
    let lu; try { lu = await sofa(`/api/v1/event/${e.id}/lineups`); } catch { continue; }
    for (const [key, side] of [["home", sides[0]], ["away", sides[1]]]) {
      playedTeams.add(side.t.name);
      for (const p of lu[key]?.players ?? []) {
        const name = p.player?.name; if (!name) continue;
        stats.set(norm(name), { st: p.statistics ?? {}, pos: POS(p.position) ?? "FWD", team: side.t.name, conceded: side.conceded });
      }
    }
    await delay(200);
  }
  return { pool, stats, playedTeams, numTeams, maxPerNation, gamesTotal: fixtures.length, gamesPlayed: finished.length };
}

const FORMATIONS = { "4-3-3": [4, 3, 3], "4-4-2": [4, 4, 2], "3-5-2": [3, 5, 2], "3-4-3": [3, 4, 3], "4-5-1": [4, 5, 1], "5-3-2": [5, 3, 2], "5-4-1": [5, 4, 1] };
async function pickXI(broker, prov, endpoint, model, pool, strat, maxPerNation) {
  const sys = `You are an elite AI fantasy football manager in a FIFA World Cup GROUP-STAGE matchday. Strategy: ${strat}. Choose ONE formation from: ${Object.keys(FORMATIONS).join(", ")}. Pick a starting XI matching it (exactly 1 GK) plus a 4-player bench (1 GK + 3 outfield) from the pool. Captain your best pick. HARD RULES: total £${BUDGET.toFixed(1)}m for all 15; MAX ${maxPerNation} players from any single nation.`;
  const user = `SELECTION POOL (name | pos | nation | £price):\n${pool.map((p) => `${p.name} | ${p.pos} | ${p.team} | £${(p.price || 0).toFixed(1)}m`).join("\n")}\n\nBudget £${BUDGET.toFixed(1)}m for all 15; max ${maxPerNation} per nation. Return ONLY JSON {"formation":"4-4-2","captain":"","reasoning":"<2 sentences>","xi":[{"name":"","pos":""}],"bench":[{"name":"","pos":""}]}.`;
  let content = "";
  for (let a = 0; a < 3; a++) {
    try {
      const h = await broker.inference.getRequestHeaders(prov, user);
      const res = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) });
      if (res.ok) { content = (await res.json()).choices?.[0]?.message?.content ?? ""; if (content) break; }
    } catch {} await delay(2000);
  }
  const m = content.match(/\{[\s\S]*\}/); const parsed = m ? JSON.parse(m[0]) : {};
  let f = String(parsed.formation || "4-3-3").trim(); if (!FORMATIONS[f]) f = "4-3-3";
  const [D, M, F] = FORMATIONS[f];
  const need = { GK: 1, DEF: D, MID: M, FWD: F };
  const byPos = { GK: [], DEF: [], MID: [], FWD: [] }, used = new Set(), nat = {};
  const canAdd = (p) => (nat[p.team] || 0) < maxPerNation;
  const add = (p, bucket) => { used.add(p.name); nat[p.team] = (nat[p.team] || 0) + 1; bucket.push(p); };
  const find = (nm) => pool.find((p) => norm(p.name) === norm(nm || ""));
  for (const pk2 of parsed.xi ?? []) { const pl = find(pk2.name); if (pl && !used.has(pl.name) && byPos[pl.pos].length < need[pl.pos] && canAdd(pl)) add(pl, byPos[pl.pos]); }
  for (const pos of Object.keys(need)) for (const p of pool.filter((x) => x.pos === pos && !used.has(x.name))) { if (byPos[pos].length >= need[pos]) break; if (canAdd(p)) add(p, byPos[pos]); }
  const xi = [...byPos.GK, ...byPos.DEF, ...byPos.MID, ...byPos.FWD];
  const bench = []; let needGk = 1, needOut = 3;
  for (const pk2 of parsed.bench ?? []) { const pl = find(pk2.name); if (!pl || used.has(pl.name) || !canAdd(pl)) continue; if (pl.pos === "GK" && needGk > 0) { add(pl, bench); needGk--; } else if (pl.pos !== "GK" && needOut > 0) { add(pl, bench); needOut--; } }
  if (needGk > 0) { const g = pool.find((p) => p.pos === "GK" && !used.has(p.name) && canAdd(p)); if (g) { add(g, bench); needGk--; } }
  for (const p of pool.filter((x) => x.pos !== "GK" && !used.has(x.name))) { if (needOut <= 0) break; if (canAdd(p)) { add(p, bench); needOut--; } }
  const captain = parsed.captain && find(parsed.captain) && used.has(find(parsed.captain).name) ? find(parsed.captain).name : (byPos.FWD[0]?.name ?? byPos.MID[0]?.name ?? xi[0]?.name);
  enforceBudget(xi, bench, pool, used, captain, maxPerNation);
  return { xi, captain, reasoning: parsed.reasoning || strat, formation: f, bench, squadValue: squadCost([...xi, ...bench]) };
}

// ---- main ----
console.log("Funder:", admin.address, ethers.formatEther(await provider.getBalance(admin.address)), "OG");
const ROUNDS = [1, 2, 3];
const roundData = [];
for (const rd of ROUNDS) roundData.push(await buildRoundByNumber(rd));

const broker = await createZGComputeNetworkBroker(admin);
try { await broker.ledger.getLedger(); } catch { await broker.ledger.addLedger(3); }
const chat = (await broker.inference.listService()).find((s) => s.serviceType === "chatbot");
try { await broker.inference.acknowledgeProviderSigner(chat.provider); } catch {}
const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);

let contestId;
if (!DRY) {
  contestId = Number(await adminContract.nextContestId());
  const now = Math.floor(Date.now() / 1000);
  await wait((await adminContract.createContest("FIFA World Cup 2026 — Group Stage Trials", 0n, now + 7 * 86400, now + 30 * 86400, true, "Veterans' proving ground — agents earn their career here.")).hash, "createContest");
  console.log(`Private contest #${contestId} created (proving ground)`);
}

const outAgents = [];
for (const vet of VETERANS) {
  try {
    const configRoot = await storeJSON({ name: vet.name, strategy: vet.strat });
    const agentId = Number(await adminContract.nextAgentId());
    if (DRY) { console.log(`[DRY] would create ${vet.name} (#${agentId}) + play 3 rounds`); continue; }
    await wait((await adminContract.createAgent(`0g://${configRoot}`)).hash, "create");
    await wait((await adminContract.enterContest(contestId, agentId, { value: 0 })).hash, "enter");

    let careerPts = 0, last = null;
    for (let i = 0; i < roundData.length; i++) {
      const rd = ROUNDS[i], rdData = roundData[i];
      const pick = await pickXI(broker, chat.provider, endpoint, model, rdData.pool, vet.strat, rdData.maxPerNation);
      let total = 0;
      const xiScored = pick.xi.map((p) => { const s = rdData.stats.get(norm(p.name)); const played = rdData.playedTeams.has(p.team); const pts = played ? fpl(s?.st ?? {}, p.pos, s?.conceded ?? 0, p.name === pick.captain) : 0; total += pts; return { ...p, points: pts, captain: p.name === pick.captain, pending: !played }; });
      const benchScored = pick.bench.map((p) => { const s = rdData.stats.get(norm(p.name)); const played = rdData.playedTeams.has(p.team); return { ...p, points: played ? fpl(s?.st ?? {}, p.pos, s?.conceded ?? 0, false) : 0, pending: !played }; });
      careerPts += total;
      const nations = new Set([...pick.xi, ...pick.bench].map((p) => p.team)).size;
      const decision = { manager: admin.address, owner: admin.address, agentId, managerName: vet.name, matchId: rd, match: `Group Stage · Matchday ${rd}`, round: `Group Stage · Matchday ${rd}`, score: `${rdData.gamesPlayed}/${rdData.gamesTotal} games`, gamesPlayed: rdData.gamesPlayed, gamesTotal: rdData.gamesTotal, numTeams: rdData.numTeams, maxPerNation: rdData.maxPerNation, formation: pick.formation, captain: pick.captain, reasoning: pick.reasoning, xi: xiScored, bench: benchScored, totalPoints: total, squadValue: pick.squadValue, budget: BUDGET, inTheBank: Math.round((BUDGET - pick.squadValue) * 10) / 10, model, nations, ts: new Date().toISOString() };
      const decisionRoot = await storeJSON(decision);
      await wait((await adminContract.recordPoints(contestId, agentId, rd, total, `0g://${decisionRoot}`)).hash, `points md${rd}`);
      console.log(`   ${vet.name} MD${rd}: ${pick.formation} · ${total} pts · cap ${pick.captain}`);
      last = { ...decision, decisionRoot };
    }
    for (let o = 0; o < vet.overrides; o++) await wait((await adminContract.recordOverride(contestId, agentId)).hash, "override");

    // graduate to a tradeable NFT (now eligible: 3 scored rounds)
    if (await adminContract.isEligible(agentId)) {
      await wait((await adminContract.mintAgent(agentId)).hash, "mint");
      if (vet.price) { const t = await adminContract.listAgent(agentId, ethers.parseEther(vet.price)); await wait(t.hash, "list"); }
    }
    const ag = await adminContract.getAgent(agentId);
    const tier = Number(ag[8]);
    const mult = (300 - vet.overrides * 25) / 100;
    outAgents.push({
      agentId, owner: admin.address, name: vet.name, match: last.round, formation: last.formation, captain: last.captain, reasoning: last.reasoning, model,
      xi: last.xi, bench: last.bench, squadValue: last.squadValue, budget: BUDGET, inTheBank: last.inTheBank,
      gamesPlayed: last.gamesPlayed, gamesTotal: last.gamesTotal, numTeams: last.numTeams, maxPerNation: last.maxPerNation,
      points: last.totalPoints, overrideCount: vet.overrides, multiplier: mult, effectiveScore: Math.round(last.totalPoints * mult),
      career: { tier, tierName: TIERS[tier] ?? "Pro", contestsEntered: Number(ag[2]), roundsScored: Number(ag[3]), careerPoints: Number(ag[4]), careerEffective: Number(ag[5]), wins: Number(ag[6]), eligible: ag[9], minted: ag[10], priceWei: ag[11].toString(), priceOG: ethers.formatEther(ag[11]) },
      decisionRoot: last.decisionRoot,
      layers: { compute: { model, provider: "0G Compute Network" }, storage: { decisionRoot: last.decisionRoot, configHash: configRoot }, chain: { contract: dep.address }, da: { anchored: true } },
    });
    console.log(`★ ${vet.name}: agent #${agentId} → ${TIERS[tier]} NFT · ${careerPts} career pts · ${vet.price ? `LISTED ${vet.price} OG` : "held (not listed)"}`);
  } catch (e) { console.log(`x ${vet.name}: ${e.message}`); }
}

if (!DRY) {
  outAgents.sort((a, b) => b.career.careerPoints - a.career.careerPoints).forEach((a, i) => (a.rank = i + 1));
  writeFileSync(join(here, "..", "frontend", "public", "veterans.json"), JSON.stringify({ contestId, contractAddress: dep.address, agents: outAgents, updatedAt: new Date().toISOString() }, null, 2));
  console.log(`✅ veterans.json — ${outAgents.length} veteran agents minted`);
}
