"use client";

import { useEffect, useState } from "react";
import { Search, ShieldCheck, ExternalLink, Cpu } from "lucide-react";
import { explorerTx, shortAddr } from "@/lib/chain";

type Decision = {
  contestId: number;
  owner: string;
  matchId: number;
  points: number;
  decisionHash: string;
  block: number;
  tx: string;
};

export function VerifyExplorer() {
  const [query, setQuery] = useState("");
  const [decisions, setDecisions] = useState<Decision[] | null>(null);

  useEffect(() => {
    fetch("/api/decisions", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDecisions(d.decisions ?? []))
      .catch(() => setDecisions([]));
  }, []);

  const filtered =
    decisions?.filter(
      (d) =>
        !query ||
        d.owner.toLowerCase().includes(query.toLowerCase()) ||
        d.decisionHash.toLowerCase().includes(query.toLowerCase())
    ) ?? null;

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-data" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a gaffer address or 0G decision hash…"
          className="mono h-14 w-full rounded-[var(--radius-card)] border border-line bg-midfield pl-12 pr-4 text-sm text-chalk placeholder:text-data/70 focus:border-grass/50 focus:outline-none"
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-data">
            Latest decisions
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-grass">
            <span className="h-1.5 w-1.5 rounded-full bg-grass" /> read live from 0G
          </span>
        </div>

        {filtered === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-24 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
            <Cpu className="h-10 w-10 text-line" />
            <div>
              <h3 className="text-lg font-semibold text-chalk">No decisions on the books yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-data">
                The moment a gaffer is deployed and a match kicks off, its reasoning lands here —
                written to 0G Storage, proven on 0G DA, and recorded onchain. Every pick, every
                reason, permanent and public.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((d) => (
              <DecisionRow key={d.tx + d.matchId} d={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionRow({ d }: { d: Decision }) {
  return (
    <div className="card card-hover p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-data)] bg-grass/10 text-grass">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <div className="mono text-sm text-chalk">{shortAddr(d.owner, 6)}</div>
            <div className="text-xs text-data">
              Contest #{d.contestId} · Match {d.matchId} · +{d.points} pts
            </div>
          </div>
        </div>
        <a
          href={explorerTx(d.tx)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-data transition-colors hover:text-grass"
        >
          block {d.block} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="mono mt-4 truncate rounded-[var(--radius-data)] border border-line bg-pitch px-3 py-2 text-xs text-gold">
        0g://{d.decisionHash.replace(/^0g:\/\//, "")}
      </div>
    </div>
  );
}
