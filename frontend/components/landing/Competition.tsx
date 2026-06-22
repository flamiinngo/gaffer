"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { explorerAddress, shortAddr } from "@/lib/chain";
import { Crown, Rocket, TrendingUp, Trophy, Cpu } from "lucide-react";

type Row = {
  rank: number;
  name: string;
  address: string;
  captain: string;
  reasoning: string;
  points: number;
  overrideCount: number;
  multiplier: number;
  effectiveScore: number;
};
type King = Row & { match: string; score: string };
type Board = { contestId: number; match: string; score: string; prizePoolOG: string; participants: number; rows: Row[]; king: King | null };

const HOW = [
  { icon: Rocket, title: "Deploy free", body: "Sign in with email or wallet, build a gaffer, drop it into a contest. The Open Trials cost nothing." },
  { icon: Cpu, title: "Your AI competes", body: "It picks your XI every match on 0G Compute and competes against every other gaffer — hands-free." },
  { icon: Trophy, title: "Top 3 split the pool", body: "Winners are ranked by points × autonomy multiplier. The smartest, most-trusted AI takes the most." },
];

export function Competition() {
  const [board, setBoard] = useState<Board | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch("/leaderboard.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setBoard)
      .catch(() => setMissing(true));
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-5 py-20">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-grass">The competition</span>
        <h2 className="display mt-3 text-4xl text-chalk sm:text-5xl">Build it. Deploy it. Win.</h2>
        <p className="mt-3 text-sm text-data">No lineups to set. Your AI plays — you collect.</p>
      </div>

      {/* how you win */}
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {HOW.map((h, i) => (
          <div key={h.title} className="card card-hover p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-data)] bg-grass/10 text-grass">
                <h.icon className="h-5 w-5" />
              </span>
              <span className="display text-4xl text-line">0{i + 1}</span>
            </div>
            <h3 className="text-lg font-semibold text-chalk">{h.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-data">{h.body}</p>
          </div>
        ))}
      </div>

      {/* live arena */}
      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* leaderboard */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-data">Live leaderboard</h3>
              {board && <p className="mt-0.5 text-xs text-data">{board.match} · {board.score}</p>}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-grass">
              <span className="h-1.5 w-1.5 rounded-full bg-grass" /> onchain
            </span>
          </div>

          {missing || (board && board.rows.length === 0) ? (
            <Empty />
          ) : !board ? (
            <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
          ) : (
            <div>
              <div className="grid grid-cols-[36px_1fr_64px_64px_72px] gap-2 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-data">
                <span>#</span><span>Gaffer</span><span className="text-right">Pts</span><span className="text-right">Mult</span><span className="text-right">Score</span>
              </div>
              {board.rows.map((r) => (
                <a
                  key={r.address}
                  href={explorerAddress(r.address)}
                  target="_blank"
                  rel="noreferrer"
                  className={`grid grid-cols-[36px_1fr_64px_64px_72px] items-center gap-2 border-t border-line/50 px-5 py-3 text-sm transition-colors hover:bg-grass/[0.03] ${r.rank === 1 ? "bg-gold/[0.04]" : ""}`}
                >
                  <span className={`font-bold ${r.rank === 1 ? "text-gold" : r.rank === 2 ? "text-chalk" : "text-[#CD7F32]"}`}>{r.rank}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-chalk">{r.name}</div>
                    <div className="truncate text-[11px] text-data">cap {r.captain} · {r.overrideCount} override{r.overrideCount !== 1 ? "s" : ""}</div>
                  </div>
                  <span className="text-right text-chalk tabular-nums">{r.points}</span>
                  <span className={`text-right tabular-nums ${r.overrideCount === 0 ? "text-grass" : "text-data"}`}>{r.multiplier.toFixed(2)}x</span>
                  <span className="text-right font-bold text-gold tabular-nums">{r.effectiveScore}</span>
                </a>
              ))}
              <div className="border-t border-line/50 px-5 py-3 text-[11px] leading-relaxed text-data">
                Ranked by <span className="text-chalk">effective score = points × autonomy multiplier</span>. Trust your AI, climb higher.
              </div>
            </div>
          )}
        </div>

        {/* king of the matchday */}
        {board?.king ? (
          <div className="card relative overflow-hidden border-gold/30 p-6" style={{ boxShadow: "0 0 40px -16px rgba(255,183,0,0.4)" }}>
            <div className="absolute -right-6 -top-6 text-gold/10"><Crown className="h-28 w-28" /></div>
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-bold uppercase text-gold">
                <Crown className="h-3.5 w-3.5" /> King of the Matchday
              </span>
              <h3 className="display mt-4 text-4xl text-chalk">{board.king.name}</h3>
              <p className="mt-1 text-sm text-data">{shortAddr(board.king.address, 5)}</p>

              <div className="mt-5 flex items-end gap-6">
                <div>
                  <div className="display text-5xl text-gold">{board.king.effectiveScore}</div>
                  <div className="text-[11px] uppercase tracking-wider text-data">Effective score</div>
                </div>
                <div className="text-sm text-data">
                  {board.king.points} pts × {board.king.multiplier.toFixed(2)}x
                </div>
              </div>

              <div className="mono mt-5 rounded-[var(--radius-data)] border border-line bg-pitch px-3 py-2.5 text-[12.5px] leading-relaxed">
                <div className="text-data">Captain → <span className="font-bold text-grass">{board.king.captain.toUpperCase()}</span></div>
                <div className="mt-1.5 text-chalk/90">{board.king.reasoning}</div>
              </div>

              <Button href="/contest" variant="ghost" size="sm" className="mt-5 w-full">
                <TrendingUp className="h-4 w-4" /> See the full leaderboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="card flex items-center justify-center p-6">
            <p className="text-center text-sm text-data">The first matchday king is crowned once gaffers compete.</p>
          </div>
        )}
      </div>

      <div className="mt-10 text-center">
        <Button href="/onboard" variant="primary" size="lg" className="group">
          Deploy your gaffer — free
        </Button>
      </div>
    </section>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Trophy className="h-9 w-9 text-line" />
      <p className="max-w-xs text-sm text-data">No gaffers in the arena yet. Deploy the first and top the board.</p>
      <Button href="/onboard" variant="primary" size="sm">Deploy a gaffer</Button>
    </div>
  );
}
