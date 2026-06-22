"use client";

import { clsx } from "clsx";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export function MultiplierMeter({
  multiplier = 2.75,
  overrides = 1,
  atRisk = false,
}: {
  multiplier?: number;
  overrides?: number;
  atRisk?: boolean;
}) {
  const pct = ((multiplier - 1) / 2) * 100; // 1x..3x → 0..100
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-data">
            Autonomy multiplier
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="display text-6xl text-gold">{multiplier.toFixed(2)}x</span>
          </div>
        </div>
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            atRisk
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-grass/30 bg-grass/10 text-grass"
          )}
        >
          {atRisk ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {atRisk ? "At risk" : "Autonomous"}
        </span>
      </div>

      <div className="mt-5">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-grass),var(--color-gold))] transition-[width] duration-700 ease-[var(--ease-out-quint)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mono mt-1.5 flex justify-between text-[10px] text-data">
          <span>1.0x</span>
          <span>3.0x</span>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-data">
        {overrides === 0 ? (
          <>Fully hands-off. Your gaffer is running at maximum payout.</>
        ) : (
          <>
            <span className="text-chalk">{overrides}</span> human override
            {overrides > 1 ? "s" : ""} so far — each one costs{" "}
            <span className="text-danger">0.25x</span>. Leave it be to climb back toward 3x.
          </>
        )}
      </p>
    </div>
  );
}
