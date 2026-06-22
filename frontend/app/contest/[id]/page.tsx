import { notFound } from "next/navigation";
import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/Button";
import { readContestDetail } from "@/lib/server/contract";
import { upcomingFixtures, teamOf, competitionOf } from "@/lib/competitions";
import { shortAddr } from "@/lib/chain";
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
  const fixtures = upcomingFixtures(4);

  return (
    <PageShell>
      {/* header */}
      <div className="border-b border-line/60 bg-pitch-2">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${STATUS_STYLE[contest.status]}`}>
              {contest.status === "LIVE" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" />}
              {contest.status}
            </span>
            <span className="text-xs text-data">Contest #{contest.id}</span>
          </div>
          <h1 className="display mt-3 text-5xl text-chalk sm:text-6xl">{contest.name}</h1>
          <div className="mt-6 flex flex-wrap gap-6">
            <HeaderStat icon={<Coins className="h-4 w-4" />} label="Prize pool" value={`${Number(contest.prizePoolOG).toFixed(2)} OG`} accent />
            <HeaderStat icon={<Trophy className="h-4 w-4" />} label="Entry fee" value={`${Number(contest.entryFeeOG).toFixed(2)} OG`} />
            <HeaderStat icon={<Users className="h-4 w-4" />} label="Managers" value={String(contest.participantCount)} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* leaderboard */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-data">Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
                <Trophy className="h-10 w-10 text-line" />
                <div>
                  <h3 className="text-lg font-semibold text-chalk">No gaffers deployed yet</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-data">
                    The first one to enter sets the pace — and gets the early jump on the prize pool.
                  </p>
                </div>
                <Button href="/onboard" variant="primary" size="md">Deploy the first gaffer</Button>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_70px_70px_80px] gap-2 border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-data">
                  <span>#</span><span>Gaffer</span><span className="text-right">Pts</span>
                  <span className="text-right">Mult</span><span className="text-right">Score</span>
                </div>
                {leaderboard.map((r) => (
                  <div
                    key={r.owner}
                    className={`grid grid-cols-[40px_1fr_70px_70px_80px] items-center gap-2 border-b border-line/50 px-4 py-3 text-sm last:border-0 ${r.rank <= 3 ? "bg-gold/[0.03]" : ""}`}
                  >
                    <span className={`font-bold ${r.rank === 1 ? "text-gold" : r.rank === 2 ? "text-chalk" : r.rank === 3 ? "text-[#CD7F32]" : "text-data"}`}>
                      {r.rank}
                    </span>
                    <span className="mono truncate text-chalk">{shortAddr(r.owner, 5)}</span>
                    <span className="text-right text-chalk">{r.totalPoints}</span>
                    <span className="text-right text-grass">{(r.multiplier / 100).toFixed(2)}x</span>
                    <span className="text-right font-bold text-gold">{r.effectiveScore}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* match center */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-data">Match center</h2>
            <div className="space-y-3">
              {fixtures.map((fx) => {
                const home = teamOf(fx.home);
                const away = teamOf(fx.away);
                const comp = competitionOf(fx.competitionId);
                return (
                  <div key={fx.id} className="card card-hover p-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-data">
                      <span>{comp?.emblem} {comp?.name}</span>
                      <span>{fx.stage}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Team flag={home.flag} name={home.short} />
                      <span className="mono text-xs text-data">
                        {new Date(fx.kickoff).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      <Team flag={away.flag} name={away.short} right />
                    </div>
                  </div>
                );
              })}
            </div>
            <Button href="/onboard" variant="primary" size="md" className="mt-5 w-full">
              Deploy a gaffer here
            </Button>
          </section>
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

function Team({ flag, name, right }: { flag: string; name: string; right?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
      <span className="text-xl" aria-hidden>{flag}</span>
      <span className="text-sm font-semibold text-chalk">{name}</span>
    </div>
  );
}
