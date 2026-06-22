import { NextResponse } from "next/server";
import { readAllContests } from "@/lib/server/contract";
import { FIXTURES } from "@/lib/competitions";

export const revalidate = 10;

/** Live platform stats — real onchain reads + fixture schedule. */
export async function GET() {
  try {
    const contests = await readAllContests();
    const activeManagers = contests.reduce((n, c) => n + c.participantCount, 0);
    const totalPrizePool = contests
      .reduce((sum, c) => sum + Number(c.prizePoolOG), 0)
      .toFixed(3);
    const openContests = contests.filter((c) => c.status !== "ENDED").length;
    const matchesRemaining =
      FIXTURES.filter((f) => new Date(f.kickoff).getTime() > Date.now()).length + 9;

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
