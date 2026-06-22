/**
 * Football competition reference data (multi-competition).
 *
 * Static metadata (teams, competitions, API-Football league IDs) lives here.
 * Fixtures are the *schedule fallback*: once RAPIDAPI_KEY is set, the agent service
 * swaps these for live API-Football fixtures. Kickoffs are real ISO timestamps so
 * countdowns behave correctly.
 */

export type Team = { name: string; short: string; flag: string };

export const TEAMS: Record<string, Team> = {
  // National
  ARG: { name: "Argentina", short: "ARG", flag: "🇦🇷" },
  FRA: { name: "France", short: "FRA", flag: "🇫🇷" },
  BRA: { name: "Brazil", short: "BRA", flag: "🇧🇷" },
  ENG: { name: "England", short: "ENG", flag: "🏴" },
  ESP: { name: "Spain", short: "ESP", flag: "🇪🇸" },
  POR: { name: "Portugal", short: "POR", flag: "🇵🇹" },
  NED: { name: "Netherlands", short: "NED", flag: "🇳🇱" },
  GER: { name: "Germany", short: "GER", flag: "🇩🇪" },
  USA: { name: "USA", short: "USA", flag: "🇺🇸" },
  MEX: { name: "Mexico", short: "MEX", flag: "🇲🇽" },
  CRO: { name: "Croatia", short: "CRO", flag: "🇭🇷" },
  MAR: { name: "Morocco", short: "MAR", flag: "🇲🇦" },
  // Clubs
  MCI: { name: "Manchester City", short: "MCI", flag: "🩵" },
  ARS: { name: "Arsenal", short: "ARS", flag: "🔴" },
  LIV: { name: "Liverpool", short: "LIV", flag: "🔴" },
  RMA: { name: "Real Madrid", short: "RMA", flag: "⚪" },
  BAR: { name: "Barcelona", short: "BAR", flag: "🔵" },
  BAY: { name: "Bayern München", short: "BAY", flag: "🔴" },
  INT: { name: "Inter", short: "INT", flag: "🔵" },
  PSG: { name: "Paris SG", short: "PSG", flag: "🔵" },
};

export type Competition = {
  id: string; // slug
  name: string;
  kind: "cup" | "league";
  season: string;
  emblem: string;
  apiLeagueId: number; // API-Football league id (real)
  accent: string; // hex for UI theming
};

export const COMPETITIONS: Competition[] = [
  { id: "wc-2026", name: "FIFA World Cup", kind: "cup", season: "2026", emblem: "🏆", apiLeagueId: 1, accent: "#FFB700" },
  { id: "epl-2526", name: "Premier League", kind: "league", season: "2025/26", emblem: "🦁", apiLeagueId: 39, accent: "#00C853" },
  { id: "ucl-2526", name: "Champions League", kind: "cup", season: "2025/26", emblem: "✦", apiLeagueId: 2, accent: "#7B8FBF" },
];

export type Fixture = {
  id: number;
  competitionId: string;
  home: string;
  away: string;
  kickoff: string; // ISO
  stage: string;
  venue: string;
};

/** Upcoming fixtures across competitions (schedule fallback). */
export const FIXTURES: Fixture[] = [
  { id: 49, competitionId: "wc-2026", home: "ARG", away: "NED", kickoff: "2026-06-22T19:00:00Z", stage: "Round of 16", venue: "MetLife Stadium" },
  { id: 50, competitionId: "wc-2026", home: "FRA", away: "MAR", kickoff: "2026-06-22T23:00:00Z", stage: "Round of 16", venue: "SoFi Stadium" },
  { id: 51, competitionId: "wc-2026", home: "ENG", away: "CRO", kickoff: "2026-06-23T19:00:00Z", stage: "Round of 16", venue: "AT&T Stadium" },
  { id: 52, competitionId: "wc-2026", home: "BRA", away: "MEX", kickoff: "2026-06-23T23:00:00Z", stage: "Round of 16", venue: "Estadio Azteca" },
  { id: 60, competitionId: "ucl-2526", home: "RMA", away: "BAY", kickoff: "2026-06-24T19:00:00Z", stage: "Final", venue: "Wembley Stadium" },
];

export function teamOf(code: string): Team {
  return TEAMS[code] ?? { name: code, short: code, flag: "🏳️" };
}

export function competitionOf(id: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === id);
}

export function upcomingFixtures(limit = 4, now = Date.now()): Fixture[] {
  return FIXTURES.filter((f) => new Date(f.kickoff).getTime() > now)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))
    .slice(0, limit);
}
