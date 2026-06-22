import { NextResponse } from "next/server";
import { parseAbiItem } from "viem";
import { publicClient } from "@/lib/server/contract";
import { CONTRACT_ADDRESS } from "@/lib/chain";

export const revalidate = 10;

const pointsEvent = parseAbiItem(
  "event PointsRecorded(uint256 indexed contestId, address indexed owner, uint256 indexed matchId, uint256 points, string decisionHash)"
);

/** Latest AI decisions, read live from the contract's PointsRecorded logs on 0G. */
export async function GET() {
  try {
    const latest = await publicClient.getBlockNumber();
    const lookback = 50_000n;
    const fromBlock = latest > lookback ? latest - lookback : 0n;

    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: pointsEvent,
      fromBlock,
      toBlock: "latest",
    });

    const decisions = logs
      .reverse()
      .slice(0, 50)
      .map((l) => ({
        contestId: Number(l.args.contestId),
        owner: l.args.owner as string,
        matchId: Number(l.args.matchId),
        points: Number(l.args.points),
        decisionHash: l.args.decisionHash as string,
        block: Number(l.blockNumber),
        tx: l.transactionHash,
      }));

    return NextResponse.json({ decisions });
  } catch (err) {
    return NextResponse.json({ decisions: [], error: (err as Error).message }, { status: 502 });
  }
}
