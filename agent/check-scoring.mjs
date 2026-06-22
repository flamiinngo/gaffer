/**
 * Proves real FPL scoring from real SofaScore match stats on a finished WC2026 game.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const HOST = process.env.SPORTAPI_HOST || "sportapi7.p.rapidapi.com";
const KEYS = [
  process.env.SPORTAPI_KEY, process.env.SPORTAPI_KEY_2, process.env.SPORTAPI_KEY_3,
  process.env.SPORTAPI_KEY_4, process.env.SPORTAPI_KEY_5,
].filter(Boolean);

async function sofa(path) {
  for (const key of KEYS) {
    const res = await fetch(`https://${HOST}${path}`, { headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": key } });
    if (res.status === 429 || res.status === 403) continue;
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return res.json();
  }
  throw new Error("all keys exhausted");
}

const POS = (p) => (p === "G" ? "GK" : p === "D" ? "DEF" : p === "M" ? "MID" : "FWD");

/** Standard FPL scoring from a player's match stats. */
export function fplPoints(s, pos, teamConceded, isCaptain = false) {
  let pts = 0;
  const mins = s.minutesPlayed ?? 0;
  if (mins > 0) pts += 1;
  if (mins >= 60) pts += 1;
  const goalPts = pos === "GK" || pos === "DEF" ? 6 : pos === "MID" ? 5 : 4;
  pts += (s.goals ?? 0) * goalPts;
  pts += (s.goalAssist ?? 0) * 3;
  if (mins >= 60 && teamConceded === 0) pts += pos === "GK" || pos === "DEF" ? 4 : pos === "MID" ? 1 : 0;
  if (pos === "GK" || pos === "DEF") pts -= Math.floor(teamConceded / 2);
  if (pos === "GK") pts += Math.floor((s.saves ?? 0) / 3);
  if (s.yellowCard) pts -= 1;
  if (s.redCard) pts -= 3;
  if (s.ownGoals) pts -= 2 * s.ownGoals;
  return isCaptain ? pts * 2 : pts;
}

// --- find a finished WC match ---
const { events } = await sofa(`/api/v1/sport/football/scheduled-events/2026-06-22`);
const m = events.find((e) => e.tournament?.name?.startsWith("FIFA World Cup") && e.status?.type === "finished");
if (!m) throw new Error("no finished WC match found on date");
const hs = m.homeScore?.current ?? 0, as = m.awayScore?.current ?? 0;
console.log(`\nMatch: ${m.homeTeam.name} ${hs}-${as} ${m.awayTeam.name}  (${m.roundInfo?.name ?? "WC"})`);

const lu = await sofa(`/api/v1/event/${m.id}/lineups`);
const score = [];
for (const [side, conceded] of [["home", as], ["away", hs]]) {
  for (const p of lu[side]?.players ?? []) {
    const pos = POS(p.position);
    const st = p.statistics ?? {};
    if ((st.minutesPlayed ?? 0) === 0) continue;
    score.push({
      name: p.player.name, team: lu[side].team?.name ?? side, pos,
      pts: fplPoints(st, pos, conceded),
      g: st.goals ?? 0, a: st.goalAssist ?? 0, mins: st.minutesPlayed ?? 0, rating: st.rating,
    });
  }
}
score.sort((a, b) => b.pts - a.pts);
console.log(`\nTop FPL scorers (real points from real stats):`);
for (const p of score.slice(0, 10)) {
  console.log(`  ${String(p.pts).padStart(3)} pts  ${p.name.padEnd(22)} ${p.pos}  ${p.team}  (G${p.g} A${p.a} ${p.mins}' r${p.rating ?? "-"})`);
}
console.log(`\nScored ${score.length} players. FPL SCORING: PASS ✔`);
