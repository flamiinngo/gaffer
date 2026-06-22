"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GafferMark } from "@/components/brand/Logo";
import { LiveDashboard } from "@/components/dashboard/LiveDashboard";
import { explorerAddress, shortAddr } from "@/lib/chain";
import { Plus, Trophy, ShieldCheck, AlertTriangle, ArrowRight, Radio } from "lucide-react";

type Gaffer = {
  contestId: number;
  contestName: string;
  status: "UPCOMING" | "LIVE" | "ENDED";
  points: number;
  overrideCount: number;
  multiplier: number;
  effectiveScore: number;
  rank: number;
  participants: number;
};

const STATUS: Record<Gaffer["status"], string> = {
  LIVE: "bg-grass/12 text-grass border-grass/30",
  UPCOMING: "bg-gold/12 text-gold border-gold/30",
  ENDED: "bg-line/40 text-data border-line",
};

export function MyGaffers() {
  const { authenticated, user, login } = usePrivy();
  const [gaffers, setGaffers] = useState<Gaffer[] | null>(null);
  const address = user?.wallet?.address;

  useEffect(() => {
    if (!authenticated || !address) return;
    setGaffers(null);
    fetch(`/api/my-gaffers?address=${address}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setGaffers(d.gaffers ?? []))
      .catch(() => setGaffers([]));
  }, [authenticated, address]);

  // Signed out (or Privy still loading) → public live showcase + sign-in nudge.
  // Never block on `ready` — the showcase must always render for visitors.
  if (!authenticated) {
    return (
      <>
        <div className="border-b border-line/60 bg-gradient-to-r from-grass/10 to-transparent">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-chalk">
              <Radio className="mr-1.5 inline h-4 w-4 text-grass" />
              You&apos;re watching a live gaffer. <span className="text-data">Sign in to deploy and track your own stable.</span>
            </p>
            <Button onClick={() => login()} variant="primary" size="sm">Sign in</Button>
          </div>
        </div>
        <LiveDashboard />
      </>
    );
  }

  // Signed in → personal stable
  const totalEffective = gaffers?.reduce((n, g) => n + g.effectiveScore, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-card)] border border-line bg-midfield">
            <GafferMark className="h-8 w-9" />
          </span>
          <div>
            <h1 className="display text-4xl text-chalk">My Gaffers</h1>
            <p className="mt-1 text-sm text-data">
              {user?.email?.address ?? (address && shortAddr(address, 5))}
              {gaffers && gaffers.length > 0 && <> · {gaffers.length} deployed · {totalEffective} total effective</>}
            </p>
          </div>
        </div>
        <Button href="/onboard" variant="primary" size="md"><Plus className="h-4 w-4" /> Deploy new gaffer</Button>
      </div>

      {gaffers === null ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-52 rounded-[var(--radius-card)]" />)}
        </div>
      ) : gaffers.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-4 px-6 py-20 text-center">
          <GafferMark className="h-10 w-12 opacity-60" />
          <div>
            <h3 className="text-lg font-semibold text-chalk">No gaffers deployed yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-data">Build your first AI manager, drop it into a contest, and watch it compete. Deploying is free.</p>
          </div>
          <Button href="/onboard" variant="primary" size="md">Deploy your first gaffer</Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {gaffers.map((g) => (
            <Link key={g.contestId} href={`/contest/${g.contestId}`} className="block">
              <div className="card card-hover flex h-full flex-col p-6">
                <div className="flex items-start justify-between">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${STATUS[g.status]}`}>
                    {g.status === "LIVE" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" />}{g.status}
                  </span>
                  {g.rank > 0 && (
                    <span className={`text-sm font-bold ${g.rank === 1 ? "text-gold" : "text-data"}`}>#{g.rank} <span className="text-data/60">/ {g.participants}</span></span>
                  )}
                </div>

                <h3 className="mt-4 line-clamp-2 text-base font-semibold leading-snug text-chalk">{g.contestName}</h3>

                <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-data)] border border-line bg-line">
                  <Cell label="Points" value={String(g.points)} />
                  <Cell label="Mult" value={`${g.multiplier.toFixed(2)}x`} tone={g.overrideCount === 0 ? "grass" : "data"} />
                  <Cell label="Score" value={String(g.effectiveScore)} tone="gold" />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className={`inline-flex items-center gap-1.5 ${g.overrideCount === 0 ? "text-grass" : "text-danger"}`}>
                    {g.overrideCount === 0 ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {g.overrideCount === 0 ? "Autonomous" : `${g.overrideCount} override${g.overrideCount > 1 ? "s" : ""}`}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-grass">Standings <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {gaffers && gaffers.length > 0 && address && (
        <div className="mt-6 text-center">
          <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="mono text-xs text-data transition-colors hover:text-grass">
            <Trophy className="mr-1 inline h-3.5 w-3.5" /> verify your gaffers onchain · {shortAddr(address, 5)}
          </a>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "grass" | "gold" | "data" }) {
  const c = tone === "grass" ? "text-grass" : tone === "gold" ? "text-gold" : "text-chalk";
  return (
    <div className="bg-midfield px-2 py-2.5 text-center">
      <div className={`display text-2xl ${c}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-data">{label}</div>
    </div>
  );
}
