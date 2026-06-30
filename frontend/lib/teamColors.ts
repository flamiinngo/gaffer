/**
 * National-team kit colours for the World Cup pitch.
 *
 * These are canonical national colours (not invented) used to render FPL-style kits.
 * When the agent captures the live SofaScore `teamColors` for a player, that real value is
 * passed through and takes precedence — this map is the always-correct fallback.
 */
export type Kit = { primary: string; secondary: string };

const NATION_KITS: Record<string, Kit> = {
  Brazil: { primary: "#FCD116", secondary: "#009C3B" },
  Argentina: { primary: "#75AADB", secondary: "#FFFFFF" },
  France: { primary: "#1E3A8A", secondary: "#FFFFFF" },
  Netherlands: { primary: "#F36C21", secondary: "#FFFFFF" },
  England: { primary: "#FFFFFF", secondary: "#CF142B" },
  Spain: { primary: "#C60B1E", secondary: "#FFC400" },
  Germany: { primary: "#222222", secondary: "#DD0000" },
  Portugal: { primary: "#DA291C", secondary: "#006600" },
  Morocco: { primary: "#C1272D", secondary: "#006233" },
  USA: { primary: "#1E2A78", secondary: "#BF0A30" },
  "United States": { primary: "#1E2A78", secondary: "#BF0A30" },
  Mexico: { primary: "#006847", secondary: "#CE1126" },
  Switzerland: { primary: "#D52B1E", secondary: "#FFFFFF" },
  Türkiye: { primary: "#E30A17", secondary: "#FFFFFF" },
  Turkey: { primary: "#E30A17", secondary: "#FFFFFF" },
  Scotland: { primary: "#0F4C9A", secondary: "#FFFFFF" },
  "Côte d'Ivoire": { primary: "#FF8200", secondary: "#009E60" },
  "Ivory Coast": { primary: "#FF8200", secondary: "#009E60" },
  Belgium: { primary: "#C8102E", secondary: "#FDDA24" },
  Croatia: { primary: "#E51A22", secondary: "#FFFFFF" },
  Italy: { primary: "#1565C0", secondary: "#FFFFFF" },
  Japan: { primary: "#0033A0", secondary: "#FFFFFF" },
  "South Korea": { primary: "#C8102E", secondary: "#0A2D6E" },
  Korea: { primary: "#C8102E", secondary: "#0A2D6E" },
  Senegal: { primary: "#00853F", secondary: "#FDEF42" },
  Uruguay: { primary: "#5CBFEB", secondary: "#0A2240" },
  Colombia: { primary: "#FCD116", secondary: "#003893" },
  Denmark: { primary: "#C8102E", secondary: "#FFFFFF" },
  Poland: { primary: "#FFFFFF", secondary: "#DC143C" },
  Australia: { primary: "#00843D", secondary: "#FFCD00" },
  Canada: { primary: "#D52B1E", secondary: "#FFFFFF" },
  Ecuador: { primary: "#FFD100", secondary: "#0072CE" },
  Ghana: { primary: "#006B3F", secondary: "#FCD116" },
  Nigeria: { primary: "#008751", secondary: "#FFFFFF" },
  Wales: { primary: "#C8102E", secondary: "#FFFFFF" },
  Serbia: { primary: "#C6363C", secondary: "#0C4076" },
  Austria: { primary: "#ED2939", secondary: "#FFFFFF" },
  Norway: { primary: "#BA0C2F", secondary: "#00205B" },
  Sweden: { primary: "#FECC02", secondary: "#005293" },
  Egypt: { primary: "#CE1126", secondary: "#FFFFFF" },
  Cameroon: { primary: "#007A5E", secondary: "#CE1126" },
  Qatar: { primary: "#8A1538", secondary: "#FFFFFF" },
  "Saudi Arabia": { primary: "#006C35", secondary: "#FFFFFF" },
  Iran: { primary: "#FFFFFF", secondary: "#239F40" },
  Tunisia: { primary: "#E70013", secondary: "#FFFFFF" },
  Algeria: { primary: "#006633", secondary: "#FFFFFF" },
  Paraguay: { primary: "#D52B1E", secondary: "#0038A8" },
  Peru: { primary: "#D91023", secondary: "#FFFFFF" },
  Chile: { primary: "#0039A6", secondary: "#D52B1E" },
  Greece: { primary: "#0D5EAF", secondary: "#FFFFFF" },
};

const DEFAULT_KIT: Kit = { primary: "#1F8A4C", secondary: "#0B3D24" };

/** Resolve a kit: explicit API colours win, else the canonical national map, else default. */
export function kitFor(nation?: string, api?: Kit | null): Kit {
  if (api?.primary) return { primary: api.primary, secondary: api.secondary || api.primary };
  if (nation && NATION_KITS[nation]) return NATION_KITS[nation];
  return DEFAULT_KIT;
}

/** Pick readable ink (dark/light) for text laid over a fill colour. */
export function inkOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#0A1628";
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0A1628" : "#FFFFFF";
}
