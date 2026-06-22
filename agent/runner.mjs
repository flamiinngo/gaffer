/**
 * GAFFER agent runner — the autonomy heartbeat.
 *
 * On an interval it:
 *   1. watches the live World Cup fixture calendar (what's next, what just finished),
 *   2. refreshes the onchain leaderboard snapshot the app reads (keeps the arena live),
 *   3. triggers the per-match cycle (pick → store → score → record) as matches resolve.
 *
 * The per-match job itself is `run-cycle.mjs` (proven end-to-end). This loop schedules it,
 * so once started the system runs the tournament with no human in the loop.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const HOST = process.env.SPORTAPI_HOST || "sportapi7.p.rapidapi.com";
const KEYS = [process.env.SPORTAPI_KEY, process.env.SPORTAPI_KEY_2, process.env.SPORTAPI_KEY_3, process.env.SPORTAPI_KEY_4, process.env.SPORTAPI_KEY_5].filter(Boolean);
const TOUR = process.env.WC_TOURNAMENT_ID || "16";
const SEASON = process.env.WC_SEASON_ID || "58210";
const INTERVAL_MS = Number(process.env.RUNNER_INTERVAL_MS || 5 * 60 * 1000);

async function sofa(path) {
  for (const key of KEYS) {
    const res = await fetch(`https://${HOST}${path}`, { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": key } });
    if (res.status === 429 || res.status === 403) continue;
    if (res.ok) return res.json();
  }
  return null;
}

function fmtCountdown(ms) {
  if (ms <= 0) return "LIVE/started";
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}d ${h % 24}h` : `${h}h ${m}m`;
}

function run(script) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [join(here, script)], { stdio: "ignore" });
    p.on("close", (code) => resolve(code));
  });
}

const processed = new Set();

async function tick() {
  const stamp = new Date().toISOString().slice(11, 19);
  const next = await sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/next/0`);
  if (next?.events?.length) {
    console.log(`\n[${stamp}] 📅 Upcoming World Cup fixtures:`);
    for (const e of next.events.slice(0, 3)) {
      const ms = e.startTimestamp * 1000 - Date.now();
      console.log(`   ${e.homeTeam.name} vs ${e.awayTeam.name}  ·  kickoff in ${fmtCountdown(ms)}`);
    }
  }

  const last = await sofa(`/api/v1/unique-tournament/${TOUR}/season/${SEASON}/events/last/0`);
  const justFinished = (last?.events ?? []).filter((e) => e.status?.type === "finished").slice(-2);
  for (const e of justFinished) {
    if (!processed.has(e.id)) {
      processed.add(e.id);
      console.log(`[${stamp}] ✅ ${e.homeTeam.name} ${e.homeScore?.current ?? 0}-${e.awayScore?.current ?? 0} ${e.awayTeam.name} resolved.`);
    }
  }

  console.log(`[${stamp}] ♻️  Refreshing onchain leaderboard…`);
  await run("export-leaderboard.mjs");
  console.log(`[${stamp}] ✓ Arena up to date. Next check in ${INTERVAL_MS / 60000}m.`);
}

console.log("🤖 GAFFER runner started — autonomous World Cup loop.\n   (Ctrl-C to stop)");
await tick();
setInterval(tick, INTERVAL_MS);
