"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

export type PlayerSlot = {
  name: string;
  team: string; // flag/emoji or short
  pos: "GK" | "DEF" | "MID" | "FWD";
  x: number; // 0..100 across pitch width
  y: number; // 0..100 down pitch length (0 = opponent goal / top)
  points: number;
  captain?: boolean;
  live?: boolean; // currently in a live match
};

/** A 4-3-3, attacking upward. Coordinates are % within the pitch. */
export const DEFAULT_XI: PlayerSlot[] = [
  { name: "Martínez", team: "🇦🇷", pos: "GK", x: 50, y: 90, points: 6 },
  { name: "Hakimi", team: "🇲🇦", pos: "DEF", x: 16, y: 70, points: 8, live: true },
  { name: "Saliba", team: "🇫🇷", pos: "DEF", x: 38, y: 74, points: 4 },
  { name: "Van Dijk", team: "🇳🇱", pos: "DEF", x: 62, y: 74, points: 7 },
  { name: "Davies", team: "🇨🇦", pos: "DEF", x: 84, y: 70, points: 3 },
  { name: "Rodri", team: "🇪🇸", pos: "MID", x: 30, y: 50, points: 9, live: true },
  { name: "Bellingham", team: "🏴", pos: "MID", x: 50, y: 46, points: 14, captain: true, live: true },
  { name: "Pedri", team: "🇪🇸", pos: "MID", x: 70, y: 50, points: 6 },
  { name: "Vinícius", team: "🇧🇷", pos: "FWD", x: 22, y: 24, points: 11, live: true },
  { name: "Mbappé", team: "🇫🇷", pos: "FWD", x: 50, y: 18, points: 12, live: true },
  { name: "Saka", team: "🏴", pos: "FWD", x: 78, y: 24, points: 5 },
];

export const BENCH: PlayerSlot[] = [
  { name: "Donnarumma", team: "🇮🇹", pos: "GK", x: 0, y: 0, points: 2 },
  { name: "Hernández", team: "🇫🇷", pos: "DEF", x: 0, y: 0, points: 1 },
  { name: "Wirtz", team: "🇩🇪", pos: "MID", x: 0, y: 0, points: 4 },
  { name: "Haaland", team: "🇳🇴", pos: "FWD", x: 0, y: 0, points: 0 },
];

/** 4-3-3 coordinates (attacking upward), keyed by line. */
const COORDS: Record<PlayerSlot["pos"], [number, number][]> = {
  GK: [[50, 90]],
  DEF: [[16, 72], [38, 75], [62, 75], [84, 72]],
  MID: [[28, 50], [50, 46], [72, 50]],
  FWD: [[24, 24], [50, 18], [76, 24]],
};

type XIPlayer = { name: string; pos: PlayerSlot["pos"]; team?: string; flag?: string; points?: number; captain?: boolean };

/** Map a real, position-ordered XI (1 GK, 4 DEF, 3 MID, 3 FWD) onto pitch coordinates. */
export function slotsFromXI(xi: XIPlayer[]): PlayerSlot[] {
  const n: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  return xi.map((p) => {
    const i = n[p.pos]++;
    const [x, y] = COORDS[p.pos]?.[i] ?? [50, 50];
    return {
      name: p.name,
      team: p.flag ?? p.team ?? "⚽",
      pos: p.pos,
      x,
      y,
      points: p.points ?? 0,
      captain: !!p.captain,
      live: false,
    };
  });
}

function PlayerChip({ p }: { p: PlayerSlot }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <div
            className={clsx(
              "grid h-10 w-10 place-items-center rounded-full border text-base shadow-lg transition-transform hover:scale-110 sm:h-11 sm:w-11",
              p.live
                ? "border-grass/70 bg-pitch/90 [animation:var(--animate-pulse-grass)]"
                : "border-line bg-pitch/90"
            )}
          >
            <span aria-hidden>{p.team}</span>
          </div>
          {p.captain && (
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-gold text-[9px] font-black text-pitch">
              C
            </span>
          )}
        </div>
        <div className="flex flex-col items-center">
          <span className="max-w-[72px] truncate rounded-[3px] bg-pitch/85 px-1.5 text-[11px] font-semibold leading-tight text-chalk">
            {p.name}
          </span>
          <span
            className={clsx(
              "mt-0.5 rounded-[3px] px-1.5 text-[11px] font-bold tabular-nums leading-tight",
              p.points >= 10
                ? "bg-grass text-pitch"
                : p.points > 0
                  ? "bg-grass/15 text-grass"
                  : "bg-line/60 text-data"
            )}
          >
            {p.points}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Pitch({
  xi = DEFAULT_XI,
  formation = "4-3-3",
  bench = [],
}: {
  xi?: PlayerSlot[];
  formation?: string;
  bench?: PlayerSlot[];
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
        <span className="rounded-[3px] bg-grass/10 px-2 py-0.5 text-xs font-bold text-grass">
          {formation}
        </span>
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
          {bench.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 rounded-[var(--radius-data)] border border-line bg-midfield-2 px-2 py-1.5"
            >
              <span aria-hidden className="text-sm">{p.team}</span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium text-chalk">{p.name}</div>
                <div className="text-[10px] text-data">{p.points} pts</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
