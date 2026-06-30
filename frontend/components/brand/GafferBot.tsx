import { identityFor, TIER_RING } from "@/lib/agentIdentity";

/**
 * The Gaffer-bot — a friendly robot FOOTBALL MANAGER, unique per agent. White bot with glowing
 * eyes, wearing the flat cap, a coach's headset, a club scarf and a touchline coat in its own
 * colours. Everything (colours, eyes, cap, antenna, mood) is seeded from the agent, so each gaffer
 * is a distinct, premium character. Pure SVG → infinite, deterministic, NFT-ready.
 */
export function GafferBot({
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
  const { palette, bot } = identityFor(agentId, name);
  const accent = palette.primary;
  const tierC = TIER_RING[tier] ?? TIER_RING[0];
  const uid = `gb-${agentId}-${size}`;

  const head =
    bot.head === 1 ? { x: 33, y: 20, w: 54, h: 64, r: 23 } :
    bot.head === 2 ? { x: 30, y: 26, w: 60, h: 56, r: 17 } :
    { x: 30, y: 24, w: 60, h: 60, r: 28 };
  const cx = head.x + head.w / 2;
  const hb = head.y + head.h; // head bottom
  const visor = { x: cx - 22, y: head.y + 15, w: 44, h: 30, r: 14 };
  const eyeY = visor.y + visor.h / 2;
  // friendly round eyes most of the time; an occasional visor look. (No cold bars.)
  const eyeStyle = bot.eyes === 2 ? "cyclops" : "round";

  return (
    <svg width={size} height={size} viewBox="0 0 120 122" className={className} role="img" aria-label={`${name ?? "Gaffer"} bot`}>
      <defs>
        <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E9EFF7" />
          <stop offset="100%" stopColor="#C3CFE0" />
        </linearGradient>
        <linearGradient id={`${uid}-coat`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#243650" />
          <stop offset="100%" stopColor="#131E30" />
        </linearGradient>
        <linearGradient id={`${uid}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13243F" />
          <stop offset="100%" stopColor="#060B16" />
        </linearGradient>
        <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={palette.ink} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.5" /></filter>
      </defs>

      {/* ---- touchline coat (the manager) ---- */}
      <path d="M16 122 L19 100 Q22 90 40 87 L80 87 Q98 90 101 100 L104 122 Z" fill={`url(#${uid}-coat)`} />
      {/* lapels + colour trim */}
      <path d={`M${cx} 92 L${cx - 16} 122 L${cx - 9} 122 L${cx} 100 Z`} fill="#0E1828" />
      <path d={`M${cx} 92 L${cx + 16} 122 L${cx + 9} 122 L${cx} 100 Z`} fill="#0E1828" />
      <path d="M40 87 Q34 95 32 110" stroke={accent} strokeWidth="1.6" fill="none" opacity="0.65" />
      <path d="M80 87 Q86 95 88 110" stroke={accent} strokeWidth="1.6" fill="none" opacity="0.65" />

      {/* ---- club scarf around the neck ---- */}
      <g>
        <path d={`M${cx - 17} ${hb - 6} Q${cx} ${hb + 4} ${cx + 17} ${hb - 6} L${cx + 16} ${hb + 1} Q${cx} ${hb + 9} ${cx - 16} ${hb + 1} Z`} fill={accent} />
        {/* two hanging tails with stripes + fringe */}
        {[-1, 1].map((s) => (
          <g key={s} transform={`translate(${cx + s * 7} ${hb + 2})`}>
            <rect x={s < 0 ? -7 : -1} y="0" width="8" height="20" rx="2" fill={accent} />
            <rect x={s < 0 ? -7 : -1} y="4" width="8" height="3" fill="#FFFFFF" opacity="0.8" />
            <rect x={s < 0 ? -7 : -1} y="11" width="8" height="3" fill="#FFFFFF" opacity="0.55" />
            {[0, 1, 2, 3].map((f) => <rect key={f} x={(s < 0 ? -7 : -1) + f * 2} y="20" width="1.4" height="3" fill={accent} />)}
          </g>
        ))}
      </g>

      {/* ---- neck ---- */}
      <rect x={cx - 8} y={hb - 12} width="16" height="12" rx="5" fill="#C7D2E1" />

      {/* ---- headset band + ear-cups (the coach) ---- */}
      <path d={`M${head.x + 3} ${head.y + 16} Q${cx} ${head.y - 12} ${head.x + head.w - 3} ${head.y + 16}`} fill="none" stroke="#A6B6CC" strokeWidth="3.5" strokeLinecap="round" />
      <rect x={head.x - 6} y={head.y + head.h / 2 - 11} width="11" height="22" rx="5" fill="#2A3A52" stroke={accent} strokeWidth="1.3" />
      <rect x={head.x + head.w - 5} y={head.y + head.h / 2 - 11} width="11" height="22" rx="5" fill="#2A3A52" stroke={accent} strokeWidth="1.3" />
      {/* mic boom */}
      <path d={`M${head.x - 1} ${head.y + head.h / 2 + 9} Q${head.x - 6} ${visor.y + visor.h + 9} ${cx - 9} ${visor.y + visor.h + 6}`} fill="none" stroke="#A6B6CC" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={cx - 9} cy={visor.y + visor.h + 6} r="2.4" fill={accent} />

      {/* ---- head ---- */}
      <ellipse cx={cx} cy={hb - 2} rx={head.w / 2.2} ry="5" fill="#0A1220" opacity="0.18" />
      <rect x={head.x} y={head.y} width={head.w} height={head.h} rx={head.r} fill={`url(#${uid}-skin)`} stroke="#AEBCCE" strokeWidth="1" />
      {/* glossy dome highlight */}
      <ellipse cx={head.x + head.w * 0.37} cy={head.y + head.h * 0.26} rx={head.w * 0.3} ry={head.h * 0.17} fill="#FFFFFF" opacity="0.55" filter={`url(#${uid}-soft)`} />
      <path d={`M${head.x + 6} ${head.y + head.h * 0.5} Q${head.x + 3} ${head.y + 8} ${head.x + head.w * 0.4} ${head.y + 5}`} stroke="#FFFFFF" strokeWidth="2" opacity="0.4" fill="none" strokeLinecap="round" />
      {/* cheek lights */}
      <circle cx={head.x + 7} cy={eyeY + 9} r="2.2" fill={accent} opacity="0.5" filter={`url(#${uid}-soft)`} />
      <circle cx={head.x + head.w - 7} cy={eyeY + 9} r="2.2" fill={accent} opacity="0.5" filter={`url(#${uid}-soft)`} />

      {/* ---- visor face ---- */}
      <rect x={visor.x} y={visor.y} width={visor.w} height={visor.h} rx={visor.r} fill={`url(#${uid}-visor)`} />
      <rect x={visor.x + 3} y={visor.y + 2.5} width={visor.w - 6} height="6" rx="3" fill="#FFFFFF" opacity="0.08" />
      {/* glossy diagonal sheen across the face */}
      <polygon points={`${cx + 2},${visor.y} ${cx + 9},${visor.y} ${cx - 5},${visor.y + visor.h} ${cx - 12},${visor.y + visor.h}`} fill="#FFFFFF" opacity="0.06" />

      {/* eyes — big, friendly, glowing */}
      {eyeStyle === "cyclops" ? (
        <g>
          <ellipse cx={cx} cy={eyeY} rx="13" ry="6" fill={`url(#${uid}-glow)`} />
          <rect x={cx - 9} y={eyeY - 3.5} width="18" height="7" rx="3.5" fill={accent} />
          <rect x={cx - 9} y={eyeY - 3.5} width="18" height="3" rx="1.5" fill="#EAF6FF" opacity="0.6" />
        </g>
      ) : (
        [-9, 9].map((d, i) => (
          <g key={i}>
            <circle cx={cx + d} cy={eyeY} r="9" fill={`url(#${uid}-glow)`} />
            <circle cx={cx + d} cy={eyeY} r="5.4" fill={accent} />
            <circle cx={cx + d} cy={eyeY} r="5.4" fill="#EAF6FF" opacity="0.5" filter={`url(#${uid}-soft)`} />
            <circle cx={cx + d - 1.5} cy={eyeY - 1.8} r="1.7" fill="#FFFFFF" />
          </g>
        ))
      )}
      {/* friendly smile */}
      <path d={`M${cx - 6} ${visor.y + visor.h - 6} Q${cx} ${visor.y + visor.h - 2} ${cx + 6} ${visor.y + visor.h - 6}`} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />

      {/* antenna */}
      {bot.antenna !== 0 && (
        <g>
          <line x1={cx} y1={head.y} x2={cx} y2={head.y - 8} stroke="#A6B6CC" strokeWidth="2" strokeLinecap="round" />
          <circle cx={cx} cy={head.y - 10} r="3" fill={accent} />
          <circle cx={cx} cy={head.y - 10} r="5" fill={`url(#${uid}-glow)`} />
        </g>
      )}

      {/* ---- flat cap (the gaffer) ---- */}
      <g>
        <path d={`M${cx - 25} ${head.y + 5} C${cx - 23} ${head.y - 13} ${cx + 4} ${head.y - 17} ${cx + 17} ${head.y - 9} C${cx + 23} ${head.y - 5} ${cx + 24} ${head.y + 2} ${cx + 23} ${head.y + 6} Z`} fill={`url(#${uid}-cap)`} />
        <path d={`M${cx - 23} ${head.y + 6} C${cx - 37} ${head.y + 5} ${cx - 43} ${head.y + 9} ${cx - 45} ${head.y + 12} C${cx - 44} ${head.y + 14} ${cx - 35} ${head.y + 11} ${cx - 23} ${head.y + 9} Z`} fill={palette.ink} opacity="0.9" />
        <circle cx={cx} cy={head.y - 10} r="1.7" fill={palette.ink} opacity="0.7" />
        <path d={`M${cx - 23} ${head.y + 6.5} L${cx + 23} ${head.y + 6.5}`} stroke="#FFFFFF" strokeWidth="1" opacity="0.18" />
      </g>

      {/* tier pip on the cap */}
      <circle cx={cx + 15} cy={head.y - 3} r="3" fill={tierC} stroke="#0A1220" strokeWidth="1" />
    </svg>
  );
}
