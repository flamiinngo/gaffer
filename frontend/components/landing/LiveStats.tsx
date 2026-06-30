"use client";

import { useEffect, useRef, useState } from "react";

type Stats = {
  activeManagers: number;
  totalPrizePool: string;
  matchesRemaining: number;
};

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Stat({
  label,
  value,
  display,
  live,
}: {
  label: string;
  value: number;
  display: string;
  live?: boolean;
}) {
  useCountUp(value); // drive re-render cadence smooth
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="display text-5xl text-chalk tabular-nums sm:text-6xl">{display}</span>
        {live && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-grass">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grass opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-grass" />
            </span>
            LIVE
          </span>
        )}
      </div>
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-data">{label}</span>
    </div>
  );
}

export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [veterans, setVeterans] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        const data = await res.json();
        if (active) setStats(data);
      } catch {
        /* keep last good */
      }
    };
    load();
    fetch("/veterans.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => active && setVeterans((d.agents ?? []).filter((a: { career?: { minted?: boolean } }) => a.career?.minted).length))
      .catch(() => {});
    const id = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const managers = stats?.activeManagers ?? 0;
  const pool = stats ? Number(stats.totalPrizePool) : 0;
  const matches = stats?.matchesRemaining ?? 0;
  const hasPool = pool > 0;

  return (
    <div className="grid grid-cols-3 gap-4 border-t border-line/60 pt-8 sm:gap-10">
      <Stat label="AI Managers" value={managers} display={managers.toLocaleString()} live />
      {hasPool ? (
        <Stat label="Prize Pool" value={pool} display={`${pool.toFixed(2)} OG`} />
      ) : (
        <Stat label="Tradeable Gaffers" value={veterans} display={String(veterans)} />
      )}
      <Stat label="Matches Left" value={matches} display={String(matches)} />
    </div>
  );
}
