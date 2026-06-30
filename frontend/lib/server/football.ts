import "server-only";

/**
 * Football data client — SportAPI7 (SofaScore feed via RapidAPI).
 *
 * This is the REAL, CURRENT World Cup 2026 (verified: uniqueTournament 16, season 58210).
 * Free RapidAPI quota is limited, so every call is cached in-process with a long TTL.
 * If no key is configured, callers fall back to the static schedule.
 */

const HOST = process.env.SPORTAPI_HOST ?? "sportapi7.p.rapidapi.com";
const WC_TOURNAMENT = process.env.WC_TOURNAMENT_ID ?? "16";
const WC_SEASON = process.env.WC_SEASON_ID ?? "58210";

/**
 * Collect up to 5 API keys for daily-quota failover. Supports:
 *   SPORTAPI_KEY=...                (primary)
 *   SPORTAPI_KEYS=k1,k2,k3          (comma list)
 *   SPORTAPI_KEY_2 ... SPORTAPI_KEY_5
 */
function collectKeys(): string[] {
  const keys: string[] = [];
  const push = (v?: string) =>
    v?.split(",").map((s) => s.trim()).filter(Boolean).forEach((k) => {
      if (!keys.includes(k)) keys.push(k);
    });
  push(process.env.SPORTAPI_KEY);
  push(process.env.SPORTAPI_KEYS);
  for (let i = 2; i <= 5; i++) push(process.env[`SPORTAPI_KEY_${i}`]);
  return keys;
}

const KEYS = collectKeys();
const exhausted = new Map<string, number>(); // key -> time it hit its cap
const KEY_COOLDOWN = 1000 * 60 * 60 * 6; // retry an exhausted key after 6h

function availableKeys(): string[] {
  const now = Date.now();
  return KEYS.filter((k) => {
    const t = exhausted.get(k);
    return !t || now - t > KEY_COOLDOWN;
  });
}

export type FixtureTeam = { id: number; name: string; flag: string };
export type NormalizedFixture = {
  id: number;
  competition: string;
  home: FixtureTeam;
  away: FixtureTeam;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string; // ISO
  stage: string;
  status: string; // "notstarted" | "inprogress" | "finished"
};

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const TTL = 1000 * 60 * 15; // 15 min — fixtures/scores move during matches

export function hasFootballKey() {
  return KEYS.length > 0;
}

/** alpha-2 country code → flag emoji (regional indicators). */
function flagOf(alpha2?: string): string {
  if (!alpha2 || alpha2.length !== 2) return "⚽";
  const cp = [...alpha2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...cp);
}

async function sofaGet<T>(path: string): Promise<T | null> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < TTL) return cached.data as T;

  const keys = availableKeys();
  if (keys.length === 0) return null;

  for (const key of keys) {
    try {
      const res = await fetch(`https://${HOST}${path}`, {
        headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": key },
        cache: "no-store",
      });
      // Quota / auth exhaustion — mark this key down and fail over to the next.
      if (res.status === 429 || res.status === 403) {
        exhausted.set(key, Date.now());
        continue;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as T;
      cache.set(path, { at: Date.now(), data: json });
      return json;
    } catch {
      continue; // network blip — try the next key
    }
  }
  return null; // all keys exhausted or failing
}

type SofaTeam = { id: number; name: string; country?: { alpha2?: string }; alpha2?: string };
type SofaEvent = {
  id: number;
  homeTeam: SofaTeam;
  awayTeam: SofaTeam;
  homeScore?: { current?: number; penalties?: number };
  awayScore?: { current?: number; penalties?: number };
  startTimestamp: number;
  status?: { type?: string; description?: string };
  roundInfo?: { name?: string; round?: number };
  tournament?: { name?: string };
};

function normalize(e: SofaEvent): NormalizedFixture {
  const stage =
    e.roundInfo?.name ??
    (e.roundInfo?.round ? `Round ${e.roundInfo.round}` : e.tournament?.name ?? "");
  return {
    id: e.id,
    competition: e.tournament?.name ?? "FIFA World Cup",
    home: { id: e.homeTeam.id, name: e.homeTeam.name, flag: flagOf(e.homeTeam.country?.alpha2 ?? e.homeTeam.alpha2) },
    away: { id: e.awayTeam.id, name: e.awayTeam.name, flag: flagOf(e.awayTeam.country?.alpha2 ?? e.awayTeam.alpha2) },
    homeScore: e.homeScore?.current ?? null,
    awayScore: e.awayScore?.current ?? null,
    kickoff: new Date(e.startTimestamp * 1000).toISOString(),
    stage,
    status: e.status?.type ?? "notstarted",
  };
}

/** Upcoming World Cup fixtures (soonest first). Returns null if no key. */
export async function getUpcomingFixtures(limit = 6): Promise<NormalizedFixture[] | null> {
  if (!hasFootballKey()) return null;
  const data = await sofaGet<{ events: SofaEvent[] }>(
    `/api/v1/unique-tournament/${WC_TOURNAMENT}/season/${WC_SEASON}/events/next/0`
  );
  if (!data?.events) return null;
  return data.events
    .map(normalize)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))
    .slice(0, limit);
}

/** Most recent finished World Cup fixtures (newest first). */
export async function getRecentResults(limit = 6): Promise<NormalizedFixture[] | null> {
  if (!hasFootballKey()) return null;
  const data = await sofaGet<{ events: SofaEvent[] }>(
    `/api/v1/unique-tournament/${WC_TOURNAMENT}/season/${WC_SEASON}/events/last/0`
  );
  if (!data?.events) return null;
  return data.events
    .map(normalize)
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
    .slice(0, limit);
}

export type NationStatus = { status: "through" | "out" | "pending"; opponent?: string; kickoff?: string };

/**
 * Knockout survival map for the current round: each nation is "through" (won their tie),
 * "out" (lost), or "pending" (not kicked off). Powers the squad-survival UI — the signature
 * World-Cup mechanic (your squad is a portfolio of nations betting on who advances).
 */
export async function getRoundStatus(): Promise<{ round: string; nations: Record<string, NationStatus> } | null> {
  if (!hasFootballKey()) return null;
  const [last, next] = await Promise.all([
    sofaGet<{ events: SofaEvent[] }>(`/api/v1/unique-tournament/${WC_TOURNAMENT}/season/${WC_SEASON}/events/last/0`),
    sofaGet<{ events: SofaEvent[] }>(`/api/v1/unique-tournament/${WC_TOURNAMENT}/season/${WC_SEASON}/events/next/0`),
  ]);
  const all = [...(last?.events ?? []), ...(next?.events ?? [])];
  if (!all.length) return null;
  const rk = (e: SofaEvent) => String(e.roundInfo?.name ?? (e.roundInfo?.round ?? ""));
  const finished = all.filter((e) => e.status?.type === "finished").sort((a, b) => b.startTimestamp - a.startTimestamp);
  const round = finished[0] ? rk(finished[0]) : rk(all[0]);
  const fixtures = all.filter((e) => rk(e) === round);
  const nations: Record<string, NationStatus> = {};
  for (const e of fixtures) {
    const h = e.homeTeam?.name, a = e.awayTeam?.name;
    if (!h || !a) continue;
    if (e.status?.type === "finished") {
      const hs = (e.homeScore?.current ?? 0), as = (e.awayScore?.current ?? 0);
      const hp = e.homeScore?.penalties, ap = e.awayScore?.penalties;
      const homeThrough = hs !== as ? hs > as : (hp ?? 0) >= (ap ?? 0); // ties decided on penalties
      nations[h] = { status: homeThrough ? "through" : "out", opponent: a };
      nations[a] = { status: homeThrough ? "out" : "through", opponent: h };
    } else {
      const kickoff = new Date(e.startTimestamp * 1000).toISOString();
      nations[h] = { status: "pending", opponent: a, kickoff };
      nations[a] = { status: "pending", opponent: h, kickoff };
    }
  }
  return { round, nations };
}

export type PlayerStat = {
  id: number;
  name: string;
  position: string; // G/D/M/F
  team: string;
  minutes: number;
  goals: number;
  assists: number;
  rating: number;
};

/** Per-player stats for a finished event — the basis for fantasy scoring. */
export async function getEventPlayerStats(eventId: number): Promise<PlayerStat[] | null> {
  const data = await sofaGet<{
    home?: { players?: SofaLineupPlayer[]; team?: { name?: string } };
    away?: { players?: SofaLineupPlayer[]; team?: { name?: string } };
  }>(`/api/v1/event/${eventId}/lineups`);
  if (!data) return null;
  const collect = (side?: { players?: SofaLineupPlayer[]; team?: { name?: string } }) =>
    (side?.players ?? []).map((p) => ({
      id: p.player?.id ?? 0,
      name: p.player?.name ?? "—",
      position: p.position ?? "—",
      team: side?.team?.name ?? "",
      minutes: p.statistics?.minutesPlayed ?? 0,
      goals: p.statistics?.goals ?? 0,
      assists: p.statistics?.goalAssist ?? 0,
      rating: Number(p.statistics?.rating ?? 0),
    }));
  return [...collect(data.home), ...collect(data.away)];
}

type SofaLineupPlayer = {
  player?: { id?: number; name?: string };
  position?: string;
  statistics?: { minutesPlayed?: number; goals?: number; goalAssist?: number; rating?: number };
};
