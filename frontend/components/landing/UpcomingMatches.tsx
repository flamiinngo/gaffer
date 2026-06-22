"use client";

import { useEffect, useState } from "react";

type Fixture = {
  id: number;
  competition: string;
  home: { name: string; flag: string };
  away: { name: string; flag: string };
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string;
  stage: string;
  status: string;
};

function useCountdown(iso: string) {
  const [left, setLeft] = useState(() => +new Date(iso) - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(+new Date(iso) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (left <= 0) return "LIVE";
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
}

function MatchRow({ fx }: { fx: Fixture }) {
  const countdown = useCountdown(fx.kickoff);
  const live = fx.status === "inprogress" || countdown === "LIVE";

  return (
    <div className="card card-hover flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-chalk">
            <span aria-hidden>{fx.home.flag}</span>
            <span className="truncate">{fx.home.name}</span>
            <span className="text-data">v</span>
            <span aria-hidden>{fx.away.flag}</span>
            <span className="truncate">{fx.away.name}</span>
          </div>
          <div className="mt-0.5 text-xs text-data">{fx.competition} · {fx.stage}</div>
        </div>
      </div>
      <div className="text-right">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-data)] bg-grass/10 px-2.5 py-1 text-xs font-bold text-grass">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" /> LIVE
          </span>
        ) : (
          <>
            <div className="mono text-sm font-semibold text-gold tabular-nums">{countdown}</div>
            <div className="text-[11px] text-data">to kickoff</div>
          </>
        )}
      </div>
    </div>
  );
}

export function UpcomingMatches() {
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);

  useEffect(() => {
    fetch("/api/fixtures", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFixtures(d.fixtures ?? []))
      .catch(() => setFixtures([]));
  }, []);

  if (fixtures === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[72px] w-full" />
        ))}
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="card px-5 py-8 text-center text-sm text-data">
        Live fixtures are syncing from the World Cup feed. Check back in a moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fixtures.map((fx) => (
        <MatchRow key={fx.id} fx={fx} />
      ))}
    </div>
  );
}
