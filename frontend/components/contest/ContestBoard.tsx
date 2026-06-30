"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pitch, slotsFromXI } from "@/components/pitch/Pitch";
import { Button } from "@/components/ui/Button";
import { GafferBot } from "@/components/brand/GafferBot";
import { shortAddr } from "@/lib/chain";
import { ShieldCheck, Crown, ChevronRight } from "lucide-react";

const TIER_NAMES = ["Rookie", "Pro", "Elite", "Legend"];

type OnchainRow = { rank: number; agentId: number; owner: string; points: number; overrideCount: number; multiplier: number; effectiveScore: number; tierName?: string };
type LbRow = { agentId: number; name: string; captain: string; formation: string; reasoning: string };
type XIPlayer = { name: string; pos: "GK" | "DEF" | "MID" | "FWD"; team: string; flag?: string; points: number; price?: number; pending?: boolean; captain?: boolean };
type King = { agentId: number; name: string; captain: string; formation: string; reasoning: string; xi: XIPlayer[]; bench?: XIPlayer[]; squadValue?: number | null; budget?: number | null; inTheBank?: number | null };
type Board = { contestId: number; rows: LbRow[]; king: King | null };

export function ContestBoard({ contestId, rows }: { contestId: number; rows: OnchainRow[] }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/leaderboard.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setBoard(d))
      .catch(() => setBoard(null));
  }, []);

  const featured = board?.contestId === contestId;
  const nameMap = new Map<number, LbRow>();
  if (featured) for (const r of board!.rows) nameMap.set(r.agentId, r);

  // Resolve names for entrants not in the showcase manifest (e.g. user-deployed gaffers) from chain.
  useEffect(() => {
    rows.forEach((r) => {
      if (nameMap.has(r.agentId) || names[r.agentId]) return;
      fetch(`/api/agent/${r.agentId}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((info) => info?.name && setNames((n) => ({ ...n, [r.agentId]: info.name })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, board]);

  const king = featured ? board!.king : null;
  const kingAgentId = rows.find((r) => r.rank === 1)?.agentId ?? rows[0]?.agentId;
  const kingSlots = king ? slotsFromXI(king.xi) : [];
  const kingBench = (king?.bench ?? []).map((p) => ({ name: p.name, team: p.flag ?? p.team ?? "⚽", nation: p.team, pos: p.pos, x: 0, y: 0, points: p.points ?? 0, price: p.price, pending: p.pending }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* leaderboard */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-data">Leaderboard</h2>
        {rows.length === 0 ? (
          <div className="card px-6 py-14 text-center">
            <p className="text-sm text-data">No gaffers yet — be the first to deploy here.</p>
            <Button href="/onboard" variant="primary" size="md" className="mt-4">Deploy your gaffer</Button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[28px_1fr_48px_52px_60px_16px] gap-2 border-b border-line px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-data">
              <span>#</span><span>Gaffer</span><span className="text-right">Pts</span><span className="text-right">Mult</span><span className="text-right">Score</span><span />
            </div>
            {rows.map((r) => {
              const meta = nameMap.get(r.agentId);
              const displayName = meta?.name ?? names[r.agentId] ?? shortAddr(r.owner, 5);
              const botName = meta?.name ?? names[r.agentId] ?? `Agent ${r.agentId}`;
              const cells = (
                <>
                  <span className={`font-bold ${r.rank === 1 ? "text-gold" : r.rank === 2 ? "text-chalk" : "text-[#CD7F32]"}`}>{r.rank}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="hidden h-8 w-8 shrink-0 overflow-hidden rounded-md bg-pitch-2 sm:block"><GafferBot agentId={r.agentId} name={botName} tier={Math.max(0, TIER_NAMES.indexOf(r.tierName ?? "Rookie"))} size={32} /></span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-chalk group-hover:text-grass">{displayName}</div>
                      <div className="truncate text-[11px] text-data">
                        {meta?.formation ? `${meta.formation} · ` : ""}{meta?.captain ? `cap ${meta.captain} · ` : meta ? "" : "no pick yet · "}{r.overrideCount} override{r.overrideCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <span className="text-right tabular-nums text-chalk">{r.points}</span>
                  <span className={`text-right tabular-nums ${r.overrideCount === 0 ? "text-grass" : "text-data"}`}>{r.multiplier.toFixed(2)}x</span>
                  <span className="text-right font-bold tabular-nums text-gold">{r.effectiveScore}</span>
                  <ChevronRight className="h-4 w-4 text-line transition-colors group-hover:text-grass" />
                </>
              );
              const cls = `grid grid-cols-[28px_1fr_48px_52px_60px_16px] items-center gap-2 border-b border-line/50 px-4 py-3 text-sm last:border-0 ${r.rank === 1 ? "bg-gold/[0.04]" : ""}`;
              return (
                <Link key={r.agentId} href={`/gaffer/${r.agentId}`} className={`group ${cls} transition-colors hover:bg-midfield ${r.rank === 1 ? "hover:bg-gold/[0.09]" : ""}`}>
                  {cells}
                </Link>
              );
            })}
            <div className="border-t border-line/50 px-4 py-3 text-[11px] leading-relaxed text-data">
              Tap any gaffer that has played to see its full XI, reasoning and live 0G proof · ranked by{" "}
              <span className="text-chalk">effective score = points × autonomy multiplier</span>.
            </div>
          </div>
        )}
      </section>

      {/* leading gaffer's XI — the AI's actual selection */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-data">
          {king && <Crown className="h-4 w-4 text-gold" />}
          {king ? `Leader's XI — ${king.name}` : "Leading XI"}
        </h2>
        {king ? (
          <div className="space-y-4">
            <Pitch xi={kingSlots} formation={king.formation} bench={kingBench} squadValue={king.squadValue} budget={king.budget} inTheBank={king.inTheBank} />
            <div className="mono rounded-[var(--radius-data)] border border-line bg-pitch px-3 py-2.5 text-[12.5px] leading-relaxed">
              <div className="text-data">Captain → <span className="font-bold text-grass">{king.captain.toUpperCase()}</span></div>
              <div className="mt-1.5 text-chalk/90">{king.reasoning}</div>
            </div>
            {kingAgentId != null && (
              <Button href={`/gaffer/${kingAgentId}`} variant="ghost" size="sm" className="w-full justify-center">
                <Crown className="h-4 w-4" /> View {king.name}&apos;s full scorecard &amp; proof
              </Button>
            )}
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ShieldCheck className="h-9 w-9 text-line" />
            <p className="max-w-xs text-sm text-data">
              Each gaffer&apos;s XI is picked by its AI every matchday and stored on 0G. Watch the live arena to see a team take shape.
            </p>
            <Button href="/dashboard" variant="ghost" size="sm">Watch live</Button>
          </div>
        )}
      </section>
    </div>
  );
}
