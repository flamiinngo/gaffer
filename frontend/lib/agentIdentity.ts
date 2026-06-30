/**
 * Every gaffer gets a distinct identity — a crest colour + an archetype — so no agent is a blank.
 * Deterministic from (agentId, name): the same agent always looks the same everywhere it appears.
 */

export type Palette = { primary: string; secondary: string; ink: string };

const PALETTES: Palette[] = [
  { primary: "#00C853", secondary: "#0C2A1E", ink: "#04140C" }, // grass
  { primary: "#FFB700", secondary: "#2E2400", ink: "#171200" }, // gold
  { primary: "#FF3B5C", secondary: "#330011", ink: "#1a0008" }, // crimson
  { primary: "#00B8D4", secondary: "#042830", ink: "#001318" }, // cyan
  { primary: "#AB47BC", secondary: "#250a2e", ink: "#14041a" }, // violet
  { primary: "#7B8FBF", secondary: "#141c30", ink: "#0a0e1a" }, // steel
  { primary: "#FF7043", secondary: "#2e1409", ink: "#1a0a04" }, // ember
  { primary: "#26C6A6", secondary: "#08302a", ink: "#041a16" }, // teal
];

export const TIER_RING = ["#7B8FBF", "#00C853", "#FFB700", "#CE93D8"]; // Rookie, Pro, Elite, Legend

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function initialsOf(name?: string): string {
  const parts = (name ?? "AI").replace(/^the\s+/i, "").split(/\s+/).filter(Boolean);
  const ini = parts.map((w) => w[0]).join("");
  return (ini || "AI").slice(0, 2).toUpperCase();
}

export function identityFor(agentId: number | string, name?: string) {
  // Seed by NAME when present (so the deploy preview matches the deployed bot exactly), else by id.
  const key = name && name.trim() ? name.toLowerCase().trim() : String(agentId);
  const h = hash(key);
  return {
    seed: h,
    palette: PALETTES[h % PALETTES.length],
    pattern: h % 3, // crest backdrop variant
    initials: initialsOf(name),
    // Gaffer-bot features — deterministic per agent so every manager is a distinct robot.
    bot: {
      head: h % 3, // 0 round, 1 tall, 2 rounded-square
      eyes: (h >> 2) % 3, // 0 big round, 1 visor bar, 2 single cyclops
      antenna: (h >> 4) % 3, // 0 none, 1 single ball, 2 twin
      mood: (h >> 6) % 3, // 0 friendly, 1 focused, 2 cheeky
    },
  };
}

export type Archetype = { tag: string; line: string };

// Hand-tuned reputations for the house + veteran gaffers; everyone else gets a deterministic one.
const CURATED: Record<string, Archetype> = {
  "total attack": { tag: "The Cavalier", line: "All-out attack, no apologies." },
  "the catenaccio kid": { tag: "The Wall", line: "Clean sheets win tournaments." },
  "moneyball": { tag: "The Analyst", line: "Every point per million counts." },
  "el profesor": { tag: "The Professor", line: "Runs the game through the middle." },
  "the alchemist": { tag: "The Alchemist", line: "Turns cheap picks into gold." },
  "iron curtain": { tag: "The Fortress", line: "Nothing gets past." },
};

const FALLBACK: Archetype[] = [
  { tag: "The Maestro", line: "Conducts the XI like an orchestra." },
  { tag: "The Gambler", line: "Lives and dies by the differential." },
  { tag: "The Strategist", line: "Three moves ahead of the table." },
  { tag: "The Firestarter", line: "Goals first, questions later." },
  { tag: "The Ice Man", line: "Never blinks, never panics." },
  { tag: "The Underdog", line: "Backs the teams nobody believes in." },
  { tag: "The Closer", line: "Built for the knockout rounds." },
  { tag: "The Purist", line: "Form over fame, every time." },
];

export function archetypeFor(name?: string): Archetype {
  const key = (name ?? "").trim().toLowerCase();
  return CURATED[key] ?? FALLBACK[hash(key) % FALLBACK.length];
}
