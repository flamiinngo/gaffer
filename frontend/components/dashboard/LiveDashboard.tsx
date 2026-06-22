"use client";

import { useEffect, useState } from "react";
import { Pitch, slotsFromXI } from "@/components/pitch/Pitch";
import { MultiplierMeter } from "@/components/dashboard/MultiplierMeter";
import { Button } from "@/components/ui/Button";
import { GafferMark } from "@/components/brand/Logo";
import { EXPLORER_URL, CONTRACT_ADDRESS, explorerAddress } from "@/lib/chain";
import { Cpu, ShieldCheck, Database, Trophy, ExternalLink } from "lucide-react";

type XIPlayer = { name: string; pos: "GK" | "DEF" | "MID" | "FWD"; team: string; flag?: string; points: number; captain?: boolean };
type Snapshot = {
  managerName: string;
  match: string;
  score: string;
  formation: string;
  captain: string;
  reasoning: string;
  xi: XIPlayer[];
  totalPoints: number;
  model: string;
  contestId: number;
  decisionRoot: string;
  onchain: { totalPoints: number; overrideCount: number; multiplier: number; effectiveScore: number };
};

export function LiveDashboard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch("/gaffer-latest.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setMissing(true));
  }, []);

  if (missing) {
    return (
      <div className="mx-auto max-w-md px-5 py-28 text-center">
        <Trophy className="mx-auto h-10 w-10 text-line" />
        <h2 className="mt-4 text-xl font-semibold text-chalk">No gaffer deployed yet</h2>
        <p className="mt-2 text-sm text-data">Deploy one and watch it run a real World Cup matchday autonomously.</p>
        <Button href="/onboard" variant="primary" size="md" className="mt-6">Deploy a gaffer</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]">
          <div className="skeleton h-[560px] rounded-[var(--radius-card)]" />
          <div className="flex flex-col gap-6">
            <div className="skeleton h-40 rounded-[var(--radius-card)]" />
            <div className="skeleton h-80 rounded-[var(--radius-card)]" />
          </div>
        </div>
      </div>
    );
  }

  const slots = slotsFromXI(data.xi);

  return (
    <>
      {/* header */}
      <div className="border-b border-line/60 bg-pitch-2">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-card)] border border-line bg-midfield">
              <GafferMark className="h-8 w-9" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="display text-4xl text-chalk">{data.managerName}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                  FINAL
                </span>
              </div>
              <p className="mt-1 text-sm text-data">
                World Cup 2026 · {data.match} <span className="text-chalk">{data.score}</span> · contest #{data.contestId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button href="/verify" variant="ghost" size="sm"><ShieldCheck className="h-4 w-4" /> Verify on 0G</Button>
            <Button href={explorerAddress(CONTRACT_ADDRESS)} variant="subtle" size="sm" target="_blank"><Database className="h-4 w-4" /> Onchain</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]">
          {/* pitch */}
          <Pitch xi={slots} formation={data.formation} />

          {/* intel */}
          <div className="flex flex-col gap-6">
            <MultiplierMeter
              multiplier={data.onchain.multiplier}
              overrides={data.onchain.overrideCount}
              atRisk={data.onchain.overrideCount > 0}
            />

            {/* real decision + proof */}
            <div className="card flex flex-1 flex-col p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-data">AI decision</h3>
                <span className="flex items-center gap-1.5 text-xs text-grass">
                  <Cpu className="h-3.5 w-3.5" /> {data.model}
                </span>
              </div>
              <div className="mono space-y-3 text-[12.5px] leading-relaxed">
                <div className="rounded-[var(--radius-data)] border border-line bg-pitch px-3 py-2.5">
                  <div className="text-data">Captain decision → <span className="font-bold text-grass">{data.captain.toUpperCase()}</span></div>
                  <div className="mt-1.5 text-chalk/90">{data.reasoning}</div>
                </div>
                <a
                  href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-[var(--radius-data)] border border-line bg-pitch px-3 py-2.5 transition-colors hover:border-grass/40"
                >
                  <span className="text-data">0G Storage proof</span>
                  <span className="flex items-center gap-1.5 text-gold">
                    0g://{data.decisionRoot.slice(2, 10)}…{data.decisionRoot.slice(-6)} <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4">
          <Stat label="Match points" value={String(data.onchain.totalPoints)} sub="real FPL" />
          <Stat label="Multiplier" value={`${data.onchain.multiplier.toFixed(2)}x`} sub={data.onchain.overrideCount === 0 ? "autonomous" : `${data.onchain.overrideCount} override`} accent />
          <Stat label="Effective score" value={String(data.onchain.effectiveScore)} sub="points × mult" />
          <Stat label="Brain" value="0G Compute" sub={data.model.split("/").pop() ?? data.model} />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-midfield px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-data">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`display text-3xl ${accent ? "text-gold" : "text-chalk"}`}>{value}</span>
        <span className="text-xs text-data">{sub}</span>
      </div>
    </div>
  );
}
