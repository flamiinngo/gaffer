import { identityFor, TIER_RING } from "@/lib/agentIdentity";

/**
 * The Gaffer's Mind — the agent's identity generated from its onchain DNA (id/config seed), not
 * drawn onto it. A robotic AI core: a living lens-eye inside a generative tactical sigil whose
 * symmetry, lattice and orbital rings are seeded by the agent and GROW with its tier
 * (Rookie→Legend). Provably unique, evolving, NFT-grade — and unmistakably "verifiable AI on 0G",
 * not a stock mascot.
 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const P = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;

export function GafferMind({
  agentId,
  name,
  tier = 0,
  size = 160,
  className = "",
}: {
  agentId: number | string;
  name?: string;
  tier?: number;
  size?: number;
  className?: string;
}) {
  const { seed, palette } = identityFor(agentId, name);
  const rnd = rng(seed);
  const accent = palette.primary;
  const tierC = TIER_RING[tier] ?? TIER_RING[0];
  const uid = `mind-${agentId}-${size}`;
  const C = 64;

  const k = 5 + (seed % 3); // rotational symmetry: 5/6/7-fold
  const phase = rnd() * Math.PI;
  const iris = seed % 3; // lens variant
  const rings = tier + 1; // orbital rings grow with reputation
  const dash = `${2 + (seed % 4)} ${3 + (seed % 5)}`;

  // lattice nodes (two symmetric rings) — the agent's "tactical web"
  const ring1 = Array.from({ length: k }, (_, i) => P(C, C, 19, phase + (i * 2 * Math.PI) / k));
  const ring2 = Array.from({ length: k }, (_, i) => P(C, C, 31, phase + ((i + 0.5) * 2 * Math.PI) / k));

  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className} role="img" aria-label={`${name ?? "Gaffer"} mind`}>
      <defs>
        <radialGradient id={`${uid}-bg`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
          <stop offset="55%" stopColor={palette.ink} stopOpacity="0.0" />
        </radialGradient>
        <radialGradient id={`${uid}-iris`} cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor={accent} />
          <stop offset="100%" stopColor={palette.ink} />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <circle cx={C} cy={C} r="62" fill={`url(#${uid}-bg)`} />

      {/* orbital rings — one per tier, dashed HUD arcs with nodes */}
      {Array.from({ length: rings }).map((_, r) => {
        const rad = 40 + r * 7;
        return (
          <g key={r}>
            <circle cx={C} cy={C} r={rad} fill="none" stroke={accent} strokeOpacity={0.18 + r * 0.05} strokeWidth="1" strokeDasharray={dash} />
            {Array.from({ length: k }).map((_, i) => {
              const [x, y] = P(C, C, rad, phase + (i * 2 * Math.PI) / k + r * 0.3);
              return <circle key={i} cx={x} cy={y} r={r === rings - 1 ? 1.8 : 1.2} fill={r === rings - 1 ? tierC : accent} opacity="0.9" />;
            })}
          </g>
        );
      })}

      {/* HUD tick marks */}
      <g stroke={accent} strokeOpacity="0.4" strokeWidth="1">
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i * 2 * Math.PI) / 24;
          const [x1, y1] = P(C, C, 36, a);
          const [x2, y2] = P(C, C, i % 6 === 0 ? 31 : 33.5, a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      {/* tactical web: connect rings */}
      <g stroke={accent} strokeOpacity="0.35" strokeWidth="0.8" fill="none">
        {ring1.map(([x, y], i) => <line key={`a${i}`} x1={C} y1={C} x2={x} y2={y} />)}
        {ring2.map(([x, y], i) => {
          const [ax, ay] = ring1[i];
          const [bx, by] = ring1[(i + 1) % k];
          return <g key={`b${i}`}><line x1={x} y1={y} x2={ax} y2={ay} /><line x1={x} y1={y} x2={bx} y2={by} /></g>;
        })}
      </g>
      {ring2.map(([x, y], i) => <circle key={`n2${i}`} cx={x} cy={y} r="1.6" fill={accent} />)}
      {ring1.map(([x, y], i) => <circle key={`n1${i}`} cx={x} cy={y} r="2" fill="#FFFFFF" opacity="0.85" />)}

      {/* faceplate — k-gon frame (the "robot" structure) */}
      <polygon
        points={Array.from({ length: k }, (_, i) => P(C, C, 14, phase + (i * 2 * Math.PI) / k + Math.PI / k).join(",")).join(" ")}
        fill={palette.ink} fillOpacity="0.85" stroke={accent} strokeOpacity="0.7" strokeWidth="1.2"
      />

      {/* the living lens-eye — gives it presence */}
      <circle cx={C} cy={C} r="11" fill={`url(#${uid}-iris)`} filter={`url(#${uid}-glow)`} opacity="0.9" />
      <circle cx={C} cy={C} r="8.5" fill={`url(#${uid}-iris)`} />
      {iris === 0 && <circle cx={C} cy={C} r="3" fill="#0A1220" />}
      {iris === 1 && <rect x={C - 3.5} y={C - 1.6} width="7" height="3.2" rx="1.5" fill="#0A1220" />}
      {iris === 2 && <g stroke="#0A1220" strokeWidth="1.6"><circle cx={C} cy={C} r="3.4" fill="none" /></g>}
      <circle cx={C - 2.4} cy={C - 2.8} r="1.5" fill="#FFFFFF" />

      {/* 0G verification seal */}
      <g transform={`translate(${C} 110)`}>
        <polygon points={Array.from({ length: 6 }, (_, i) => P(0, 0, 6.5, (i * Math.PI) / 3 + Math.PI / 6).join(",")).join(" ")} fill={palette.ink} stroke={accent} strokeOpacity="0.7" strokeWidth="1" />
        <text x="0" y="2.5" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fontWeight="700" fill={accent}>0G</text>
      </g>
    </svg>
  );
}
