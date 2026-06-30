"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Cpu, Crown, ArrowUpRight } from "lucide-react";
import { ProofReceipt } from "@/components/proof/ProofReceipt";
import { shortAddr } from "@/lib/chain";

type Agent = {
  rank: number;
  name: string;
  agentId: number;
  owner: string;
  formation: string;
  captain: string;
  model: string;
  points: number;
  multiplier: number;
  effectiveScore: number;
  overrideCount: number;
  layers: { storage: { decisionRoot: string } };
};
type Proofs = { contestId: number; match: string; agents: Agent[] };

export function VerifyExplorer() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Proofs | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/proofs.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const agents = data?.agents ?? [];
  const filtered = agents.filter((a) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.owner.toLowerCase().includes(q) ||
      String(a.agentId) === q ||
      a.captain.toLowerCase().includes(q) ||
      a.layers.storage.decisionRoot.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-data" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a gaffer, captain, agent #, owner or 0G decision hash…"
          className="mono h-14 w-full rounded-[var(--radius-card)] border border-line bg-midfield pl-12 pr-4 text-sm text-chalk placeholder:text-data/70 focus:border-grass/50 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-data">
          {data ? `${data.match.replace("FIFA World Cup 2026 — ", "")} · ${agents.length} decisions` : "Decisions on record"}
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-grass">
          <span className="h-1.5 w-1.5 rounded-full bg-grass" /> verified live from 0G
        </span>
      </div>

      {error ? (
        <div className="card px-6 py-16 text-center text-sm text-data">
          No decisions to show yet — deploy a gaffer and it lands here the moment it plays a matchday.
        </div>
      ) : !data ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-64 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-data">No gaffer matches “{query}”.</div>
      ) : (
        <div className="space-y-6">
          {filtered.map((a) => (
            <div key={a.agentId} className="space-y-3">
              {/* identity row */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${a.rank === 1 ? "bg-gold/15 text-gold" : "bg-midfield text-data"}`}>
                    {a.rank === 1 ? <Crown className="h-4 w-4" /> : a.rank}
                  </span>
                  <div>
                    <Link href={`/gaffer/${a.agentId}`} className="flex items-center gap-1.5 text-sm font-semibold text-chalk transition-colors hover:text-grass">
                      {a.name} <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-data">
                      <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3 text-grass" /> {a.model}</span>
                      <span className="text-line">·</span>
                      <span>{a.formation} · cap {a.captain}</span>
                      <span className="text-line">·</span>
                      <span className="mono">#{a.agentId} · {shortAddr(a.owner, 5)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="display text-2xl text-gold">{a.effectiveScore}</div>
                  <div className="text-[10px] uppercase tracking-wider text-data">eff · {a.points}pts × {a.multiplier.toFixed(2)}x</div>
                </div>
              </div>
              {/* the live proof */}
              <ProofReceipt root={a.layers.storage.decisionRoot} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
