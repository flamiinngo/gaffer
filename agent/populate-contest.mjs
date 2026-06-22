/**
 * Seeds a real AI-vs-AI showcase contest: several gaffers with DIFFERENT strategies,
 * each making real 0G-Compute picks on a real finished WC match, scored from real stats,
 * with varied autonomy multipliers — a live leaderboard the homepage can show.
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
const KEYS = [process.env.SPORTAPI_KEY, process.env.SPORTAPI_KEY_2, process.env.SPORTAPI_KEY_3, process.env.SPORTAPI_KEY_4, process.env.SPORTAPI_KEY_5].filter(Boolean);
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo.json"), "utf8"));
const pk = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const admin = new ethers.Wallet(pk, provider); // resolver + funder
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
  { name: "Total Attack", strat: "ultra-attacking: pick the most explosive forwards and attacking midfielders, maximize goal threat", overrides: 0 },
  { name: "The Catenaccio Kid", strat: "defensive masterclass: prioritize clean sheets, the strongest keeper and defenders", overrides: 1 },
  { name: "Moneyball", strat: "form and value: back in-form differentials and high-rating players over big names", overrides: 2 },
];

async function sofa(path) {
  for (const key of KEYS) {
    const res = await fetch(`https://${HOST}${path}`, { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": key } });
    if (res.status === 429 || res.status === 403) continue;
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return res.json();
  }
  throw new Error("keys exhausted");
}
const flagOf = (a2) => (!a2 || a2.length !== 2 ? "⚽" : String.fromCodePoint(...[...a2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))));
const POS = (p) => (p === "G" ? "GK" : p === "D" ? "DEF" : p === "M" ? "MID" : "FWD");
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function wait(hash, label) {
  for (let i = 0; i < 40; i++) { try { const r = await provider.getTransactionReceipt(hash); if (r) return r; } catch {} await delay(2000); }
  throw new Error(`${label}: no receipt`);
}
async function storeJSON(obj) {
  const file = new MemData(new TextEncoder().encode(JSON.stringify(obj)));
  const [tree, e] = await file.merkleTree(); if (e) throw e;
  const [, ue] = await indexer.upload(file, EVM_RPC, admin); if (ue) throw ue;
  return tree.rootHash();
}
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
async function pickXI(broker, provider_addr, endpoint, model, pool, strat, match) {
  const sys = `You are an elite AI football manager. Strategy: ${strat}. Pick a valid 4-3-3 (1 GK,4 DEF,3 MID,3 FWD) using ONLY the pool. Captain your best pick.`;
  const poolText = pool.map((p) => `${p.name} | ${p.pos} | ${p.team}`).join("\n");
  const user = `Match: ${match}.\nPOOL:\n${poolText}\n\nReturn ONLY JSON {"captain":"","reasoning":"<2 sentences>","xi":[{"name":"","pos":""}]} with 1 GK,4 DEF,3 MID,3 FWD.`;
  let content = "";
  for (let a = 0; a < 3; a++) {
    try {
      const headers = await broker.inference.getRequestHeaders(provider_addr, user);
      const res = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) });
      if (!res.ok) { await delay(2500); continue; }
      content = (await res.json()).choices?.[0]?.message?.content ?? ""; if (content) break;
    } catch { await delay(2500); }
  }
  const m = content.match(/\{[\s\S]*\}/); const parsed = m ? JSON.parse(m[0]) : { xi: [], captain: "", reasoning: "" };
  const need = { GK: 1, DEF: 4, MID: 3, FWD: 3 }, byPos = { GK: [], DEF: [], MID: [], FWD: [] }, used = new Set();
  const find = (nm) => pool.find((p) => norm(p.name) === norm(nm || ""));
  for (const pk of parsed.xi ?? []) { const pl = find(pk.name); if (pl && !used.has(pl.name) && byPos[pl.pos].length < need[pl.pos]) { byPos[pl.pos].push(pl); used.add(pl.name); } }
  for (const pos of Object.keys(need)) for (const p of pool.filter((x) => x.pos === pos && !used.has(x.name))) { if (byPos[pos].length >= need[pos]) break; byPos[pos].push(p); used.add(p.name); }
  const xi = [...byPos.GK, ...byPos.DEF, ...byPos.MID, ...byPos.FWD];
  const captain = parsed.captain && find(parsed.captain) && used.has(find(parsed.captain).name) ? find(parsed.captain).name : byPos.FWD[0]?.name;
  return { xi, captain, reasoning: parsed.reasoning || `${strat}.` };
}

// ---- main ----
console.log("Funder:", admin.address, ethers.formatEther(await provider.getBalance(admin.address)), "OG");

const { events } = await sofa(`/api/v1/sport/football/scheduled-events/2026-06-22`);
const fin = events.filter((e) => e.tournament?.name?.startsWith("FIFA World Cup") && e.status?.type === "finished");
fin.sort((a, b) => ((b.homeScore?.current ?? 0) + (b.awayScore?.current ?? 0)) - ((a.homeScore?.current ?? 0) + (a.awayScore?.current ?? 0)));
const g = fin[0];
const hs = g.homeScore?.current ?? 0, as = g.awayScore?.current ?? 0;
const home = { name: g.homeTeam.name, flag: flagOf(g.homeTeam.country?.alpha2), id: g.homeTeam.id };
const away = { name: g.awayTeam.name, flag: flagOf(g.awayTeam.country?.alpha2), id: g.awayTeam.id };
console.log(`Match: ${home.name} ${hs}-${as} ${away.name}`);

const pool = [];
for (const t of [home, away]) { const { players } = await sofa(`/api/v1/team/${t.id}/players`); for (const p of players) if (p.player?.name && p.player?.position) pool.push({ name: p.player.name, pos: POS(p.player.position), team: t.name, flag: t.flag }); }
const lu = await sofa(`/api/v1/event/${g.id}/lineups`);
const stats = new Map(); for (const s of ["home", "away"]) for (const p of lu[s]?.players ?? []) stats.set(norm(p.player.name), p.statistics ?? {});

const broker = await createZGComputeNetworkBroker(admin);
try { await broker.ledger.getLedger(); } catch { await broker.ledger.addLedger(3); }
const services = await broker.inference.listService();
const chat = services.find((s) => s.serviceType === "chatbot");
try { await broker.inference.acknowledgeProviderSigner(chat.provider); } catch {}
const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);

const contestId = Number(await adminContract.nextContestId());
const now = Math.floor(Date.now() / 1000);
const ct = await adminContract.createContest(`World Cup 2026 — ${home.name} v ${away.name}`, 0n, now + 7 * 86400, now + 30 * 86400);
await wait(ct.hash, "createContest");
console.log(`Contest #${contestId} created`);

const board = [];
for (const gf of GAFFERS) {
  try {
    const w = ethers.Wallet.createRandom().connect(provider);
    const ft = await admin.sendTransaction({ to: w.address, value: ethers.parseEther("0.02") });
    await wait(ft.hash, "fund");
    const { xi, captain, reasoning } = await pickXI(broker, chat.provider, endpoint, model, pool, gf.strat, `${home.name} vs ${away.name}`);
    let total = 0;
    const xiScored = xi.map((p) => { const c = p.team === home.name ? as : hs; const pts = fpl(stats.get(norm(p.name)) ?? {}, p.pos, c, p.name === captain); total += pts; return { ...p, points: pts, captain: p.name === captain }; });
    const decisionRoot = await storeJSON({ manager: w.address, managerName: gf.name, matchId: g.id, match: `${home.name} vs ${away.name}`, home, away, score: `${hs}-${as}`, formation: "4-3-3", captain, reasoning, xi: xiScored, totalPoints: total, model, ts: new Date().toISOString() });
    const configRoot = await storeJSON({ name: gf.name, strategy: gf.strat });
    const gc = new ethers.Contract(dep.address, ABI, w);
    const et = await gc.enterContest(contestId, `0g://${configRoot}`, { value: 0 }); await wait(et.hash, "enter");
    const rt = await adminContract.recordPoints(contestId, w.address, g.id, total, `0g://${decisionRoot}`); await wait(rt.hash, "points");
    for (let o = 0; o < gf.overrides; o++) { const ot = await adminContract.recordOverride(contestId, w.address); await wait(ot.hash, "override"); }
    board.push({ name: gf.name, address: w.address, points: total, overrides: gf.overrides });
    console.log(`✅ ${gf.name}: ${total} pts, ${gf.overrides} overrides, cap ${captain}`);
  } catch (e) { console.log(`✗ ${gf.name}: ${e.message}`); }
}

writeFileSync(join(here, "..", "frontend", "public", "featured.json"), JSON.stringify({ contestId, matchId: g.id, match: `${home.name} vs ${away.name}`, score: `${hs}-${as}` }, null, 2));
console.log(`\n✅ Showcase contest #${contestId} populated with ${board.length} gaffers.`);
