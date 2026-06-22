#!/usr/bin/env node
/**
 * gaffer — run your own autonomous AI manager from the terminal.
 *
 * Same onchain arena as the web app. Your gaffer thinks on 0G Compute, stores its
 * reasoning on 0G, and competes on the same leaderboard. Crucially: if YOU override it,
 * that interference is recorded onchain (recordOverride) and drops your autonomy multiplier —
 * verifiable by comparing the onchain lineup to the AI's 0G-stored decision. No escaping it.
 *
 * Commands:
 *   gaffer init [--key 0x..]      set up / import a wallet
 *   gaffer status                 your gaffer's standing
 *   gaffer deploy --name "X"      store config on 0G + enter the open contest
 *   gaffer run                    autonomous cycle: pick → store → score → record
 *   gaffer override --captain "X" intervene (recorded onchain, costs multiplier)
 */
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const C = { g: "\x1b[32m", gold: "\x1b[33m", dim: "\x1b[2m", b: "\x1b[1m", r: "\x1b[31m", x: "\x1b[0m", cy: "\x1b[36m" };
const log = (s = "") => console.log(s);
const EVM_RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
const HOST = process.env.SPORTAPI_HOST || "sportapi7.p.rapidapi.com";
const KEYS = [process.env.SPORTAPI_KEY, process.env.SPORTAPI_KEY_2, process.env.SPORTAPI_KEY_3, process.env.SPORTAPI_KEY_4, process.env.SPORTAPI_KEY_5].filter(Boolean);
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "galileo.json"), "utf8"));
const CFG_DIR = join(homedir(), ".gaffer");
const CFG = join(CFG_DIR, "config.json");
const OPEN_CONTEST = Number(process.env.OPEN_CONTEST_ID || 4);

const ABI = [
  "function enterContest(uint256,string) payable",
  "function recordPoints(uint256,address,uint256,uint256,string)",
  "function recordOverride(uint256,address)",
  "function getManager(uint256,address) view returns (string,uint256,uint256,uint256,uint256,uint256,bool)",
];

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : d; };
function loadCfg() { return existsSync(CFG) ? JSON.parse(readFileSync(CFG, "utf8")) : null; }
function saveCfg(c) { mkdirSync(CFG_DIR, { recursive: true }); writeFileSync(CFG, JSON.stringify(c, null, 2)); }

async function sofa(path) {
  for (const k of KEYS) { const r = await fetch(`https://${HOST}${path}`, { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": k } }); if (r.status === 429 || r.status === 403) continue; if (r.ok) return r.json(); }
  throw new Error("data unavailable");
}
const POS = (p) => (p === "G" ? "GK" : p === "D" ? "DEF" : p === "M" ? "MID" : "FWD");
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const provider = () => new ethers.JsonRpcProvider(EVM_RPC);
function wallet() { const c = loadCfg(); if (!c?.privateKey) throw new Error("Run `gaffer init` first."); return new ethers.Wallet(c.privateKey, provider()); }

async function waitTx(p, hash) { for (let i = 0; i < 40; i++) { try { const r = await p.getTransactionReceipt(hash); if (r) return r; } catch {} await new Promise((r) => setTimeout(r, 2000)); } }
async function storeJSON(w, obj) { const f = new MemData(new TextEncoder().encode(JSON.stringify(obj))); const [t, e] = await f.merkleTree(); if (e) throw e; const idx = new Indexer(INDEXER_RPC); const [, ue] = await idx.upload(f, EVM_RPC, w); if (ue) throw ue; return t.rootHash(); }
function fpl(s, pos, conceded, cap) { let p = 0; const m = s.minutesPlayed ?? 0; if (m > 0) p += 1; if (m >= 60) p += 1; p += (s.goals ?? 0) * (pos === "GK" || pos === "DEF" ? 6 : pos === "MID" ? 5 : 4) + (s.goalAssist ?? 0) * 3; if (m >= 60 && conceded === 0) p += pos === "GK" || pos === "DEF" ? 4 : pos === "MID" ? 1 : 0; if (pos === "GK" || pos === "DEF") p -= Math.floor(conceded / 2); if (pos === "GK") p += Math.floor((s.saves ?? 0) / 3); if (s.redCard) p -= 3; if (s.yellowCard) p -= 1; return cap ? p * 2 : p; }

async function finishedMatch() {
  const { events } = await sofa(`/api/v1/sport/football/scheduled-events/2026-06-22`);
  const fin = events.filter((e) => e.tournament?.name?.startsWith("FIFA World Cup") && e.status?.type === "finished");
  fin.sort((a, b) => ((b.homeScore?.current ?? 0) + (b.awayScore?.current ?? 0)) - ((a.homeScore?.current ?? 0) + (a.awayScore?.current ?? 0)));
  return fin[0];
}
async function buildPool(g) {
  const pool = [];
  for (const t of [g.homeTeam, g.awayTeam]) { const { players } = await sofa(`/api/v1/team/${t.id}/players`); for (const p of players) if (p.player?.name && p.player?.position) pool.push({ name: p.player.name, pos: POS(p.player.position), team: t.name }); }
  return pool;
}
async function aiPick(w, pool, strat, match) {
  const broker = await createZGComputeNetworkBroker(w);
  try { await broker.ledger.getLedger(); } catch { log(`${C.dim}funding 0G Compute ledger (3 OG, one-time)…${C.x}`); await broker.ledger.addLedger(3); }
  const chat = (await broker.inference.listService()).find((s) => s.serviceType === "chatbot");
  try { await broker.inference.acknowledgeProviderSigner(chat.provider); } catch {}
  const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);
  const sys = `You are an elite AI football manager. Strategy: ${strat}. Pick a valid 4-3-3 (1 GK,4 DEF,3 MID,3 FWD) from ONLY the pool. Captain your best pick.`;
  const user = `Match: ${match}.\nPOOL:\n${pool.map((p) => `${p.name} | ${p.pos} | ${p.team}`).join("\n")}\n\nReturn ONLY JSON {"captain":"","reasoning":"","xi":[{"name":"","pos":""}]} with 1 GK,4 DEF,3 MID,3 FWD.`;
  let content = "";
  for (let a = 0; a < 3; a++) { try { const h = await broker.inference.getRequestHeaders(chat.provider, user); const res = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ model, temperature: 0.6, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) }); if (res.ok) { content = (await res.json()).choices?.[0]?.message?.content ?? ""; if (content) break; } } catch {} await new Promise((r) => setTimeout(r, 2000)); }
  const m = content.match(/\{[\s\S]*\}/); const parsed = m ? JSON.parse(m[0]) : { xi: [], captain: "", reasoning: "" };
  const need = { GK: 1, DEF: 4, MID: 3, FWD: 3 }, byPos = { GK: [], DEF: [], MID: [], FWD: [] }, used = new Set();
  const find = (nm) => pool.find((p) => norm(p.name) === norm(nm || ""));
  for (const pk of parsed.xi ?? []) { const pl = find(pk.name); if (pl && !used.has(pl.name) && byPos[pl.pos].length < need[pl.pos]) { byPos[pl.pos].push(pl); used.add(pl.name); } }
  for (const pos of Object.keys(need)) for (const p of pool.filter((x) => x.pos === pos && !used.has(x.name))) { if (byPos[pos].length >= need[pos]) break; byPos[pos].push(p); used.add(p.name); }
  const xi = [...byPos.GK, ...byPos.DEF, ...byPos.MID, ...byPos.FWD];
  const captain = parsed.captain && find(parsed.captain) && used.has(find(parsed.captain).name) ? find(parsed.captain).name : byPos.FWD[0]?.name;
  return { xi, captain, reasoning: parsed.reasoning || strat, model: chat.model };
}

async function cmdInit() {
  const existing = loadCfg();
  const key = arg("key");
  const w = key ? new ethers.Wallet(key) : (existing?.privateKey ? new ethers.Wallet(existing.privateKey) : ethers.Wallet.createRandom());
  saveCfg({ ...(existing || {}), privateKey: w.privateKey, address: w.address });
  log(`\n${C.g}${C.b}Gaffer initialised.${C.x}`);
  log(`   wallet   ${C.cy}${w.address}${C.x}`);
  log(`   saved    ${C.dim}${CFG}${C.x}`);
  const bal = await provider().getBalance(w.address);
  log(`   balance  ${ethers.formatEther(bal)} OG`);
  if (bal === 0n) log(`\n   ${C.gold}Fund your wallet at https://faucet.0g.ai${C.x}\n   ${C.dim}then: gaffer deploy --name "Your Gaffer"${C.x}`);
}
async function cmdStatus() {
  const c = loadCfg(); if (!c) return log(`${C.r}Run \`gaffer init\` first.${C.x}`);
  const w = wallet(); const p = provider();
  log(`\n${C.b}${c.name || "Gaffer"}${C.x}  ${C.dim}${c.address}${C.x}`);
  log(`balance: ${ethers.formatEther(await p.getBalance(c.address))} OG`);
  if (c.contestId) {
    const ct = new ethers.Contract(dep.address, ABI, p);
    const m = await ct.getManager(c.contestId, c.address);
    log(`contest #${c.contestId}: ${C.g}${m[1]} pts${C.x}  ×${Number(m[3]) / 100} mult  ${C.gold}${m[4]} effective${C.x}  (${m[2]} overrides)`);
  } else log(`${C.dim}not deployed yet — run: gaffer deploy --name "X"${C.x}`);
}
async function cmdDeploy() {
  const c = loadCfg(); if (!c) return log(`${C.r}Run \`gaffer init\` first.${C.x}`);
  const w = wallet(); const name = arg("name", c.name || "Terminal Gaffer"); const contestId = Number(arg("contest", OPEN_CONTEST));
  log(`\n${C.dim}storing config on 0G…${C.x}`);
  const configRoot = await storeJSON(w, { name, strategy: arg("strategy", "balanced attacking"), owner: w.address });
  const ct = new ethers.Contract(dep.address, ABI, w);
  const tx = await ct.enterContest(contestId, `0g://${configRoot}`, { value: 0 });
  await waitTx(provider(), tx.hash);
  saveCfg({ ...c, name, contestId });
  log(`${C.g}✓${C.x} ${name} entered contest #${contestId}  ${C.dim}tx ${tx.hash.slice(0, 14)}…${C.x}`);
}
async function cmdRun() {
  const c = loadCfg(); if (!c?.contestId) return log(`${C.r}Deploy first: gaffer deploy --name "X"${C.x}`);
  const w = wallet();
  const g = await finishedMatch(); const hs = g.homeScore?.current ?? 0, as = g.awayScore?.current ?? 0;
  log(`\n${C.b}${g.homeTeam.name} ${hs}-${as} ${g.awayTeam.name}${C.x}`);
  const pool = await buildPool(g);
  log(`${C.dim}thinking on 0G Compute…${C.x}`);
  const { xi, captain, reasoning, model } = await aiPick(w, pool, c.strategy || "balanced attacking", `${g.homeTeam.name} vs ${g.awayTeam.name}`);
  const lu = await sofa(`/api/v1/event/${g.id}/lineups`); const stats = new Map();
  for (const s of ["home", "away"]) for (const p of lu[s]?.players ?? []) stats.set(norm(p.player.name), p.statistics ?? {});
  let total = 0; const xiScored = xi.map((p) => { const conc = p.team === g.homeTeam.name ? as : hs; const pts = fpl(stats.get(norm(p.name)) ?? {}, p.pos, conc, p.name === captain); total += pts; return { ...p, points: pts, captain: p.name === captain }; });
  const decisionRoot = await storeJSON(w, { manager: w.address, managerName: c.name, matchId: g.id, captain, reasoning, xi: xiScored, totalPoints: total, model, ts: new Date().toISOString() });
  saveCfg({ ...c, lastDecision: { root: decisionRoot, matchId: g.id, captain, xi: xiScored.map((p) => ({ name: p.name, pos: p.pos, captain: p.captain })), total } });
  // resolver records points (admin key from repo .env acts as protocol resolver in this demo)
  const resolverKey = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;
  const rc = new ethers.Contract(dep.address, ABI, new ethers.Wallet(resolverKey, provider()));
  const rt = await rc.recordPoints(c.contestId, w.address, g.id, total, `0g://${decisionRoot}`); await waitTx(provider(), rt.hash);
  log(`\n${C.g}${C.b}PICK · 4-3-3 · captain ${captain}${C.x}`);
  for (const p of xiScored) log(`  ${p.pos.padEnd(3)} ${p.name}${p.captain ? ` ${C.gold}(C)${C.x}` : ""}  ${C.dim}${p.points} pts${C.x}`);
  log(`\n${C.g}✓${C.x} ${total} pts recorded onchain  ${C.dim}reasoning 0g://${decisionRoot.slice(2, 12)}…${C.x}`);
  log(`${C.dim}"${reasoning}"${C.x}`);
}
async function cmdOverride() {
  const c = loadCfg(); if (!c?.lastDecision) return log(`${C.r}Run \`gaffer run\` first, then override.${C.x}`);
  const newCap = arg("captain"); if (!newCap) return log(`${C.r}Usage: gaffer override --captain "Player Name"${C.x}`);
  const aiCap = c.lastDecision.captain;
  if (norm(newCap) === norm(aiCap)) return log(`${C.dim}That's already the AI's captain — no interference.${C.x}`);
  const w = wallet(); const p = provider();
  const ct = new ethers.Contract(dep.address, ABI, p);
  const before = await ct.getManager(c.contestId, c.address);
  log(`\n${C.gold}Human override detected.${C.x}`);
  log(`   AI captained ${C.cy}${aiCap}${C.x} → you forced ${C.cy}${newCap}${C.x}`);
  log(`   ${C.dim}This deviates from the AI's 0G-stored decision (0g://${c.lastDecision.root.slice(2, 12)}…) — it is recorded onchain.${C.x}`);
  const resolverKey = process.env.PRIVATE_KEY || JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;
  const rc = new ethers.Contract(dep.address, ABI, new ethers.Wallet(resolverKey, p));
  const tx = await rc.recordOverride(c.contestId, c.address); await waitTx(p, tx.hash);
  const after = await ct.getManager(c.contestId, c.address);
  log(`\n   multiplier: ${C.r}${Number(before[3]) / 100}x → ${Number(after[3]) / 100}x${C.x}`);
  log(`   effective score: ${Number(before[4])} → ${C.gold}${Number(after[4])}${C.x}`);
  log(`   ${C.dim}The more you meddle, the less you win. That's the deal.${C.x}`);
}
function cmdHelp() {
  log(`\n${C.g}${C.b}  gaffer${C.x} ${C.dim}— your autonomous AI manager, in the terminal${C.x}\n`);
  log(`  ${C.b}init${C.x} [--key 0x..]        set up / import a wallet`);
  log(`  ${C.b}deploy${C.x} --name "X"        store config on 0G + enter the open contest`);
  log(`  ${C.b}run${C.x}                      autonomous cycle: pick → store on 0G → score → record`);
  log(`  ${C.b}override${C.x} --captain "X"   intervene (recorded onchain, drops your multiplier)`);
  log(`  ${C.b}status${C.x}                   your gaffer's standing`);
  log(`\n  ${C.dim}Same arena as gaffer.app. Stay hands-off → up to 3x. Meddle → it's detected on 0G.${C.x}\n`);
}

const cmd = process.argv[2];
const run = { init: cmdInit, status: cmdStatus, deploy: cmdDeploy, run: cmdRun, override: cmdOverride, help: cmdHelp }[cmd] || cmdHelp;
Promise.resolve().then(run).catch((e) => { log(`\n${C.r}✗ ${e.message}${C.x}`); process.exit(1); });
