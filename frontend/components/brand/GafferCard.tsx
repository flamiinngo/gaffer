import Link from "next/link";
import { GafferBot } from "@/components/brand/GafferBot";
import { archetypeFor, identityFor, TIER_RING } from "@/lib/agentIdentity";

const TIER_NAME = ["Rookie", "Pro", "Elite", "Legend"];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Premium collectible card: the Gaffer-bot on a seeded aura + particle backdrop, tier frame and
 *  holo sheen. The big, NFT-worthy representation of an agent — used on home, market and profiles. */
export function GafferCard({
  agentId, name, tier = 0, rounds, wins, careerPts, href, footer, botSize = 150, className = "",
}: {
  agentId: number | string; name: string; tier?: number;
  rounds?: number; wins?: number; careerPts?: number;
  href?: string; footer?: React.ReactNode; botSize?: number; className?: string;
}) {
  const arc = archetypeFor(name);
  const ring = TIER_RING[tier] ?? TIER_RING[0];
  const { seed, palette } = identityFor(agentId, name);
  const rnd = rng(seed);
  const accent = palette.primary;
  const particles = Array.from({ length: 16 }, () => ({ x: rnd() * 100, y: rnd() * 130, r: 0.4 + rnd() * 1.6, o: 0.15 + rnd() * 0.45 }));
  const holo = tier >= 2; // Elite/Legend get a stronger holographic sheen
  const uid = `card-${agentId}`;

  const inner = (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] p-5 transition-transform duration-300 hover:-translate-y-1 ${className}`}
      style={{ border: `1.5px solid ${ring}66`, background: "linear-gradient(180deg,#0e1a2b,#0a1422)", boxShadow: `0 0 0 1px ${ring}22, 0 16px 40px -18px ${accent}66` }}
    >
      {/* seeded backdrop */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id={`${uid}-aura`} cx="0.5" cy="0.32" r="0.6">
            <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.04" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="130" fill={`url(#${uid}-aura)`} />
        {/* football pitch motif */}
        <circle cx="50" cy="42" r="30" fill="none" stroke={accent} strokeOpacity="0.07" strokeWidth="0.5" />
        <circle cx="50" cy="42" r="4" fill="none" stroke={accent} strokeOpacity="0.07" strokeWidth="0.5" />
        {particles.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={accent} opacity={p.o} />)}
      </svg>

      {/* holo sheen */}
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: holo
        ? `linear-gradient(115deg, transparent 30%, ${ring}22 45%, #ffffff14 50%, ${accent}22 55%, transparent 70%)`
        : `linear-gradient(160deg, #ffffff0a, transparent 40%)` }} />

      {/* corner accents */}
      {[["left-2 top-2", "border-l-2 border-t-2"], ["right-2 top-2", "border-r-2 border-t-2"], ["left-2 bottom-2", "border-l-2 border-b-2"], ["right-2 bottom-2", "border-r-2 border-b-2"]].map(([pos, b]) => (
        <span key={pos} className={`pointer-events-none absolute ${pos} h-3 w-3 ${b} rounded-[2px]`} style={{ borderColor: `${ring}88` }} />
      ))}

      <div className="relative flex items-center justify-between">
        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: ring, background: `${ring}1f`, boxShadow: `0 0 12px ${ring}44` }}>
          {TIER_NAME[tier]}
        </span>
        <span className="mono text-[11px] text-data">#{agentId}</span>
      </div>

      <div className="relative mx-auto mt-1 grid place-items-center">
        {/* ground glow */}
        <div className="absolute bottom-2 h-4 w-24 rounded-full blur-md" style={{ background: accent, opacity: 0.35 }} />
        <GafferBot agentId={agentId} name={name} tier={tier} size={botSize} className="relative drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.04]" />
      </div>

      <div className="relative mt-1 text-center">
        <h3 className="display text-2xl leading-tight text-chalk">{name}</h3>
        <p className="text-xs font-semibold" style={{ color: ring }}>{arc.tag}</p>
        <p className="mt-0.5 text-[11px] text-data">{arc.line}</p>
      </div>

      {(rounds != null || wins != null || careerPts != null) && (
        <div className="relative mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-data)] border border-line/70 bg-line/60 text-center backdrop-blur-sm">
          <Cell label="Rounds" value={rounds ?? 0} />
          <Cell label="Wins" value={wins ?? 0} />
          <Cell label="Career" value={careerPts ?? 0} gold />
        </div>
      )}

      {footer && <div className="relative mt-4">{footer}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

function Cell({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div className="bg-midfield/80 px-2 py-2">
      <div className={`display text-xl ${gold ? "text-gold" : "text-chalk"}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-data">{label}</div>
    </div>
  );
}
