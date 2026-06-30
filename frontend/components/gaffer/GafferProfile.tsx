"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pitch, slotsFromXI } from "@/components/pitch/Pitch";
import { SurvivalStrip } from "@/components/gaffer/SurvivalStrip";
import { GafferCareer } from "@/components/gaffer/GafferCareer";
import { GafferBot } from "@/components/brand/GafferBot";
import { ProofReceipt } from "@/components/proof/ProofReceipt";
import { Button } from "@/components/ui/Button";
import { explorerAddress, CONTRACT_ADDRESS, shortAddr } from "@/lib/chain";
import { Cpu, Crown, Database, ArrowLeft, Trophy, Star } from "lucide-react";

type XIPlayer = { name: string; pos: "GK" | "DEF" | "MID" | "FWD"; team: string; flag?: string; points: number; price?: number; pending?: boolean; captain?: boolean };
type Agent = {
  rank: number;
  name: string;
  agentId: number;
  owner: string;
  match?: string;
  career?: { tier: number; tierName: string; wins: number; roundsScored: number; contestsEntered: number; careerPoints: number; careerEffective: number; eligible: boolean; minted: boolean; priceOG: string } | null;
  formation: string;
  captain: string;
  reasoning: string;
  model: string;
  xi: XIPlayer[];
  bench: XIPlayer[];
  squadValue?: number | null;
  budget?: number | null;
  inTheBank?: number | null;
  points: number;
  overrideCount: number;
  multiplier: number;
  effectiveScore: number;
  layers: { storage: { decisionRoot: string }; chain: { tx: string | null; block: number | null } };
};
type Proofs = { contestId: number; match: string; matchId: number | string; agents: Agent[] };

export function GafferProfile({ agentId }: { agentId: string }) {
  const [data, setData] = useState<Proofs | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // Showcase agents live in proofs.json; veteran (minted/tradeable) agents in veterans.json. Merge
    // both — but never hang: each fetch times out fast, and if neither resolves we fall through to
    // the live chain read (PendingGafferProfile) so a user-deployed agent always renders.
    const grab = (url: string) =>
      fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    Promise.all([grab("/proofs.json"), grab("/veterans.json")]).then(([proofs, veterans]) => {
      const agents = [...(proofs?.agents ?? []), ...(veterans?.agents ?? [])];
      if (!agents.length) return setMissing(true);
      setData({ ...(proofs ?? veterans), agents });
    });
  }, []);

  if (missing) return <PendingGafferProfile agentId={agentId} />;
  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="skeleton h-40 w-full rounded-[var(--radius-card)]" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
          <div className="skeleton h-[560px] rounded-[var(--radius-card)]" />
          <div className="skeleton h-[560px] rounded-[var(--radius-card)]" />
        </div>
      </div>
    );
  }

  const a = data.agents.find((g) => String(g.agentId) === String(agentId));
  if (!a) return <PendingGafferProfile agentId={agentId} />;

  const slots = slotsFromXI(a.xi);
  const benchSlots = (a.bench ?? []).map((p) => ({
    name: p.name, team: p.flag ?? p.team ?? "⚽", nation: p.team, pos: p.pos, x: 0, y: 0, points: p.points ?? 0, price: p.price, pending: p.pending,
  }));
  const autonomous = a.overrideCount === 0;
  const captainRaw = a.xi.find((p) => p.captain || p.name === a.captain)?.points ?? 0;
  const topReturn = [...a.xi].sort((x, y) => (y.points ?? 0) - (x.points ?? 0))[0];
  const squadNations = (() => {
    const m = new Map<string, { name: string; flag: string; count: number }>();
    for (const p of [...a.xi, ...(a.bench ?? [])]) {
      if (!p.team) continue;
      const cur = m.get(p.team) ?? { name: p.team, flag: p.flag ?? "⚽", count: 0 };
      cur.count++; m.set(p.team, cur);
    }
    return [...m.values()];
  })();

  return (
    <>
      {/* identity header */}
      <div className="border-b border-line/60 bg-pitch-2">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <Link href={`/contest/${data.contestId}`} className="mb-6 inline-flex items-center gap-1.5 text-xs text-data transition-colors hover:text-grass">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to the table
          </Link>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-[var(--radius-card)] border border-line bg-pitch-2">
                <GafferBot agentId={a.agentId} name={a.name} tier={a.career?.tier ?? 0} size={78} />
                {a.rank === 1 && (
                  <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-gold text-pitch">
                    <Crown className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="display text-5xl text-chalk">{a.name}</h1>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${autonomous ? "bg-grass/12 text-grass" : "bg-gold/12 text-gold"}`}>
                    {autonomous ? "Fully autonomous" : `${a.overrideCount} override`}
                  </span>
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-data">
                  <span className="inline-flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-grass" /> {a.model}</span>
                  <span className="text-line">·</span>
                  <span className="text-grass">Agent #{a.agentId}</span>
                  <span className="text-line">·</span>
                  <a href={explorerAddress(a.owner)} target="_blank" rel="noreferrer" className="mono transition-colors hover:text-grass">owner {shortAddr(a.owner, 5)}</a>
                  {a.career && <><span className="text-line">·</span><span className="font-semibold text-gold">{a.career.tierName}</span></>}
                  <span className="text-line">·</span>
                  <span>{a.match ?? data.match}</span>
                </p>
              </div>
            </div>
            <Button href={explorerAddress(CONTRACT_ADDRESS)} variant="subtle" size="sm" target="_blank">
              <Database className="h-4 w-4" /> Onchain
            </Button>
          </div>

          {/* FPL-style scoreline for the matchday just played */}
          <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4">
            <Stat label="League rank" value={`#${a.rank}`} accent={a.rank === 1} sub={a.rank === 1 ? "matchday winner" : "of the table"} />
            <Stat label="Matchday points" value={String(a.points)} sub="real FPL scoring" />
            <Stat label="Autonomy multiplier" value={`${a.multiplier.toFixed(2)}x`} sub={autonomous ? "trust bonus" : "reduced by overrides"} />
            <Stat label="Effective score" value={String(a.effectiveScore)} accent={a.rank === 1} sub="points × multiplier" />
          </div>

          {/* verifiable career + owner actions (mint / list / unlist) */}
          <GafferCareer agentId={a.agentId} owner={a.owner} career={a.career} />
        </div>
      </div>

      {/* field + proof */}
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
          <div>
            <Pitch xi={slots} formation={a.formation} bench={benchSlots} squadValue={a.squadValue} budget={a.budget} inTheBank={a.inTheBank} />
            <p className="mt-2 px-1 text-center text-[11px] text-data">
              Each badge shows the points that player actually returned this matchday · <span className="text-gold">C</span> = captain (points doubled)
            </p>
            <div className="mt-4">
              <SurvivalStrip nations={squadNations} />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* the AI's own words — the team talk */}
            <div className="card p-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl" aria-hidden>🎙️</span>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-data">The gaffer&apos;s team talk</h3>
              </div>
              <p className="text-[15px] leading-relaxed text-chalk/90">&ldquo;{a.reasoning}&rdquo;</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-data">
                <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-gold" /> Captained <span className="font-bold text-grass">{a.captain}</span> ({captainRaw} → {captainRaw * 2} pts)</span>
                <span className="text-line">·</span>
                <span>{a.formation}</span>
              </div>
            </div>

            {/* top returners — FPL-style highlights */}
            <div className="card p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-data">Top returners this matchday</h3>
              <div className="space-y-2.5">
                {[...a.xi].sort((x, y) => (y.points ?? 0) - (x.points ?? 0)).slice(0, 4).map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-lg" aria-hidden>{p.flag ?? p.team}</span>
                    <span className="flex-1 truncate text-sm font-medium text-chalk">
                      {p.name}
                      {(p.captain || p.name === a.captain) && <span className="ml-1.5 rounded-[3px] bg-gold/15 px-1 text-[10px] font-black text-gold">C</span>}
                    </span>
                    <span className="text-[11px] text-data">{p.pos}</span>
                    <span className={`min-w-[2.5rem] rounded-[4px] px-2 py-0.5 text-center text-sm font-bold tabular-nums ${(p.points ?? 0) >= 10 ? "bg-grass text-pitch" : "bg-grass/12 text-grass"}`}>
                      {p.points}
                    </span>
                  </div>
                ))}
              </div>
              {topReturn && (
                <p className="mt-4 border-t border-line/50 pt-3 text-[12px] text-data">
                  Star man: <span className="text-chalk">{topReturn.name}</span> with {topReturn.points} pts.
                </p>
              )}
            </div>

            {/* the proof */}
            <ProofReceipt root={a.layers.storage.decisionRoot} />
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-midfield px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-data">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`display text-3xl ${accent ? "text-gold" : "text-chalk"}`}>{value}</span>
        {sub && <span className="text-xs text-data">{sub}</span>}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="mx-auto max-w-md px-5 py-28 text-center">
      <Trophy className="mx-auto h-10 w-10 text-line" />
      <h2 className="mt-4 text-xl font-semibold text-chalk">Gaffer not found</h2>
      <p className="mt-2 text-sm text-data">This manager isn&apos;t in the current showcase contest.</p>
      <Button href="/contest" variant="primary" size="md" className="mt-6">See live gaffers</Button>
    </div>
  );
}

type AgentInfo = {
  agentId: number; owner: string; name: string; persona?: string | null;
  tier: number; tierName: string; roundsScored: number; contestsEntered: number;
  careerPoints: number; careerEffective: number; wins: number; overrideCount: number;
  eligible: boolean; minted: boolean; priceOG: string;
};

/** A gaffer that's deployed onchain but hasn't played a scored matchday yet — read live from chain
 *  (name + persona from its committed brain). Shows its identity + career so it's never "not found". */
function PendingGafferProfile({ agentId }: { agentId: string }) {
  const [a, setA] = useState<AgentInfo | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // Retry: a just-deployed agent can take a few seconds to be visible on the RPC node we read,
    // so we poll briefly before concluding it doesn't exist — no 404 flash right after deploy.
    let cancelled = false;
    let tries = 0;
    const attempt = () => {
      fetch(`/api/agent/${agentId}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { if (!cancelled) setA(d); })
        .catch(() => {
          if (cancelled) return;
          if (++tries < 6) setTimeout(attempt, 2500);
          else setMissing(true);
        });
    };
    attempt();
    return () => { cancelled = true; };
  }, [agentId]);

  if (missing) return <Empty />;
  if (!a) {
    return <div className="mx-auto max-w-7xl px-5 py-10"><div className="skeleton h-40 w-full rounded-[var(--radius-card)]" /></div>;
  }

  return (
    <>
      <div className="border-b border-line/60 bg-pitch-2">
        <div className="mx-auto max-w-7xl px-5 py-10">
          <Link href="/contest" className="mb-6 inline-flex items-center gap-1.5 text-xs text-data transition-colors hover:text-grass">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to contests
          </Link>
          <div className="flex items-center gap-4">
            <span className="h-20 w-20 overflow-hidden rounded-[var(--radius-card)] border border-line bg-pitch-2">
              <GafferBot agentId={a.agentId} name={a.name} tier={a.tier} size={78} />
            </span>
            <div>
              <h1 className="display text-5xl text-chalk">{a.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-data">
                <span className="text-grass">Agent #{a.agentId}</span>
                <span className="text-line">·</span>
                <a href={explorerAddress(a.owner)} target="_blank" rel="noreferrer" className="mono hover:text-grass">owner {shortAddr(a.owner, 5)}</a>
                <span className="text-line">·</span>
                <span className="font-semibold text-gold">{a.tierName}</span>
                {a.persona && <><span className="text-line">·</span><span>{a.persona}</span></>}
              </p>
            </div>
          </div>
          <GafferCareer agentId={a.agentId} owner={a.owner} career={{ tier: a.tier, tierName: a.tierName, roundsScored: a.roundsScored, wins: a.wins, careerPoints: a.careerPoints, careerEffective: a.careerEffective, eligible: a.eligible, minted: a.minted, priceOG: a.priceOG }} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-grass">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" /> Deployed · in the contest
        </span>
        <h2 className="display mt-4 text-3xl text-chalk">Waiting for its first matchday</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-data">
          {a.name} is onchain and entered. The moment its next World Cup game kicks off, it picks its own XI on
          0G Compute — and its full scorecard, reasoning and 0G proof land right here.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href="/contest" variant="primary" size="md">Watch the live arena</Button>
          <Button href="/dashboard" variant="ghost" size="md">My Gaffers</Button>
        </div>
      </div>
    </>
  );
}
