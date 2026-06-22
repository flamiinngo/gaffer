import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

// ---------- SofaScore data (with key rotation) ----------
const HOST = process.env.SPORTAPI_HOST || "sportapi7.p.rapidapi.com";
const KEYS = [
  process.env.SPORTAPI_KEY,
  process.env.SPORTAPI_KEY_2,
  process.env.SPORTAPI_KEY_3,
  process.env.SPORTAPI_KEY_4,
  process.env.SPORTAPI_KEY_5,
].filter(Boolean);

async function sofa(path) {
  for (const key of KEYS) {
    const res = await fetch(`https://${HOST}${path}`, {
      headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": key },
    });
    if (res.status === 429 || res.status === 403) continue;
    if (!res.ok) throw new Error(`SofaScore ${path} -> ${res.status}`);
    return res.json();
  }
  throw new Error("All SofaScore keys exhausted");
}

async function buildPlayerPool() {
  const tid = process.env.WC_TOURNAMENT_ID || "16";
  const sid = process.env.WC_SEASON_ID || "58210";
  const { events } = await sofa(`/api/v1/unique-tournament/${tid}/season/${sid}/events/next/0`);
  const fixture = events[0];
  const teams = [fixture.homeTeam, fixture.awayTeam];
  console.log(`\n⚽ Next fixture: ${teams[0].name} vs ${teams[1].name} (${fixture.roundInfo?.name ?? "WC2026"})`);

  const pool = [];
  for (const t of teams) {
    const { players } = await sofa(`/api/v1/team/${t.id}/players`);
    for (const p of players) {
      const pl = p.player;
      if (!pl?.name || !pl?.position) continue;
      pool.push({ name: pl.name, pos: pl.position, team: t.name });
    }
  }
  console.log(`   Player pool: ${pool.length} real players from ${teams[0].name} & ${teams[1].name}`);
  return { fixture, teams, pool };
}

// ---------- 0G Compute inference ----------
async function getBroker() {
  const RPC = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
  const pk =
    process.env.PRIVATE_KEY ||
    JSON.parse(readFileSync(join(here, "..", ".deployer-wallet.json"), "utf8")).privateKey;
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(pk, provider);
  console.log(`\n🔑 Agent wallet: ${wallet.address}`);
  console.log(`   Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} OG`);
  const broker = await createZGComputeNetworkBroker(wallet);
  return broker;
}

async function ensureLedger(broker) {
  try {
    const l = await broker.ledger.getLedger();
    console.log(`   Ledger exists. Balance: ${ethers.formatEther(l.totalBalance ?? l.balance ?? 0n)} OG`);
  } catch {
    const amount = Number(process.env.LEDGER_OG || 3); // testnet minimum is 3 OG
    console.log(`   No ledger — creating + funding with ${amount} OG…`);
    await broker.ledger.addLedger(amount);
    console.log("   ✅ Ledger funded.");
  }
}

async function pickProvider(broker) {
  const services = await broker.inference.listService();
  const chat = services.find((s) => s.serviceType === "chatbot");
  if (!chat) throw new Error("No chatbot provider available on testnet right now");
  console.log(`\n🧠 Brain: ${chat.model} (provider ${chat.provider})`);
  try {
    await broker.inference.acknowledgeProviderSigner(chat.provider);
  } catch (e) {
    console.log(`   (ack note: ${e.message.split("\n")[0]})`);
  }
  return chat.provider;
}

async function runInference(broker, provider, pool, fixture) {
  const { endpoint, model } = await broker.inference.getServiceMetadata(provider);

  const system =
    "You are GAFFER, an elite autonomous AI football manager. Strategy: attacking bias, " +
    "back in-form and high-ceiling players, captain your most explosive attacker. " +
    "Pick a valid 4-3-3 starting XI using ONLY players from the provided pool.";

  const poolText = pool.map((p) => `${p.name} | ${p.pos} | ${p.team}`).join("\n");
  const user =
    `Match: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}.\n\n` +
    `PLAYER POOL (name | position G/D/M/F | team):\n${poolText}\n\n` +
    `Return ONLY compact JSON, no markdown:\n` +
    `{"formation":"4-3-3","captain":"<name>","reasoning":"<2 sentences>",` +
    `"xi":[{"name":"","pos":"","team":""}]} with exactly 1 G, 4 D, 3 M, 3 F.`;

  const headers = await broker.inference.getRequestHeaders(provider, user);
  console.log("\n📡 Calling 0G Compute inference…");
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error(`inference ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parsePick(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// ---------- main ----------
const { fixture, pool } = await buildPlayerPool();
const broker = await getBroker();
await ensureLedger(broker);
const provider = await pickProvider(broker);
const raw = await runInference(broker, provider, pool, fixture);

console.log("\n================ GAFFER'S PICK ================");
const pick = parsePick(raw);
if (pick) {
  console.log(`Formation: ${pick.formation}  |  Captain: ${pick.captain}`);
  console.log(`Reasoning: ${pick.reasoning}\n`);
  for (const p of pick.xi ?? []) {
    const c = p.name === pick.captain ? " (C)" : "";
    console.log(`  ${p.pos.padEnd(2)}  ${p.name}${c}  — ${p.team}`);
  }
} else {
  console.log(raw);
}
console.log("==============================================");
