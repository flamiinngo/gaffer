/**
 * Closes the loop for EVERY entrant — not just house agents.
 *
 * For the active contest, any entered gaffer that hasn't picked yet (e.g. a user-deployed agent
 * like "zach") gets its XI chosen by its own AI on 0G Compute (using the strategy it was deployed
 * with), stored on 0G Storage, scored on the real finished games, and recorded onchain. This is the
 * professional flow: a gaffer picks its team for the round; points fill in as the games conclude.
 *
 * Run it each matchday (alongside populate) so deploy → pick → score is end-to-end for anyone.
 */
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
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
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo-v2.json"), "utf8"));
const featured = JSON.parse(readFileSync(join(here, "..", "frontend", "public", "featured.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const admin = new ethers.Wallet(pk, provider);
const indexer = new Indexer(INDEXER_RPC);
const ABI = [
  "function nextContestId() view returns (uint256)",
  "function getParticipants(uint256) view returns (uint256[])",
  "function getAgent(uint256) view returns (address,string,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256)",
  "function recordPoints(uint256,uint256,uint256,uint256,string)",
  "event PointsRecorded(uint256 indexed contestId, uint256 indexed agentId, uint256 indexed matchId, uint256 points, string decisionHash)",
];
const adminContract = new ethers.Contract(dep.address, ABI, admin);
const STORAGE_GATEWAY = "https://indexer-storage-testnet-turbo.0g.ai/file?root=";

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
async function storeJSON(obj) { const f = new MemData(new TextEncoder().encode(JSON.stringify(obj))); const [t, e] = await f.merkleTree(); if (e) throw e; const [, ue] = await indexer.upload(f, EVM_RPC, admin); if (ue && !/exist|already/i.test(String(ue))) throw ue; return t.rootHash(); }
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

async function buildRound() {
  const rk = (e) => String(e.roundInfo?.name ?? e.roundInfo?.round ?? "");
  const [lastR, nextR] = await Promise.all([
    sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/last/0`),
    sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/next/0`).catch(() => ({ events: [] })),
  ]);
  const all = [...(lastR.events ?? []), ...(nextR.events ?? [])];
  const finishedAll = all.filter((e) => e.status?.type === "finished").sort((a, b) => (b.startTimestamp ?? 0) - (a.startTimestamp ?? 0));
  if (!finishedAll.length) throw new Error("no finished WC matches available");
  const target = process.env.MATCHDAY || rk(finishedAll[0]);
  const roundFixtures = all.filter((e) => rk(e) === target);
  const finished = roundFixtures.filter((e) => e.status?.type === "finished");
  const teamsInRound = new Map();
  for (const e of roundFixtures) for (const t of [e.homeTeam, e.awayTeam]) if (t) teamsInRound.set(t.id, t);
  const numTeams = teamsInRound.size;
  const maxPerNation = Math.max(3, Math.ceil(15 / Math.max(1, numTeams)));
  console.log(`Round "${target}": ${roundFixtures.length} fixtures · ${numTeams} nations · ${finished.length} played`);
  const pool = [];
  for (const [id, t] of teamsInRound) {
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
  const roundNum = Number(finishedAll[0].roundInfo?.round) || Number((target.match(/\d+/) || [])[0]) || 1;
  return { pool, stats, label: target, numTeams, maxPerNation, gamesTotal: roundFixtures.length, gamesPlayed: finished.length, playedTeams, matchId: roundNum };
}

const FORMATIONS = { "4-3-3": [4, 3, 3], "4-4-2": [4, 4, 2], "3-5-2": [3, 5, 2], "3-4-3": [3, 4, 3], "4-5-1": [4, 5, 1], "5-3-2": [5, 3, 2], "5-4-1": [5, 4, 1] };
async function pickXI(broker, prov, endpoint, model, pool, strat, maxPerNation, history = "") {
  const sys = `${history ? history + " " : ""}You are an elite AI fantasy football manager in a FIFA World Cup KNOCKOUT round. Strategy: ${strat}. Choose ONE formation from: ${Object.keys(FORMATIONS).join(", ")}. Pick a starting XI matching it (exactly 1 GK) plus a 4-player bench (1 GK + 3 outfield) from the pool. Captain your best pick. HARD RULES: total £${BUDGET.toFixed(1)}m for all 15; MAX ${maxPerNation} players from any single nation.`;
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

const TIERS = ["Rookie", "Pro", "Elite", "Legend"];

// The agent's most recent decision (its previous round's team), read back from 0G.
async function loadLastDecision(contestId, agentId) {
  const evs = await adminContract.queryFilter(adminContract.filters.PointsRecorded(contestId, agentId), 0, "latest");
  if (!evs.length) return null;
  const root = (evs[evs.length - 1].args.decisionHash || "").replace(/^0g:\/\//, "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) return null;
  try {
    const res = await fetch(STORAGE_GATEWAY + root, { signal: AbortSignal.timeout(12000) });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// Veterans pick with memory: their record + last round's result go into the prompt.
function historyLine(record, prev) {
  let line = `You are a ${TIERS[record.tier] ?? "Rookie"} gaffer — ${record.rounds} round(s) played, ${record.wins} contest win(s).`;
  if (prev?.xi?.length) {
    const top = [...prev.xi].filter((p) => !p.pending).sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
    line += ` Last round you captained ${prev.captain}${top ? ` and ${top.name} returned ${top.points} pts` : ""}. Apply that experience.`;
  }
  return record.rounds > 0 ? line : "";
}

// Knockout transfers: KEEP every player whose nation advanced; the AI replaces ONLY those whose
// nation was eliminated (same position, from the survivor pool, within budget + per-nation cap).
async function transferXI(broker, prov, endpoint, model, prev, pool, strat, maxPerNation, history) {
  const find = (nm) => pool.find((p) => norm(p.name) === norm(nm || ""));
  const keptXI = [], keptBench = [], openXI = [], openBench = [];
  for (const p of (prev.xi || [])) { const inPool = find(p.name); if (inPool) keptXI.push({ ...inPool }); else openXI.push({ pos: p.pos, was: p.name }); }
  for (const p of (prev.bench || [])) { const inPool = find(p.name); if (inPool) keptBench.push({ ...inPool }); else openBench.push({ pos: p.pos, was: p.name }); }
  const opens = [...openXI, ...openBench];
  const capName = (xi) => { const c = xi.find((p) => norm(p.name) === norm(prev.captain)); return c ? c.name : [...xi].sort((a, b) => (b.mv || 0) - (a.mv || 0))[0]?.name; };

  if (!opens.length) {
    return { xi: keptXI, bench: keptBench, captain: capName(keptXI), formation: prev.formation || "4-4-2", reasoning: "Every nation survived — squad held, no transfers.", squadValue: squadCost([...keptXI, ...keptBench]), transfers: [] };
  }

  const used = new Set([...keptXI, ...keptBench].map((p) => p.name));
  const nat = {}; for (const p of [...keptXI, ...keptBench]) nat[p.team] = (nat[p.team] || 0) + 1;
  const needByPos = {}; opens.forEach((o) => (needByPos[o.pos] = (needByPos[o.pos] || 0) + 1));
  const sys = `${history} You manage a knockout fantasy squad entering a NEW round. Some of your players' nations were KNOCKED OUT — replace ONLY those, keep everyone else. Strategy: ${strat}.`;
  const user = `KEEP (advanced): ${[...keptXI, ...keptBench].map((p) => `${p.name}(${p.pos},${p.team})`).join(", ") || "none"}.\nKNOCKED OUT, replace: ${opens.map((o) => `${o.was}(${o.pos})`).join(", ")}.\nPick exactly ${Object.entries(needByPos).map(([p, n]) => `${n}×${p}`).join(", ")} from the survivor pool:\n${pool.map((p) => `${p.name} | ${p.pos} | ${p.team} | £${(p.price || 0).toFixed(1)}m`).join("\n")}\nKept squad costs £${squadCost([...keptXI, ...keptBench]).toFixed(1)}m of £${BUDGET}m. Max ${maxPerNation} per nation. Return ONLY JSON {"reasoning":"<1 sentence>","replacements":[{"name":"","pos":""}]}.`;
  let content = "";
  for (let a = 0; a < 3; a++) { try { const h = await broker.inference.getRequestHeaders(prov, user); const res = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) }); if (res.ok) { content = (await res.json()).choices?.[0]?.message?.content ?? ""; if (content) break; } } catch {} await delay(2000); }
  const m = content.match(/\{[\s\S]*\}/); const parsed = m ? JSON.parse(m[0]) : {};
  const pickRepl = (pos) => {
    for (const r of (parsed.replacements || [])) { if (norm(r.pos) !== norm(pos)) continue; const pl = find(r.name); if (pl && pl.pos === pos && !used.has(pl.name) && (nat[pl.team] || 0) < maxPerNation) return pl; }
    return pool.filter((p) => p.pos === pos && !used.has(p.name) && (nat[p.team] || 0) < maxPerNation).sort((a, b) => (a.price || 0) - (b.price || 0))[0];
  };
  const transfers = [];
  const fill = (slots, dest) => { for (const o of slots) { const repl = pickRepl(o.pos); if (repl) { used.add(repl.name); nat[repl.team] = (nat[repl.team] || 0) + 1; dest.push({ ...repl }); transfers.push({ out: o.was, in: repl.name, pos: o.pos }); } } };
  const xi = [...keptXI], bench = [...keptBench];
  fill(openXI, xi); fill(openBench, bench);
  const captain = capName(xi);
  enforceBudget(xi, bench, pool, used, captain, maxPerNation);
  return { xi, bench, captain, formation: prev.formation || "4-4-2", reasoning: parsed.reasoning || `Transferred out ${transfers.map((t) => t.out).join(", ") || "nobody"}.`, squadValue: squadCost([...xi, ...bench]), transfers };
}

async function readConfig(cfgStr) {
  let name = null, strat = "balanced — back value picks from nations you trust to go deep";
  try {
    if (cfgStr.trim().startsWith("{")) {
      const c = JSON.parse(cfgStr);
      name = c.n ?? c.name ?? null;
      const s = c.s;
      strat = `${c.p ?? c.persona ?? "balanced"}${s ? `. Attack ${s.attack}, risk ${s.risk}, form ${s.form}, rotation ${s.rotation} (0-100).` : ""}`;
    } else {
      const root = cfgStr.replace(/^0g:\/\//, "");
      if (/^0x[0-9a-fA-F]{64}$/.test(root)) {
        const res = await fetch(STORAGE_GATEWAY + root, { signal: AbortSignal.timeout(12000) });
        if (res.ok) { const c = await res.json(); name = c.name ?? null; strat = c.strategy ?? strat; }
      }
    }
  } catch {}
  return { name, strat };
}

// ---- main ----
console.log("Resolver:", admin.address, ethers.formatEther(await provider.getBalance(admin.address)), "OG");
const contestId = featured.contestId ?? (Number(await adminContract.nextContestId()) - 1);
const participants = (await adminContract.getParticipants(contestId)).map((x) => Number(x));
console.log(`Contest #${contestId}: ${participants.length} entrants — ${participants.join(", ")}`);

const { pool, stats, label, numTeams, maxPerNation, gamesTotal, gamesPlayed, playedTeams, matchId } = await buildRound();

const broker = await createZGComputeNetworkBroker(admin);
try { await broker.ledger.getLedger(); } catch { await broker.ledger.addLedger(3); }
const chat = (await broker.inference.listService()).find((s) => s.serviceType === "chatbot");
try { await broker.inference.acknowledgeProviderSigner(chat.provider); } catch {}
const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);

let picked = 0;
for (const agentId of participants) {
  try {
    // Re-pick PER ROUND (per matchId): a gaffer picked for the Round of 32 still picks again for the
    // Round of 16 from the new survivor pool — the cross-round transfer. Skip only if it already
    // picked for THIS round. Career (rounds scored, points) accumulates across rounds in the contest.
    const evs = await adminContract.queryFilter(adminContract.filters.PointsRecorded(contestId, agentId, matchId), 0, "latest");
    if (evs.length) { console.log(`#${agentId} already picked for round ${matchId} — skip`); continue; }
    const ag = await adminContract.getAgent(agentId);
    const { name: cfgName, strat } = await readConfig(ag[1] || "");
    const name = cfgName || `Agent #${agentId}`;
    const record = { tier: Number(ag[8]), rounds: Number(ag[3]), wins: Number(ag[6]) };
    // its previous round's team (if any) — drives transfers + veteran memory
    const prev = await loadLastDecision(contestId, agentId);
    const history = historyLine(record, prev);

    let pick;
    if (prev && (prev.xi?.length ?? 0) >= 7) {
      console.log(`\n→ ${name} (#${agentId}) [${TIERS[record.tier]}] re-picking — keeping survivors, transferring out eliminated…`);
      try { pick = await transferXI(broker, chat.provider, endpoint, model, prev, pool, strat, maxPerNation, history); }
      catch (e) { console.log(`   transfer failed (${e.message}) — full re-pick`); pick = await pickXI(broker, chat.provider, endpoint, model, pool, strat, maxPerNation, history); }
    } else {
      console.log(`\n→ ${name} (#${agentId}) [${TIERS[record.tier]}] first pick on 0G Compute…`);
      pick = await pickXI(broker, chat.provider, endpoint, model, pool, strat, maxPerNation, history);
    }
    const { xi, captain, reasoning, formation, bench, squadValue, transfers = [] } = pick;
    let total = 0;
    const xiScored = xi.map((p) => { const s = stats.get(norm(p.name)); const played = playedTeams.has(p.team); const pts = played ? fpl(s?.st ?? {}, p.pos, s?.conceded ?? 0, p.name === captain) : 0; total += pts; return { ...p, points: pts, captain: p.name === captain, pending: !played }; });
    const benchScored = bench.map((p) => { const s = stats.get(norm(p.name)); const played = playedTeams.has(p.team); return { ...p, points: played ? fpl(s?.st ?? {}, p.pos, s?.conceded ?? 0, false) : 0, pending: !played }; });
    const nations = new Set([...xi, ...bench].map((p) => p.team)).size;
    const decision = { manager: ag[0], owner: ag[0], agentId, managerName: name, tier: record.tier, matchId, match: label, round: label, score: `${gamesPlayed}/${gamesTotal} games`, gamesPlayed, gamesTotal, numTeams, maxPerNation, formation, captain, reasoning, transfers, xi: xiScored, bench: benchScored, totalPoints: total, squadValue, budget: BUDGET, inTheBank: Math.round((BUDGET - squadValue) * 10) / 10, model, nations, ts: new Date().toISOString() };
    const decisionRoot = await storeJSON(decision);
    await wait((await adminContract.recordPoints(contestId, agentId, matchId, total, `0g://${decisionRoot}`)).hash, "points");
    const tNote = transfers.length ? ` · ${transfers.length} transfer(s): ${transfers.map((t) => `${t.out}→${t.in}`).join(", ")}` : "";
    console.log(`✓ ${name} (#${agentId}): ${formation} · cap ${captain} · ${total} pts (${gamesPlayed}/${gamesTotal} games in) · ${nations} nations${tNote}`);
    picked++;
  } catch (e) { console.log(`x #${agentId}: ${e.message}`); }
}
console.log(`\n✅ Picked + scored ${picked} entrant(s). Run export-leaderboard.mjs to refresh the UI.`);
