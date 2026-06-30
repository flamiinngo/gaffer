"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

type NationStatus = { status: "through" | "out" | "pending"; opponent?: string; kickoff?: string };
type RoundData = { round: string | null; nations: Record<string, NationStatus> };

export type SquadNation = { name: string; flag: string; count: number };

/** Knockout-survival board: shows each nation your squad is riding and whether it's still alive. */
export function SurvivalStrip({ nations }: { nations: SquadNation[] }) {
  const [data, setData] = useState<RoundData | null>(null);

  useEffect(() => {
    fetch("/api/round", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ round: null, nations: {} }));
  }, []);

  if (!data || !Object.keys(data.nations).length) return null;

  const rows = nations
    .map((n) => ({ ...n, ...(data.nations[n.name] ?? { status: "pending" as const }) }))
    .sort((a, b) => (a.status === "out" ? 1 : 0) - (b.status === "out" ? 1 : 0) || b.count - a.count);

  const through = rows.filter((r) => r.status === "through").length;
  const out = rows.filter((r) => r.status === "out").length;
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-data">Nations you&apos;re riding</span>
        <span className="text-[11px] text-data">
          <span className="font-bold text-grass">{through} through</span> · {pending} to play ·{" "}
          <span className={out ? "font-bold text-danger" : ""}>{out} out</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.name}
            className={clsx(
              "flex items-center gap-2 rounded-[var(--radius-data)] border px-2.5 py-2",
              r.status === "through" && "border-grass/30 bg-grass/[0.06]",
              r.status === "out" && "border-danger/25 bg-danger/[0.05] opacity-70",
              r.status === "pending" && "border-line bg-midfield-2"
            )}
          >
            <span aria-hidden className="text-base">{r.flag}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-chalk">{r.name}</div>
              <div className="text-[10px] text-data">{r.count} {r.count === 1 ? "player" : "players"}</div>
            </div>
            <span
              className={clsx(
                "shrink-0 text-[11px] font-bold",
                r.status === "through" && "text-grass",
                r.status === "out" && "text-danger",
                r.status === "pending" && "text-gold"
              )}
            >
              {r.status === "through" ? "✓ through" : r.status === "out" ? "out" : "live soon"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
