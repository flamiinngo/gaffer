/**
 * Instant, client-side preview of the XI a gaffer *would* pick, from the real current
 * player pool, reacting live to the strategy sliders. This is a fast heuristic for the
 * onboarding "magic moment" — the deployed agent makes the real pick on 0G Compute each
 * matchday. No inference cost, no mock data: the pool is the actual matchday players.
 */
export type Kit = { primary: string; secondary: string };
export type PoolPlayer = {
  name: string;
  pos: "GK" | "DEF" | "MID" | "FWD";
  team: string;
  flag?: string;
  colors?: Kit | null;
  rating: number;
  points: number;
};
export type Sliders = { attack: number; risk: number; form: number; rotation: number };

type ProofAgent = { xi?: PoolPlayer[]; bench?: PoolPlayer[] };

/** Build a de-duplicated player pool from the current showcase decisions. */
export function poolFromProofs(agents: ProofAgent[]): PoolPlayer[] {
  const seen = new Map<string, PoolPlayer>();
  for (const a of agents) {
    for (const p of [...(a.xi ?? []), ...(a.bench ?? [])]) {
      if (!p?.name || seen.has(p.name)) continue;
      seen.set(p.name, {
        name: p.name,
        pos: p.pos,
        team: p.team,
        flag: p.flag,
        colors: p.colors ?? null,
        rating: Number(p.rating ?? 0),
        points: Number(p.points ?? 0),
      });
    }
  }
  return [...seen.values()];
}

const FORMATIONS: Record<string, [number, number, number]> = {
  "3-4-3": [3, 4, 3], "4-3-3": [4, 3, 3], "4-4-2": [4, 4, 2], "5-3-2": [5, 3, 2], "5-4-1": [5, 4, 1],
};

export function formationFor(attack: number): string {
  if (attack >= 70) return "3-4-3";
  if (attack >= 55) return "4-3-3";
  if (attack >= 45) return "4-4-2";
  if (attack >= 35) return "5-3-2";
  return "5-4-1";
}

// stable per-name jitter in [-0.5, 0.5]
function jitter(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return h / 997 - 0.5;
}

export type Persona = { title: string; tagline: string };

export function personaFor(s: Sliders): Persona {
  if (s.attack >= 68 && s.risk >= 60) return { title: "The Cavalier", tagline: "All-out attack — damn the consequences." };
  if (s.attack <= 38) return { title: "The Catenaccio", tagline: "Clean sheets win tournaments." };
  if (s.risk >= 68) return { title: "The Differential King", tagline: "Points nobody else dares to take." };
  if (s.form >= 68) return { title: "The Form Hunter", tagline: "Backs whoever's hot, drops whoever's not." };
  if (s.attack >= 58) return { title: "The Front-Foot Gaffer", tagline: "Take the game to them." };
  if (s.rotation >= 65) return { title: "The Rotator", tagline: "Fresh legs, every matchday." };
  return { title: "The Tactician", tagline: "Balance, value and a cool head." };
}

/** Pick a preview XI from the pool given the sliders. */
export function buildPreviewXI(pool: PoolPlayer[], s: Sliders): { xi: PoolPlayer[]; formation: string; captain: string } {
  const formation = formationFor(s.attack);
  const [D, M, F] = FORMATIONS[formation];
  const need: Record<PoolPlayer["pos"], number> = { GK: 1, DEF: D, MID: M, FWD: F };
  const wForm = s.form / 100; // form weight vs reputation
  const riskW = s.risk / 100;

  const score = (p: PoolPlayer) =>
    wForm * Math.min(p.points, 15) / 15 +
    (1 - wForm) * Math.min(p.rating, 10) / 10 +
    jitter(p.name) * riskW * 0.45;

  const byPos: Record<PoolPlayer["pos"], PoolPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of pool) (byPos[p.pos] ?? byPos.FWD).push(p);
  for (const k of Object.keys(byPos) as PoolPlayer["pos"][]) byPos[k].sort((a, b) => score(b) - score(a));

  const xi: PoolPlayer[] = [];
  (["GK", "DEF", "MID", "FWD"] as const).forEach((pos) => {
    xi.push(...byPos[pos].slice(0, need[pos]));
  });
  // captain = best-scoring outfield pick
  const captain = [...xi].filter((p) => p.pos !== "GK").sort((a, b) => score(b) - score(a))[0]?.name ?? xi[0]?.name ?? "";
  return { xi, formation, captain };
}
