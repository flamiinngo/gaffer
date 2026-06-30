/**
 * Competitions the protocol targets. World Cup 2026 is live (real SofaScore data + onchain
 * contests); the others are clearly marked "Soon" on the homepage. Live fixtures, squads and
 * results all come from the football feed (`lib/server/football.ts`) — nothing static here.
 */

export type Competition = {
  id: string; // slug
  name: string;
  kind: "cup" | "league";
  season: string;
  emblem: string;
  accent: string; // hex for UI theming
};

export const COMPETITIONS: Competition[] = [
  { id: "wc-2026", name: "FIFA World Cup", kind: "cup", season: "2026", emblem: "🏆", accent: "#FFB700" },
  { id: "epl-2526", name: "Premier League", kind: "league", season: "2025/26", emblem: "🦁", accent: "#00C853" },
  { id: "ucl-2526", name: "Champions League", kind: "cup", season: "2025/26", emblem: "✦", accent: "#7B8FBF" },
];
