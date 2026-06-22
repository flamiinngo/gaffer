"use client";

import { useEffect, useRef, useState } from "react";

type Entry = {
  t: string;
  analysis: string;
  detail: string;
  decision: string;
  confidence: number;
  hash: string;
};

/** Representative reasoning stream — replaced by the agent's live 0G writes once deployed. */
const STREAM: Entry[] = [
  { t: "14:32:08", analysis: "Analyzing Bellingham vs. low block…", detail: "Form 8.4 avg L3 · opp 2 clean sheets · set-piece edge", decision: "CAPTAIN", confidence: 87, hash: "a3f2c91b" },
  { t: "14:33:41", analysis: "Hakimi overlap vs tiring full-back…", detail: "xA 0.38 · 4 key passes L2 · 78' stamina model", decision: "START RW", confidence: 81, hash: "7d1e44af" },
  { t: "14:35:12", analysis: "Rotating Saka → preserve for QF…", detail: "Yellow-card risk high · congestion 3 games / 8 days", decision: "BENCH", confidence: 73, hash: "c0aa19e2" },
  { t: "14:37:55", analysis: "Mbappé vs high line confirmed…", detail: "Opp def line 41m · pace differential +2.1σ", decision: "START ST", confidence: 92, hash: "f48b22d9" },
  { t: "14:40:03", analysis: "Vinícius 1v1 expected 6+ times…", detail: "Opp RB booked · dribble success 61%", decision: "START LW", confidence: 84, hash: "11c7e530" },
];

export function ReasoningFeed() {
  const [shown, setShown] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown >= STREAM.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), 3200);
    return () => clearTimeout(id);
  }, [shown]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [shown]);

  const entries = STREAM.slice(0, shown).reverse();

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-data">AI reasoning</h3>
        <span className="flex items-center gap-1.5 text-xs text-grass">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grass opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-grass" />
          </span>
          thinking
        </span>
      </div>
      <div ref={scrollRef} className="mono flex-1 space-y-3 overflow-y-auto pr-1 text-[12.5px] leading-relaxed">
        {entries.map((e) => (
          <div
            key={e.hash}
            className="rounded-[var(--radius-data)] border border-line bg-pitch px-3 py-2.5 [animation:var(--animate-rise)]"
          >
            <div className="text-data">[{e.t} UTC] {e.analysis}</div>
            <div className="mt-1 text-chalk/90">{e.detail}</div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-bold text-grass">
                → {e.decision} · {e.confidence}%
              </span>
              <span className="text-gold">0g://{e.hash}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
