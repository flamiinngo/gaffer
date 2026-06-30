/**
 * Seeds a real AI-vs-AI showcase for the CURRENT World Cup ROUND (FPL knockout format):
 *  - selection pool = EVERY nation still in the round (their squads), priced by real market value
 *  - each gaffer's AI builds a £100m, max-3-per-nation fantasy squad on 0G Compute
 *  - scored live from finished games; players whose game hasn't kicked off are "pending"
 *  - written to 0G Storage + recorded onchain. Real data, real onchain. Set DRY_RUN=1 to
 *    preview picks with NO gas / NO storage / NO contest.
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
const KEYS = [process.env.SPORTAPI_KEY].filter(Boolean); // single paid Pro key
const TOUR = process.env.WC_TOURNAMENT_ID || "16";
const SEASON = process.env.WC_SEASON_ID || "58210";
const DRY = !!process.env.DRY_RUN;
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo-v2.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const admin = new ethers.Wallet(pk, provider);
const indexer = new Indexer(INDEXER_RPC);
// GafferArena v2: agents are NFTs (identified by agentId/tokenId). Showcase mints 3 "house" agents.
const ABI = [
  "function nextContestId() view returns (uint256)",
  "function nextAgentId() view returns (uint256)",
  "function createAgent(string) returns (uint256)",
  "function mintAgent(uint256)",
  "function createContest(string,uint256,uint256,uint256,bool,string) returns (uint256)",
  "function enterContest(uint256,uint256) payable",
  "function recordPoints(uint256,uint256,uint256,uint256,string)",
  "function recordOverride(uint256,uint256)",
];
const adminContract = new ethers.Contract(dep.address, ABI, admin);

// Three rival gaffers with genuinely different knockout philosophies (a portfolio of nations).
const GAFFERS = [
  { name: "Total Attack", strat: "ultra-attacking: the highest-ceiling forwards and attacking midfielders from the strongest attacking nations. Attacking 3-4-3.", overrides: 0 },
  { name: "The Catenaccio Kid", strat: "defensive masterclass: the best goalkeeper and defenders from nations with the meanest defences, riding teams likely to keep clean sheets. Solid 5-3-2.", overrides: 1 },
  { name: "Moneyball", strat: "value and differentials: the best price-per-quality players from nations likely to go deep, regardless of fame. Balanced 4-4-2.", overrides: 2 },
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

// FPL-style economy: £100.0m for the full 15-man squad (11 XI + 4 bench). Price is driven by each
// player's REAL market value (€) — true, sustained quality that covers every player in every
// nation — mapped position-aware into the £4.0–£14.0 FPL band on a sqrt curve so the very top
// compresses like real FPL. Position caps stop a €100m keeper costing midfielder money.
const BUDGET = 100.0;
function priceOf(pos, marketValueEuros) {
  const cap = { GK: 6.5, DEF: 8.5, MID: 13.5, FWD: 14.0 };
  const mvM = Math.max(0, (marketValueEuros || 0) / 1e6); // millions €
  const p = Math.min(cap[pos] ?? 13.5, 4.0 + Math.sqrt(mvM) * 0.72);
  return Math.round(Math.max(4.0, p) * 10) / 10;
}
const squadCost = (players) => Math.round(players.reduce((s, p) => s + (p.price || 0), 0) * 10) / 10;

// Keep the 15-man squad within budget: swap the priciest non-captain player for the cheapest
// same-position alternative (respecting the per-nation cap) until under budget; bench first.
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

// ---- build the round: full N-nation selection pool + live stats from finished games ----
async function buildRound() {
  const rk = (e) => String(e.roundInfo?.name ?? e.roundInfo?.round ?? "");
  const [lastR, nextR] = await Promise.all([
    sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/last/0`),
    sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/next/0`).catch(() => ({ events: [] })),
  ]);
  const all = [...(lastR.events ?? []), ...(nextR.events ?? [])];
  const finishedAll = all.filter((e) => e.status?.type === "finished").sort((a, b) => (b.startTimestamp ?? 0) - (a.startTimestamp ?? 0));
  if (!finishedAll.length) throw new Error("no finished WC matches available");
  // Active round = the round of the most recently played game (the live gameweek), unless overridden.
  const target = process.env.MATCHDAY || rk(finishedAll[0]);
  const roundFixtures = all.filter((e) => rk(e) === target);
  const finished = roundFixtures.filter((e) => e.status?.type === "finished");
  const teamsInRound = new Map();
  for (const e of roundFixtures) for (const t of [e.homeTeam, e.awayTeam]) if (t) teamsInRound.set(t.id, t);
  const numTeams = teamsInRound.size;
  const maxPerNation = Math.max(3, Math.ceil(15 / Math.max(1, numTeams)));
  console.log(`Round "${target}": ${roundFixtures.length} fixtures · ${numTeams} nations · ${finished.length} played / ${roundFixtures.length - finished.length} pending · max ${maxPerNation}/nation`);

  // selection pool: every nation's squad (top GK + top 6 outfield by market value), FPL-priced
  const pool = [];
  for (const [id, t] of teamsInRound) {
    let squad;
    try { squad = await sofa(`/api/v1/team/${id}/players`); } catch { continue; }
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

  // live stats from finished games only (unplayed nations -> pending)
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
  const nations = new Set(pool.map((p) => p.team));
  console.log(`Pool: ${pool.length} players across ${nations.size} nations`);
  const roundNum = Number(finishedAll[0].roundInfo?.round) || Number((target.match(/\d+/) || [])[0]) || 1;
  return { pool, stats, label: target, numTeams, maxPerNation, gamesTotal: roundFixtures.length, gamesPlayed: finished.length, playedTeams, matchId: roundNum };
}

// Valid FPL formations (outfield DEF-MID-FWD; GK is always 1).
const FORMATIONS = { "4-3-3": [4, 3, 3], "4-4-2": [4, 4, 2], "3-5-2": [3, 5, 2], "3-4-3": [3, 4, 3], "4-5-1": [4, 5, 1], "5-3-2": [5, 3, 2], "5-4-1": [5, 4, 1] };

async function pickXI(broker, prov, endpoint, model, pool, strat, maxPerNation) {
  const sys = `You are an elite AI fantasy football manager in a FIFA World Cup KNOCKOUT round. Strategy: ${strat}. Choose ONE formation from: ${Object.keys(FORMATIONS).join(", ")}. Pick a starting XI matching it (exactly 1 GK) plus a 4-player bench (1 GK + 3 outfield) from the pool (every nation still alive this round). Captain your best pick. HARD RULES: total £${BUDGET.toFixed(1)}m for all 15; MAX ${maxPerNation} players from any single nation. You cannot afford every star — balance premiums with value and spread across nations you trust to advance.`;
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
  let f = String(parsed.formation || "4-3-3").trim();
  if (!FORMATIONS[f]) f = "4-3-3";
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
  const squadValue = squadCost([...xi, ...bench]);
  return { xi, captain, reasoning: parsed.reasoning || strat, formation: f, bench, squadValue };
}

// ---- main ----
console.log("Funder:", admin.address, ethers.formatEther(await provider.getBalance(admin.address)), "OG");
const { pool, stats, label, numTeams, maxPerNation, gamesTotal, gamesPlayed, playedTeams, matchId } = await buildRound();

const broker = await createZGComputeNetworkBroker(admin);
try { await broker.ledger.getLedger(); } catch { await broker.ledger.addLedger(3); }
const chat = (await broker.inference.listService()).find((s) => s.serviceType === "chatbot");
try { await broker.inference.acknowledgeProviderSigner(chat.provider); } catch {}
const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);

let contestId;
if (!DRY) {
  contestId = Number(await adminContract.nextContestId());
  const now = Math.floor(Date.now() / 1000);
  const ct = await adminContract.createContest(`FIFA World Cup 2026 — ${label}`, 0n, now + 7 * 86400, now + 30 * 86400, false, "Official World Cup showcase — AI gaffers, real stakes off.");
  await wait(ct.hash, "createContest");
  console.log(`Contest #${contestId} created`);
}

for (const gf of GAFFERS) {
  try {
    const { xi, captain, reasoning, formation, bench, squadValue } = await pickXI(broker, chat.provider, endpoint, model, pool, gf.strat, maxPerNation);
    let total = 0;
    const xiScored = xi.map((p) => { const s = stats.get(norm(p.name)); const played = playedTeams.has(p.team); const pts = played ? fpl(s?.st ?? {}, p.pos, s?.conceded ?? 0, p.name === captain) : 0; total += pts; return { ...p, points: pts, captain: p.name === captain, pending: !played }; });
    const benchScored = bench.map((p) => { const s = stats.get(norm(p.name)); const played = playedTeams.has(p.team); return { ...p, points: played ? fpl(s?.st ?? {}, p.pos, s?.conceded ?? 0, false) : 0, pending: !played }; });
    const nations = new Set([...xi, ...bench].map((p) => p.team)).size;
    if (DRY) {
      const natc = {}; for (const p of [...xi, ...bench]) natc[p.team] = (natc[p.team] || 0) + 1;
      const overCap = Object.entries(natc).filter(([, v]) => v > maxPerNation);
      console.log(`\n— ${gf.name} [DRY] ${formation} · £${squadValue.toFixed(1)}m / £${BUDGET}m · ITB £${(BUDGET - squadValue).toFixed(1)}m · ${nations} nations · cap ${captain} · ${total} pts live`);
      console.log("  nations:", Object.entries(natc).map(([k, v]) => `${k}:${v}`).join(", "), overCap.length ? `  !! OVER CAP: ${JSON.stringify(overCap)}` : "✓ within cap");
      console.log("  XI:", xiScored.map((p) => `${p.name}(${p.pos},£${p.price}${p.captain ? ",C" : ""}${p.pending ? ",⏳" : `,${p.points}`})`).join(", "));
      continue;
    }
    // create the gaffer as a record (house agent, admin-owned), then enter it by agentId.
    // It earns its NFT status by playing — only mintable once it clears the experience threshold.
    const configRoot = await storeJSON({ name: gf.name, strategy: gf.strat });
    const agentId = Number(await adminContract.nextAgentId());
    await wait((await adminContract.createAgent(`0g://${configRoot}`)).hash, "create");
    const decision = { manager: admin.address, owner: admin.address, agentId, managerName: gf.name, matchId, match: label, round: label, score: `${gamesPlayed}/${gamesTotal} games`, gamesPlayed, gamesTotal, numTeams, maxPerNation, formation, captain, reasoning, xi: xiScored, bench: benchScored, totalPoints: total, squadValue, budget: BUDGET, inTheBank: Math.round((BUDGET - squadValue) * 10) / 10, model, ts: new Date().toISOString() };
    console.log(`   squad £${squadValue.toFixed(1)}m / £${BUDGET}m · ${nations} nations · agent #${agentId}`);
    const decisionRoot = await storeJSON(decision);
    await wait((await adminContract.enterContest(contestId, agentId, { value: 0 })).hash, "enter");
    await wait((await adminContract.recordPoints(contestId, agentId, matchId, total, `0g://${decisionRoot}`)).hash, "points");
    for (let o = 0; o < gf.overrides; o++) await wait((await adminContract.recordOverride(contestId, agentId)).hash, "override");
    console.log(`✓ ${gf.name}: agent #${agentId} · ${formation} · ${total} pts · ${nations} nations · cap ${captain} · ${gf.overrides} overrides`);
  } catch (e) { console.log(`x ${gf.name}: ${e.message}`); }
}

if (!DRY) {
  writeFileSync(join(here, "..", "frontend", "public", "featured.json"), JSON.stringify({ contestId, matchId: label, match: `FIFA World Cup 2026 — ${label}`, score: `${gamesPlayed}/${gamesTotal} games` }, null, 2));
  console.log(`\n✓ Showcase contest #${contestId} populated (${label}).`);
} else {
  console.log("\n[DRY RUN] no onchain writes, no storage, no contest created.");
}
