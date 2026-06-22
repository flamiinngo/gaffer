import "server-only";
import { createPublicClient, http, formatEther } from "viem";
import { ogGalileo, CONTRACT_ADDRESS } from "@/lib/chain";
import { managerAiAbi } from "@/lib/abi";

/** Server-side read client for 0G Galileo. Used by route handlers for real reads. */
export const publicClient = createPublicClient({
  chain: ogGalileo,
  transport: http(),
});

export type ContestSummary = {
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

function statusOf(start: number, end: number, resolved: boolean): ContestSummary["status"] {
  const now = Date.now() / 1000;
  if (resolved || now >= end) return "ENDED";
  if (now < start) return "UPCOMING";
  return "LIVE";
}

export type LeaderboardRow = {
  rank: number;
  owner: string;
  configHash: string;
  totalPoints: number;
  overrideCount: number;
  multiplier: number; // basis points of 1x (100..300)
  effectiveScore: number;
};

export async function readContestDetail(
  id: number
): Promise<{ contest: ContestSummary; leaderboard: LeaderboardRow[] } | null> {
  const cid = BigInt(id);
  let raw;
  try {
    raw = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: managerAiAbi,
      functionName: "getContest",
      args: [cid],
    });
  } catch {
    return null;
  }
  const [cId, name, prizePool, entryFee, startTime, endTime, resolved, participantCount] = raw;
  if (Number(cId) === 0) return null;

  const contest: ContestSummary = {
    id: Number(cId),
    name,
    prizePoolOG: formatEther(prizePool),
    entryFeeOG: formatEther(entryFee),
    startTime: Number(startTime),
    endTime: Number(endTime),
    resolved,
    participantCount: Number(participantCount),
    status: statusOf(Number(startTime), Number(endTime), resolved),
  };

  const participants = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: managerAiAbi,
    functionName: "getParticipants",
    args: [cid],
  })) as readonly `0x${string}`[];

  const managers = await Promise.all(
    participants.map((addr) =>
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "getManager",
        args: [cid, addr],
      })
    )
  );

  const leaderboard: LeaderboardRow[] = managers
    .map((m, i) => {
      const [configHash, totalPoints, overrideCount, multiplier, effectiveScore] = m;
      return {
        rank: 0,
        owner: participants[i],
        configHash,
        totalPoints: Number(totalPoints),
        overrideCount: Number(overrideCount),
        multiplier: Number(multiplier),
        effectiveScore: Number(effectiveScore),
      };
    })
    .sort((a, b) => b.effectiveScore - a.effectiveScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return { contest, leaderboard };
}

export type UserGaffer = {
  contestId: number;
  contestName: string;
  status: ContestSummary["status"];
  configHash: string;
  points: number;
  overrideCount: number;
  multiplier: number;
  effectiveScore: number;
  rank: number;
  participants: number;
};

/** Every gaffer a wallet owns, across all contests — their stable of AIs. */
export async function readUserGaffers(address: `0x${string}`): Promise<UserGaffer[]> {
  const next = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: managerAiAbi,
    functionName: "nextContestId",
  });

  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => i + 1);
  const out: UserGaffer[] = [];

  await Promise.all(
    ids.map(async (id) => {
      const m = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "getManager",
        args: [BigInt(id), address],
      });
      const [configHash, totalPoints, overrideCount, multiplier, effectiveScore, , active] = m;
      if (!active) return;

      const detail = await readContestDetail(id);
      const row = detail?.leaderboard.find((r) => r.owner.toLowerCase() === address.toLowerCase());
      out.push({
        contestId: id,
        contestName: detail?.contest.name ?? `Contest #${id}`,
        status: detail?.contest.status ?? "UPCOMING",
        configHash,
        points: Number(totalPoints),
        overrideCount: Number(overrideCount),
        multiplier: Number(multiplier) / 100,
        effectiveScore: Number(effectiveScore),
        rank: row?.rank ?? 0,
        participants: detail?.leaderboard.length ?? 0,
      });
    })
  );

  return out.sort((a, b) => b.contestId - a.contestId);
}

export async function readAllContests(): Promise<ContestSummary[]> {
  const next = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: managerAiAbi,
    functionName: "nextContestId",
  });

  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  const results = await Promise.all(
    ids.map((id) =>
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "getContest",
        args: [id],
      })
    )
  );

  return results.map((c) => {
    const [id, name, prizePool, entryFee, startTime, endTime, resolved, participantCount] = c;
    return {
      id: Number(id),
      name,
      prizePoolOG: formatEther(prizePool),
      entryFeeOG: formatEther(entryFee),
      startTime: Number(startTime),
      endTime: Number(endTime),
      resolved,
      participantCount: Number(participantCount),
      status: statusOf(Number(startTime), Number(endTime), resolved),
    } satisfies ContestSummary;
  });
}
