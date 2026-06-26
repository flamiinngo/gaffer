/**
 * Seeds a real AI-vs-AI showcase on a full World Cup MATCHDAY (FPL-style):
 * pool = every player who featured across the matchday (all teams), each gaffer's AI
 * builds a fantasy XI spanning many nations on 0G Compute, scored COMBINED across all
 * the matchday's games, with varied autonomy multipliers. Real data, real onchain.
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
// working keys first (rotation skips 429)
const KEYS = [process.env.SPORTAPI_KEY_3, process.env.SPORTAPI_KEY_4, process.env.SPORTAPI_KEY_5, process.env.SPORTAPI_KEY_2, process.env.SPORTAPI_KEY].filter(Boolean);
const TOUR = process.env.WC_TOURNAMENT_ID || "16";
const SEASON = process.env.WC_SEASON_ID || "58210";
const MATCHDAY = process.env.MATCHDAY || "2";
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const admin = new ethers.Wallet(pk, provider);
const indexer = new Indexer(INDEXER_RPC);
const ABI = [
  "function nextContestId() view returns (uint256)",
  "function createContest(string,uint256,uint256,uint256) returns (uint256)",
  "function enterContest(uint256,string) payable",
  "function recordPoints(uint256,address,uint256,uint256,string)",
  "function recordOverride(uint256,address)",
];
const adminContract = new ethers.Contract(dep.address, ABI, admin);

const GAFFERS = [
  { name: "Total Attack", strat: "ultra-attacking: load up on the highest-ceiling forwards and attacking midfielders across all nations. Use an attacking 3-4-3 formation.", overrides: 0 },
  { name: "The Catenaccio Kid", strat: "defensive masterclass: the best goalkeeper and defenders from teams that kept clean sheets. Use a solid 5-3-2 formation.", overrides: 1 },
  { name: "Moneyball", strat: "form and value: the highest-rated performers of the matchday regardless of fame. Use a balanced 4-4-2 formation.", overrides: 2 },
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
const POS = (p) => (p === "G" ? "GK" : p === "D" ? "DEF" : p === "M" ? "MID" : "FWD");
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

// ---- build the matchday pool + scoring stats from every game's lineups ----
async function buildMatchday() {
  const { events } = await sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/last/0`);
  const finished = events.filter((e) => e.status?.type === "finished");
  if (!finished.length) throw new Error("no finished WC matches available");
  // Auto-target the LATEST matchday (the round of the most recently played games), unless MATCHDAY overrides.
  finished.sort((a, b) => (b.startTimestamp ?? 0) - (a.startTimestamp ?? 0));
  const roundKey = (e) => String(e.roundInfo?.name ?? e.roundInfo?.round ?? "");
  const target = process.env.MATCHDAY || roundKey(finished[0]);
  const roundNum = Number(finished[0].roundInfo?.round ?? process.env.MATCHDAY ?? 0) || 0;
  const matches = finished.filter((e) => roundKey(e) === target);
  if (!matches.length) throw new Error(`no finished matches for round ${target}`);
  console.log(`Matchday ${target}: ${matches.length} games`);

  const pool = []; // {name,pos,team,flag,rating}
  const stats = new Map(); // norm(name) -> {st,pos,team,conceded}
  for (const e of matches) {
    const hs = e.homeScore?.current ?? 0, as = e.awayScore?.current ?? 0;
    const sides = [{ t: e.homeTeam, conceded: as }, { t: e.awayTeam, conceded: hs }];
    let lu;
    try { lu = await sofa(`/api/v1/event/${e.id}/lineups`); } catch { continue; }
    for (const [key, side] of [["home", sides[0]], ["away", sides[1]]]) {
      for (const p of lu[key]?.players ?? []) {
        const st = p.statistics ?? {};
        if ((st.minutesPlayed ?? 0) === 0) continue;
        const pos = POS(p.position), name = p.player?.name;
        if (!name) continue;
        const flag = flagOf(side.t.country?.alpha2 ?? side.t.alpha2);
        pool.push({ name, pos, team: side.t.name, flag, rating: Number(st.rating ?? 0) });
        stats.set(norm(name), { st, pos, team: side.t.name, conceded: side.conceded });
      }
    }
    await delay(250);
  }
  // strongest, most diverse pool for the prompt (top by rating)
  pool.sort((a, b) => b.rating - a.rating);
  const trimmed = pool.slice(0, 180);
  const teams = new Set(trimmed.map((p) => p.team));
  console.log(`Pool: ${trimmed.length} players across ${teams.size} nations`);
  return { matches: matches.length, pool: trimmed, stats, label: target, matchId: roundNum };
}

// Valid FPL formations (outfield DEF-MID-FWD; GK is always 1).
const FORMATIONS = { "4-3-3": [4, 3, 3], "4-4-2": [4, 4, 2], "3-5-2": [3, 5, 2], "3-4-3": [3, 4, 3], "4-5-1": [4, 5, 1], "5-3-2": [5, 3, 2], "5-4-1": [5, 4, 1] };

async function pickXI(broker, prov, endpoint, model, pool, strat) {
  const sys = `You are an elite AI fantasy football manager. Strategy: ${strat}. Choose ONE formation from: ${Object.keys(FORMATIONS).join(", ")}. Pick a starting XI matching it (always exactly 1 GK) from the matchday pool — mix nations freely. Also name a 4-player bench (1 GK + 3 outfield). Captain your best pick.`;
  const user = `MATCHDAY POOL (name | pos | team):\n${pool.map((p) => `${p.name} | ${p.pos} | ${p.team}`).join("\n")}\n\nReturn ONLY JSON {"formation":"4-4-2","captain":"","reasoning":"<2 sentences>","xi":[{"name":"","pos":""}],"bench":[{"name":"","pos":""}]}.`;
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
  const byPos = { GK: [], DEF: [], MID: [], FWD: [] }, used = new Set();
  const find = (nm) => pool.find((p) => norm(p.name) === norm(nm || ""));
  for (const pk2 of parsed.xi ?? []) { const pl = find(pk2.name); if (pl && !used.has(pl.name) && byPos[pl.pos].length < need[pl.pos]) { byPos[pl.pos].push(pl); used.add(pl.name); } }
  for (const pos of Object.keys(need)) for (const p of pool.filter((x) => x.pos === pos && !used.has(x.name))) { if (byPos[pos].length >= need[pos]) break; byPos[pos].push(p); used.add(p.name); }
  const xi = [...byPos.GK, ...byPos.DEF, ...byPos.MID, ...byPos.FWD];
  // bench: 1 GK + 3 outfield, preferring the AI's choices
  const bench = []; let needGk = 1, needOut = 3;
  for (const pk2 of parsed.bench ?? []) { const pl = find(pk2.name); if (!pl || used.has(pl.name)) continue; if (pl.pos === "GK" && needGk > 0) { bench.push(pl); used.add(pl.name); needGk--; } else if (pl.pos !== "GK" && needOut > 0) { bench.push(pl); used.add(pl.name); needOut--; } }
  if (needGk > 0) { const g = pool.find((p) => p.pos === "GK" && !used.has(p.name)); if (g) { bench.push(g); used.add(g.name); } }
  for (const p of pool.filter((x) => x.pos !== "GK" && !used.has(x.name))) { if (needOut <= 0) break; bench.push(p); used.add(p.name); needOut--; }
  const captain = parsed.captain && find(parsed.captain) && used.has(find(parsed.captain).name) ? find(parsed.captain).name : byPos.FWD[0]?.name ?? byPos.MID[0]?.name;
  return { xi, captain, reasoning: parsed.reasoning || strat, formation: f, bench };
}

// ---- main ----
console.log("Funder:", admin.address, ethers.formatEther(await provider.getBalance(admin.address)), "OG");
const { matches, pool, stats, label, matchId } = await buildMatchday();

const broker = await createZGComputeNetworkBroker(admin);
try { await broker.ledger.getLedger(); } catch { await broker.ledger.addLedger(3); }
const chat = (await broker.inference.listService()).find((s) => s.serviceType === "chatbot");
try { await broker.inference.acknowledgeProviderSigner(chat.provider); } catch {}
const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);

const contestId = Number(await adminContract.nextContestId());
const now = Math.floor(Date.now() / 1000);
const ct = await adminContract.createContest(`FIFA World Cup 2026 — Matchday ${label}`, 0n, now + 7 * 86400, now + 30 * 86400);
await wait(ct.hash, "createContest");
console.log(`Contest #${contestId} created`);

for (const gf of GAFFERS) {
  try {
    const w = ethers.Wallet.createRandom().connect(provider);
    await wait((await admin.sendTransaction({ to: w.address, value: ethers.parseEther("0.02") })).hash, "fund");
    const { xi, captain, reasoning, formation, bench } = await pickXI(broker, chat.provider, endpoint, model, pool, gf.strat);
    let total = 0;
    const xiScored = xi.map((p) => { const s = stats.get(norm(p.name)) ?? {}; const pts = fpl(s.st ?? {}, p.pos, s.conceded ?? 0, p.name === captain); total += pts; return { ...p, points: pts, captain: p.name === captain }; });
    const benchScored = bench.map((p) => { const s = stats.get(norm(p.name)) ?? {}; return { ...p, points: fpl(s.st ?? {}, p.pos, s.conceded ?? 0, false) }; });
    const decision = { manager: w.address, managerName: gf.name, matchId, match: `Matchday ${label}`, score: `${matches} games`, formation, captain, reasoning, xi: xiScored, bench: benchScored, totalPoints: total, model, ts: new Date().toISOString() };
    const decisionRoot = await storeJSON(decision);
    const configRoot = await storeJSON({ name: gf.name, strategy: gf.strat });
    const gc = new ethers.Contract(dep.address, ABI, w);
    await wait((await gc.enterContest(contestId, `0g://${configRoot}`, { value: 0 })).hash, "enter");
    await wait((await adminContract.recordPoints(contestId, w.address, matchId, total, `0g://${decisionRoot}`)).hash, "points");
    for (let o = 0; o < gf.overrides; o++) await wait((await adminContract.recordOverride(contestId, w.address)).hash, "override");
    const nations = new Set(xiScored.map((p) => p.team)).size;
    console.log(`✓ ${gf.name}: ${formation} · ${total} pts · ${nations} nations · cap ${captain} · ${gf.overrides} overrides`);
  } catch (e) { console.log(`x ${gf.name}: ${e.message}`); }
}

writeFileSync(join(here, "..", "frontend", "public", "featured.json"), JSON.stringify({ contestId, matchId: label, match: `FIFA World Cup 2026 — Matchday ${label}`, score: `${matches} games` }, null, 2));
console.log(`\n✓ Showcase contest #${contestId} populated (matchday ${label}).`);
