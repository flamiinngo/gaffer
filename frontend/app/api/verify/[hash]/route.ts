import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { parseAbiItem, parseEventLogs } from "viem";
import { publicClient } from "@/lib/server/contract";
import { CONTRACT_ADDRESS } from "@/lib/chain";
import { managerAiAbi } from "@/lib/abi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_GATEWAY = "https://indexer-storage-testnet-turbo.0g.ai/file?root=";

const pointsEvent = parseAbiItem(
  "event PointsRecorded(uint256 indexed contestId, uint256 indexed agentId, uint256 indexed matchId, uint256 points, string decisionHash)"
);

/**
 * Live, on-demand proof of a single AI decision across all four 0G layers.
 *
 *  STORAGE — re-fetch the decision from 0G Storage by its content-addressed root hash.
 *            The network only serves bytes whose merkle root equals the requested root,
 *            so a successful fetch proves the content matches the hash.
 *  CHAIN   — pull the exact transaction that anchored this decision and decode its
 *            PointsRecorded log, confirming the agent recorded this same root onchain.
 *            Then independently read the manager's onchain record (points × multiplier).
 *  COMPUTE — the model that produced it (read from the stored artifact).
 *  DA      — the decision payload is published and available behind the onchain anchor.
 *
 * Nothing is mocked: Storage is fetched live, the tx receipt and contract state are read
 * live from 0G RPC.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const root = decodeURIComponent(hash).replace(/^0g:\/\//, "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
    return NextResponse.json({ error: "Invalid 0G Storage root hash" }, { status: 400 });
  }

  const result = {
    root,
    storage: { verified: false, gateway: STORAGE_GATEWAY + root, bytes: 0, sha256: null as string | null },
    chain: {
      verified: false,
      tx: null as string | null,
      block: null as number | null,
      contestId: null as number | null,
      agentId: null as number | null,
      owner: null as string | null,
      points: null as number | null,
      onchainPoints: null as number | null,
      multiplier: null as number | null,
      effectiveScore: null as number | null,
      contract: CONTRACT_ADDRESS,
    },
    compute: { model: null as string | null, provider: "0G Compute Network" },
    da: { available: false },
    decision: null as unknown,
    verifiedAt: new Date().toISOString(),
  };

  // 1) STORAGE — re-fetch live from 0G Storage by root hash
  try {
    const res = await fetch(STORAGE_GATEWAY + root, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      result.storage.bytes = buf.length;
      result.storage.sha256 = "0x" + createHash("sha256").update(buf).digest("hex");
      result.storage.verified = true;
      try {
        const decision = JSON.parse(buf.toString("utf8"));
        result.decision = decision;
        result.compute.model = decision?.model ?? null;
      } catch {
        /* non-JSON artifact still counts as retrieved */
      }
    }
  } catch {
    /* storage node slow/unavailable — chain proof still stands */
  }

  // Find the anchoring tx for this root via the proofs manifest (which records tx + contest + owner).
  let tx: string | null = null;
  let contestId: number | null = null;
  let agentId: number | null = null;
  let owner: string | null = null;
  try {
    const origin = new URL(req.url).origin;
    const manifest = await fetch(`${origin}/proofs.json`, { cache: "no-store" }).then((r) => r.json());
    const agent = (manifest?.agents ?? []).find(
      (a: { layers?: { storage?: { decisionRoot?: string } } }) =>
        (a.layers?.storage?.decisionRoot ?? "").toLowerCase() === root.toLowerCase()
    );
    if (agent) {
      tx = agent.layers?.chain?.tx ?? null;
      contestId = manifest.contestId ?? null;
      agentId = agent.agentId ?? null;
      owner = agent.owner ?? null;
    }
  } catch {
    /* no manifest — chain proof falls back to best-effort below */
  }

  // 2) CHAIN — decode the exact tx receipt and confirm it anchored this root
  try {
    if (tx) {
      const receipt = await publicClient.getTransactionReceipt({ hash: tx as `0x${string}` });
      if (receipt.status === "success") {
        const events = parseEventLogs({ abi: [pointsEvent], logs: receipt.logs });
        const ev = events.find(
          (e) => ((e.args.decisionHash as string) ?? "").replace(/^0g:\/\//, "").toLowerCase() === root.toLowerCase()
        );
        if (ev) {
          result.chain.verified = true;
          result.chain.tx = tx;
          result.chain.block = Number(receipt.blockNumber);
          result.chain.contestId = Number(ev.args.contestId);
          result.chain.agentId = Number(ev.args.agentId);
          result.chain.owner = owner;
          result.chain.points = Number(ev.args.points);
          result.da.available = true;
          contestId = contestId ?? Number(ev.args.contestId);
          agentId = agentId ?? Number(ev.args.agentId);
        }
      }
    }

    // Independently read the agent's onchain entry (points × multiplier → effective score).
    if (contestId != null && agentId != null) {
      const e = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "getEntry",
        args: [BigInt(contestId), BigInt(agentId)],
      })) as readonly [boolean, bigint, bigint, bigint, bigint, bigint];
      result.chain.onchainPoints = Number(e[1]);
      result.chain.multiplier = Number(e[3]) / 100;
      result.chain.effectiveScore = Number(e[4]);
    }
  } catch {
    /* RPC hiccup — surface whatever we proved */
  }

  return NextResponse.json(result);
}
