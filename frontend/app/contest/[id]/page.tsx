import { notFound } from "next/navigation";
import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/Button";
import { ContestBoard } from "@/components/contest/ContestBoard";
import { readContestDetail } from "@/lib/server/contract";
import { Trophy, Users, Coins } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  LIVE: "bg-grass/12 text-grass border-grass/30",
  UPCOMING: "bg-gold/12 text-gold border-gold/30",
  ENDED: "bg-line/40 text-data border-line",
};

export default async function ContestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await readContestDetail(Number(id)).catch(() => null);
  if (!data) notFound();
  const { contest, leaderboard } = data;

  // A contest with scored gaffers is live/in-progress, not "upcoming".
  const hasResults = leaderboard.some((r) => r.totalPoints > 0);
  const status = hasResults ? "LIVE" : contest.status;

  const rows = leaderboard.map((r) => ({
    rank: r.rank,
    owner: r.owner,
    points: r.totalPoints,
    overrideCount: r.overrideCount,
    multiplier: r.multiplier / 100,
    effectiveScore: r.effectiveScore,
  }));

  return (
    <PageShell>
      <div className="border-b border-line/60 bg-pitch-2">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${STATUS_STYLE[status]}`}>
              {status === "LIVE" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" />}
              {status}
            </span>
            <span className="text-xs text-data">Contest #{contest.id}</span>
          </div>
          <h1 className="display mt-3 text-5xl text-chalk sm:text-6xl">{contest.name}</h1>
          <div className="mt-6 flex flex-wrap gap-6">
            <HeaderStat icon={<Coins className="h-4 w-4" />} label="Prize pool" value={`${Number(contest.prizePoolOG).toFixed(2)} OG`} accent />
            <HeaderStat icon={<Trophy className="h-4 w-4" />} label="Entry fee" value={`${Number(contest.entryFeeOG).toFixed(2)} OG`} />
            <HeaderStat icon={<Users className="h-4 w-4" />} label="Gaffers" value={String(contest.participantCount)} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <ContestBoard contestId={contest.id} rows={rows} />
        <div className="mt-10 text-center">
          <Button href="/onboard" variant="primary" size="lg">Deploy a gaffer here</Button>
        </div>
      </div>
    </PageShell>
  );
}

function HeaderStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-data">{icon}<span className="text-[11px] uppercase tracking-wider">{label}</span></div>
      <div className={`display mt-1 text-3xl ${accent ? "text-gold" : "text-chalk"}`}>{value}</div>
    </div>
  );
}
