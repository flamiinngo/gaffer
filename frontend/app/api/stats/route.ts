import { NextResponse } from "next/server";
import { readAllContests } from "@/lib/server/contract";
import { getUpcomingFixtures } from "@/lib/server/football";

export const revalidate = 10;

/** Live platform stats — all real: onchain contest reads + the live World Cup fixture feed. */
export async function GET() {
  try {
    const contests = await readAllContests();
    const activeManagers = contests.reduce((n, c) => n + c.participantCount, 0);
    const totalPrizePool = contests
      .reduce((sum, c) => sum + Number(c.prizePoolOG), 0)
      .toFixed(3);
    const openContests = contests.filter((c) => c.status !== "ENDED").length;
    // Real matches left = upcoming, not-yet-kicked-off World Cup fixtures from the live feed.
    const upcoming = (await getUpcomingFixtures(100)) ?? [];
    const matchesRemaining = upcoming.filter((f) => f.status !== "finished").length;

    return NextResponse.json({
      activeManagers,
      totalPrizePool,
      openContests,
      matchesRemaining,
    });
  } catch (err) {
    return NextResponse.json(
      { activeManagers: 0, totalPrizePool: "0", openContests: 0, matchesRemaining: 0, error: (err as Error).message },
      { status: 502 }
    );
  }
}
