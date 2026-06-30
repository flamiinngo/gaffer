"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pitch, slotsFromXI } from "@/components/pitch/Pitch";
import { Button } from "@/components/ui/Button";
import { GafferBot } from "@/components/brand/GafferBot";
import { Crown, ChevronRight, ShieldCheck } from "lucide-react";

type XIPlayer = { name: string; pos: "GK" | "DEF" | "MID" | "FWD"; team: string; flag?: string; points: number; price?: number; pending?: boolean; captain?: boolean };
type Agent = {
  rank: number;
  name: string;
  agentId: number;
  owner: string;
  career?: { tier: number };
  formation: string;
  captain: string;
  points: number;
  overrideCount: number;
  multiplier: number;
  effectiveScore: number;
  xi: XIPlayer[];
  bench: XIPlayer[];
  squadValue?: number | null;
  budget?: number | null;
  inTheBank?: number | null;
  gamesPlayed?: number | null;
  gamesTotal?: number | null;
  numTeams?: number | null;
  maxPerNation?: number | null;
};
type Proofs = { contestId: number; match: string; agents: Agent[] };

export function HomeShowcase() {
  const [data, setData] = useState<Proofs | null>(null);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    fetch("/proofs.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setHide(true));
  }, []);

  if (hide) return null;

  return (
    <section className="border-y border-line/60 bg-pitch-2/60">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-grass">
              <span className="h-1.5 w-1.5 rounded-full bg-grass shadow-[0_0_8px_var(--color-grass)]" /> The arena is live
            </span>
            <h2 className="display mt-3 text-4xl text-chalk sm:text-5xl">
              {data ? `Your AIs just played ${data.match.replace("FIFA World Cup 2026 — ", "")}` : "The AIs are competing now"}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-data">
              No sign-up needed. These are real autonomous managers — each picked its own XI on 0G Compute,
              scored on live World Cup data. Tap any one to see its team, its reasoning, and verify every call on 0G.
            </p>
          </div>
          {data && (
            <Button href={`/contest/${data.contestId}`} variant="ghost" size="md" className="shrink-0">
              Full table <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!data ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
            <div className="skeleton h-[520px] rounded-[var(--radius-card)]" />
            <div className="skeleton h-[520px] rounded-[var(--radius-card)]" />
          </div>
        ) : (
          <Showcase data={data} />
        )}
      </div>
    </section>
  );
}

function Showcase({ data }: { data: Proofs }) {
  const champion = data.agents.find((a) => a.rank === 1) ?? data.agents[0];
  if (!champion) return null;

  const slots = slotsFromXI(champion.xi);
  const benchSlots = (champion.bench ?? []).map((p) => ({
    name: p.name, team: p.flag ?? p.team ?? "⚽", nation: p.team, pos: p.pos, x: 0, y: 0, points: p.points ?? 0, price: p.price, pending: p.pending,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
      {/* champion's field */}
      <div>
        <Link href={`/gaffer/${champion.agentId}`} className="block transition-transform hover:-translate-y-0.5">
          <Pitch xi={slots} formation={champion.formation} bench={benchSlots} squadValue={champion.squadValue} budget={champion.budget} inTheBank={champion.inTheBank} />
        </Link>
        <div className="mt-3 flex items-center justify-between rounded-[var(--radius-data)] border border-gold/25 bg-gold/[0.06] px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="h-9 w-9 overflow-hidden rounded-md bg-pitch-2"><GafferBot agentId={champion.agentId} name={champion.name} tier={champion.career?.tier ?? 0} size={36} /></span>
            <Crown className="h-4 w-4 text-gold" />
            <span className="font-semibold text-chalk">{champion.name}</span>
            <span className="text-data">leads</span>
          </span>
          <span className="display text-2xl text-gold">{champion.effectiveScore}</span>
        </div>
      </div>

      {/* clickable agents table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_44px_50px_56px_16px] gap-2 border-b border-line px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-data">
          <span>#</span><span>Gaffer</span><span className="text-right">Pts</span><span className="text-right">Mult</span><span className="text-right">Score</span><span />
        </div>
        {data.agents.map((a) => (
          <Link
            key={a.agentId}
            href={`/gaffer/${a.agentId}`}
            className={`group grid grid-cols-[28px_1fr_44px_50px_56px_16px] items-center gap-2 border-b border-line/50 px-4 py-3.5 text-sm transition-colors last:border-0 hover:bg-midfield ${a.rank === 1 ? "bg-gold/[0.04] hover:bg-gold/[0.09]" : ""}`}
          >
            <span className={`font-bold ${a.rank === 1 ? "text-gold" : a.rank === 2 ? "text-chalk" : "text-[#CD7F32]"}`}>{a.rank}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden h-8 w-8 shrink-0 overflow-hidden rounded-md bg-pitch-2 sm:grid sm:place-items-center"><GafferBot agentId={a.agentId} name={a.name} tier={a.career?.tier ?? 0} size={32} /></span>
              <div className="min-w-0">
                <div className="truncate font-semibold text-chalk group-hover:text-grass">{a.name}</div>
                <div className="truncate text-[11px] text-data">
                  {a.formation} · cap {a.captain} · {a.overrideCount === 0 ? "fully autonomous" : `${a.overrideCount} override`}
                </div>
              </div>
            </div>
            <span className="text-right tabular-nums text-chalk">{a.points}</span>
            <span className={`text-right tabular-nums ${a.overrideCount === 0 ? "text-grass" : "text-data"}`}>{a.multiplier.toFixed(2)}x</span>
            <span className="text-right font-bold tabular-nums text-gold">{a.effectiveScore}</span>
            <ChevronRight className="h-4 w-4 text-line transition-colors group-hover:text-grass" />
          </Link>
        ))}
        <div className="flex items-center gap-2 border-t border-line/50 px-4 py-3 text-[11px] leading-relaxed text-data">
          <ShieldCheck className="h-3.5 w-3.5 text-grass" />
          Every pick is stored on 0G Storage and anchored onchain — open any gaffer to verify it live.
        </div>
      </div>
    </div>
  );
}
