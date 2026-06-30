"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { kitFor, type Kit } from "@/lib/teamColors";

export type PlayerSlot = {
  name: string;
  team: string; // flag/emoji or short
  nation?: string; // full nation name, for kit colours
  colors?: Kit | null; // live API team colours (override the canonical map)
  pos: "GK" | "DEF" | "MID" | "FWD";
  x: number; // 0..100 across pitch width
  y: number; // 0..100 down pitch length (0 = opponent goal / top)
  points: number;
  price?: number; // FPL £m price (market-value based)
  pending?: boolean; // nation's game hasn't kicked off yet this round
  captain?: boolean;
  live?: boolean; // currently in a live match
};

type XIPlayer = { name: string; pos: PlayerSlot["pos"]; team?: string; flag?: string; colors?: Kit | null; points?: number; price?: number; pending?: boolean; captain?: boolean };

/** Y-band per line (attacking upward). */
const Y: Record<PlayerSlot["pos"], number> = { GK: 90, DEF: 73, MID: 50, FWD: 22 };

/** Map ANY valid formation's XI onto the pitch — players spread evenly per line, centered. */
export function slotsFromXI(xi: XIPlayer[]): PlayerSlot[] {
  const lines: Record<PlayerSlot["pos"], XIPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of xi) (lines[p.pos] ?? lines.FWD).push(p);

  const slots: PlayerSlot[] = [];
  (Object.keys(lines) as PlayerSlot["pos"][]).forEach((pos) => {
    const ps = lines[pos];
    const n = ps.length;
    const gap = n <= 1 ? 0 : n === 2 ? 36 : n === 3 ? 30 : n === 4 ? 24 : 19;
    ps.forEach((p, i) => {
      const x = n === 1 ? 50 : 50 + (i - (n - 1) / 2) * gap;
      slots.push({
        name: p.name,
        team: p.flag ?? p.team ?? "⚽",
        nation: p.team,
        colors: p.colors ?? null,
        pos,
        x: Math.max(8, Math.min(92, x)),
        y: Y[pos],
        points: p.points ?? 0,
        price: p.price,
        pending: !!p.pending,
        captain: !!p.captain,
        live: false,
      });
    });
  });
  return slots;
}

/** An FPL-style football kit, coloured by nation. */
function Jersey({ kit, live }: { kit: Kit; live?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 54"
      className={clsx("h-11 w-11 drop-shadow-md transition-transform group-hover/chip:scale-110 sm:h-12 sm:w-12", live && "[animation:var(--animate-pulse-grass)]")}
      aria-hidden
    >
      {/* sleeves */}
      <path d="M14,8 L3,17 L9,28 L19,21 Z" fill={kit.secondary} stroke="rgba(0,0,0,.28)" strokeWidth="1" />
      <path d="M46,8 L57,17 L51,28 L41,21 Z" fill={kit.secondary} stroke="rgba(0,0,0,.28)" strokeWidth="1" />
      {/* body */}
      <path d="M19,8 L24,8 Q30,15 36,8 L41,8 L41,49 L19,49 Z" fill={kit.primary} stroke="rgba(0,0,0,.32)" strokeWidth="1.2" />
      {/* collar */}
      <path d="M24,8 Q30,15 36,8 L33,5 Q30,9 27,5 Z" fill={kit.secondary} />
    </svg>
  );
}

function PlayerChip({ p }: { p: PlayerSlot }) {
  const kit = kitFor(p.nation, p.colors);
  return (
    <div
      className="group/chip absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <Jersey kit={kit} live={p.live} />
          {/* nation flag badge */}
          <span className="absolute -bottom-0.5 -right-1 grid h-4 w-4 place-items-center rounded-full bg-pitch/90 text-[10px] leading-none shadow ring-1 ring-black/20">
            {p.team}
          </span>
          {p.captain && (
            <span className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-gold text-[9px] font-black text-pitch shadow">
              C
            </span>
          )}
        </div>
        <div className="flex flex-col items-center">
          <span className="max-w-[76px] truncate rounded-[3px] bg-pitch/85 px-1.5 text-[11px] font-semibold leading-tight text-chalk">
            {p.name}
          </span>
          <div className="mt-0.5 flex items-center gap-1">
            <span
              title={p.pending ? "Kick-off pending" : undefined}
              className={clsx(
                "rounded-[3px] px-1.5 text-[11px] font-bold tabular-nums leading-tight",
                p.pending
                  ? "bg-gold/15 text-gold"
                  : p.points >= 10
                    ? "bg-grass text-pitch"
                    : p.points > 0
                      ? "bg-grass/15 text-grass"
                      : "bg-line/60 text-data"
              )}
            >
              {p.pending ? "•" : p.points}
            </span>
            {p.price != null && (
              <span className="rounded-[3px] bg-pitch/85 px-1 text-[10px] font-semibold tabular-nums leading-tight text-data">
                £{p.price.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Pitch({
  xi = [],
  formation = "4-3-3",
  bench = [],
  squadValue,
  inTheBank,
  budget,
}: {
  xi?: PlayerSlot[];
  formation?: string;
  bench?: PlayerSlot[];
  squadValue?: number | null;
  inTheBank?: number | null;
  budget?: number | null;
}) {
  // gentle "live" recalculation tick to feel alive
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card overflow-hidden p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-data">
          Current XI
        </span>
        <div className="flex items-center gap-2">
          {squadValue != null && (
            <span className="rounded-[3px] bg-gold/15 px-2 py-0.5 text-xs font-bold tabular-nums text-gold">
              £{squadValue.toFixed(1)}m
              {budget != null && <span className="font-medium text-data">/£{budget.toFixed(0)}m</span>}
            </span>
          )}
          {inTheBank != null && (
            <span className="rounded-[3px] bg-grass/10 px-2 py-0.5 text-xs font-bold tabular-nums text-grass">
              £{inTheBank.toFixed(1)}m ITB
            </span>
          )}
          <span className="rounded-[3px] bg-grass/10 px-2 py-0.5 text-xs font-bold text-grass">
            {formation}
          </span>
        </div>
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-data)]">
        {/* turf */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0E7A3A,#0A5C2C)]" />
        {/* mowing stripes */}
        <div className="absolute inset-0 opacity-[0.12] [background:repeating-linear-gradient(180deg,#fff_0_8%,transparent_8%_16%)]" />
        {/* chalk lines */}
        <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <g fill="none" stroke="rgba(240,244,255,0.45)" strokeWidth="1.4">
            <rect x="8" y="8" width="284" height="384" />
            <line x1="8" y1="200" x2="292" y2="200" />
            <circle cx="150" cy="200" r="42" />
            <circle cx="150" cy="200" r="2.2" fill="rgba(240,244,255,0.6)" stroke="none" />
            {/* top box */}
            <rect x="70" y="8" width="160" height="64" />
            <rect x="116" y="8" width="68" height="26" />
            <path d="M112 72 A 42 42 0 0 0 188 72" />
            {/* bottom box */}
            <rect x="70" y="328" width="160" height="64" />
            <rect x="116" y="366" width="68" height="26" />
            <path d="M112 328 A 42 42 0 0 1 188 328" />
          </g>
        </svg>

        {/* players */}
        {xi.map((p) => (
          <PlayerChip key={p.name} p={p} />
        ))}
      </div>

      {/* bench */}
      {bench.length > 0 && (
      <div className="mt-3 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-data">Bench</span>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {bench.map((p) => {
            const kit = kitFor(p.nation, p.colors);
            return (
              <div
                key={p.name}
                className="flex items-center gap-2 rounded-[var(--radius-data)] border border-line border-l-[3px] bg-midfield-2 px-2 py-1.5"
                style={{ borderLeftColor: kit.primary }}
              >
                <span aria-hidden className="text-sm">{p.team}</span>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-chalk">{p.name}</div>
                  <div className="text-[10px] text-data">{p.pending ? "kick-off pending" : `${p.points} pts`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
