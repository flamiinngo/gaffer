import "server-only";
import { createPublicClient, http, formatEther } from "viem";
import { ogGalileo, CONTRACT_ADDRESS } from "@/lib/chain";
import { managerAiAbi } from "@/lib/abi";

/** Server-side read client for 0G Galileo (GafferArena v2). */
export const publicClient = createPublicClient({ chain: ogGalileo, transport: http() });

const TIERS = ["Rookie", "Pro", "Elite", "Legend"];

export type ContestSummary = {
  id: number;
  name: string;
  prizePoolOG: string;
  entryFeeOG: string;
  startTime: number;
  endTime: number;
  resolved: boolean;
  participantCount: number;
  creator: string;
  isPrivate: boolean;
  brief: string;
  status: "UPCOMING" | "LIVE" | "ENDED";
};

function statusOf(start: number, end: number, resolved: boolean): ContestSummary["status"] {
  const now = Date.now() / 1000;
  if (resolved || now >= end) return "ENDED";
  if (now < start) return "UPCOMING";
  return "LIVE";
}

function toSummary(c: readonly unknown[]): ContestSummary {
  const [id, name, prizePool, entryFee, startTime, endTime, resolved, participantCount, creator, isPrivate, brief] = c as [
    bigint, string, bigint, bigint, bigint, bigint, boolean, bigint, string, boolean, string
  ];
  return {
    id: Number(id),
    name,
    prizePoolOG: formatEther(prizePool),
    entryFeeOG: formatEther(entryFee),
    startTime: Number(startTime),
    endTime: Number(endTime),
    resolved,
    participantCount: Number(participantCount),
    creator,
    isPrivate,
    brief,
    status: statusOf(Number(startTime), Number(endTime), resolved),
  };
}

export type LeaderboardRow = {
  rank: number;
  agentId: number;
  owner: string;
  configHash: string;
  totalPoints: number;
  overrideCount: number;
  multiplier: number; // basis points of 1x (100..300)
  effectiveScore: number;
  tier: number;
  tierName: string;
  wins: number;
};

export async function readContestDetail(
  id: number
): Promise<{ contest: ContestSummary; leaderboard: LeaderboardRow[] } | null> {
  const cid = BigInt(id);
  let raw;
  try {
    raw = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getContest", args: [cid] });
  } catch {
    return null;
  }
  if (Number((raw as readonly unknown[])[0]) === 0) return null;
  const contest = toSummary(raw as readonly unknown[]);

  const participants = (await publicClient.readContract({
    address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getParticipants", args: [cid],
  })) as readonly bigint[];

  const rows = await Promise.all(
    participants.map(async (agentId) => {
      const [e, a] = await Promise.all([
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getEntry", args: [cid, agentId] }),
        publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getAgent", args: [agentId] }),
      ]);
      const [, totalPoints, overrideCount, multiplier, effectiveScore] = e as readonly bigint[];
      const owner = (a as readonly unknown[])[0] as string;
      const configHash = (a as readonly unknown[])[1] as string;
      const wins = Number((a as readonly unknown[])[6]);
      const tier = Number((a as readonly unknown[])[8]);
      return {
        rank: 0,
        agentId: Number(agentId),
        owner,
        configHash,
        totalPoints: Number(totalPoints),
        overrideCount: Number(overrideCount),
        multiplier: Number(multiplier),
        effectiveScore: Number(effectiveScore),
        tier,
        tierName: TIERS[tier] ?? "Rookie",
        wins,
      } satisfies LeaderboardRow;
    })
  );

  const leaderboard = rows.sort((a, b) => b.effectiveScore - a.effectiveScore).map((r, i) => ({ ...r, rank: i + 1 }));
  return { contest, leaderboard };
}

export async function readAllContests(): Promise<ContestSummary[]> {
  const next = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "nextContestId" });
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  const results = await Promise.all(
    ids.map((id) => publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getContest", args: [id] }))
  );
  const all = results.map((c) => toSummary(c as readonly unknown[]));

  // Public list = the latest populated showcase + any OPEN public contests still taking entries.
  // (Private contests are unlisted — reached via invite link / direct id.)
  const latestShowcase = all.filter((c) => c.participantCount >= 3 && !c.isPrivate).sort((a, b) => b.id - a.id)[0]?.id;
  const visible = new Set<number>();
  if (latestShowcase) visible.add(latestShowcase);
  for (const c of all) if (!c.isPrivate && c.status !== "ENDED") visible.add(c.id);
  return all.filter((c) => visible.has(c.id)).sort((a, b) => b.id - a.id);
}

export type OwnedAgent = {
  agentId: number;
  owner: string;
  configHash: string;
  contestsEntered: number;
  roundsScored: number;
  careerPoints: number;
  careerEffective: number;
  wins: number;
  tier: number;
  tierName: string;
  eligible: boolean;
  minted: boolean;
  priceOG: string;
  listed: boolean;
};

async function readAgent(agentId: bigint): Promise<OwnedAgent | null> {
  try {
    const a = (await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getAgent", args: [agentId] })) as readonly unknown[];
    const owner = a[0] as string;
    if (!owner || owner === "0x0000000000000000000000000000000000000000") return null;
    const tier = Number(a[8]);
    const price = a[11] as bigint;
    return {
      agentId: Number(agentId),
      owner,
      configHash: a[1] as string,
      contestsEntered: Number(a[2]),
      roundsScored: Number(a[3]),
      careerPoints: Number(a[4]),
      careerEffective: Number(a[5]),
      wins: Number(a[6]),
      tier,
      tierName: TIERS[tier] ?? "Rookie",
      eligible: a[9] as boolean,
      minted: a[10] as boolean,
      priceOG: formatEther(price),
      listed: price > 0n,
    };
  } catch {
    return null;
  }
}

/** Every agent NFT a wallet currently owns — their stable of gaffers. */
export async function readUserGaffers(address: `0x${string}`): Promise<OwnedAgent[]> {
  const next = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "nextAgentId" });
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  const agents = await Promise.all(ids.map(readAgent));
  return agents
    .filter((a): a is OwnedAgent => a !== null && a.owner.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.agentId - a.agentId);
}

/** All agents currently listed for sale — the marketplace. */
export async function readMarketplace(): Promise<OwnedAgent[]> {
  const next = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "nextAgentId" });
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  const agents = await Promise.all(ids.map(readAgent));
  return agents.filter((a): a is OwnedAgent => a !== null && a.listed).sort((a, b) => b.careerEffective - a.careerEffective);
}
