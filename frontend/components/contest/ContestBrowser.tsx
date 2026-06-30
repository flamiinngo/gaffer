"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Trophy, Users, Clock, Coins, Plus } from "lucide-react";

type Contest = {
  id: number;
  name: string;
  prizePoolOG: string;
  entryFeeOG: string;
  startTime: number;
  endTime: number;
  resolved: boolean;
  participantCount: number;
  status: "UPCOMING" | "LIVE" | "ENDED";
};

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = target * 1000 - now;
  if (left <= 0) return null;
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

const STATUS_STYLE: Record<Contest["status"], string> = {
  LIVE: "bg-grass/12 text-grass border-grass/30",
  UPCOMING: "bg-gold/12 text-gold border-gold/30",
  ENDED: "bg-line/40 text-data border-line",
};

function ContestCard({ c }: { c: Contest }) {
  return (
    <Link href={`/contest/${c.id}`} className="block">
      <div className="card card-hover flex h-full flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-data)] bg-grass/10 text-grass">
            <Trophy className="h-5 w-5" />
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[c.status]}`}
          >
            {c.status === "LIVE" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" />}
            {c.status}
          </span>
        </div>

        <h3 className="mt-5 text-lg font-semibold leading-snug text-chalk">{c.name}</h3>
        <p className="mt-1 text-xs text-data">
          {c.participantCount > 0
            ? `Live · ${c.participantCount} gaffers competing`
            : c.status === "ENDED"
              ? "Contest ended"
              : "Entries open — join now"}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-data)] border border-line bg-line">
          <Metric icon={<Coins className="h-3.5 w-3.5" />} label="Prize pool" value={`${Number(c.prizePoolOG).toFixed(2)} OG`} accent />
          <Metric icon={<Users className="h-3.5 w-3.5" />} label="Managers" value={String(c.participantCount)} />
          <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Entry fee" value={`${Number(c.entryFeeOG).toFixed(2)} OG`} />
          <Metric icon={<Trophy className="h-3.5 w-3.5" />} label="Contest" value={`#${c.id}`} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-medium text-grass transition-colors group-hover:text-grass">
            View contest →
          </span>
        </div>
      </div>
    </Link>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-midfield p-3">
      <div className="flex items-center gap-1.5 text-data">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`mt-1 text-sm font-semibold ${accent ? "text-gold" : "text-chalk"}`}>{value}</div>
    </div>
  );
}

export function ContestBrowser() {
  const [contests, setContests] = useState<Contest[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/contests", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setContests(d.contests ?? []))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Empty
        title="Couldn't reach the chain"
        body="The 0G RPC is syncing. Refresh in a moment — contest data is read live from the contract."
      />
    );
  }

  if (!contests) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-72 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }

  if (contests.length === 0) {
    return (
      <Empty
        title="No contests open yet"
        body="The first gaffer to enter sets the pace. Deploy yours and the contest fills around you."
        cta
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Link href="/contest/new" className="block">
        <div className="card card-hover flex h-full min-h-[200px] flex-col items-center justify-center gap-3 border-dashed border-grass/30 p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-grass/12 text-grass"><Plus className="h-6 w-6" /></span>
          <div>
            <h3 className="text-base font-semibold text-chalk">Open your own contest</h3>
            <p className="mx-auto mt-1 max-w-[14rem] text-xs text-data">Public or private, set the entry fee + a custom brief. Same autonomy rules apply.</p>
          </div>
        </div>
      </Link>
      {contests.map((c) => (
        <ContestCard key={c.id} c={c} />
      ))}
    </div>
  );
}

function Empty({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-20 text-center">
      <Trophy className="h-10 w-10 text-line" />
      <div>
        <h3 className="text-lg font-semibold text-chalk">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-data">{body}</p>
      </div>
      {cta && (
        <Button href="/onboard" variant="primary" size="md">
          Deploy your gaffer
        </Button>
      )}
    </div>
  );
}
