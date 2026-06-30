import { NextResponse } from "next/server";
import { formatEther } from "viem";
import { publicClient } from "@/lib/server/contract";
import { CONTRACT_ADDRESS } from "@/lib/chain";
import { managerAiAbi } from "@/lib/abi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS = ["Rookie", "Pro", "Elite", "Legend"];
const ZERO = "0x0000000000000000000000000000000000000000";
const STORAGE_GATEWAY = "https://indexer-storage-testnet-turbo.0g.ai/file?root=";

/** Live agent info from chain + its brain (name/persona) read back from 0G Storage by config root.
 *  Powers a deployed gaffer's profile + name before it has played its first scored matchday. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let a: readonly unknown[];
  try {
    a = (await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getAgent", args: [BigInt(id)] })) as readonly unknown[];
  } catch {
    return NextResponse.json({ error: "no such agent" }, { status: 404 });
  }
  const owner = a[0] as string;
  if (!owner || owner === ZERO) return NextResponse.json({ error: "no such agent" }, { status: 404 });

  const raw = (a[1] as string) ?? "";
  // Two brain formats: inline JSON (user deploys: {n,p,ph,s}) or a 0G Storage root (house agents).
  let cfg: { name?: string; n?: string; persona?: string; p?: string; philosophy?: string; ph?: string } | null = null;
  if (raw.trim().startsWith("{")) {
    try { cfg = JSON.parse(raw); } catch { /* malformed */ }
  } else {
    const root = raw.replace(/^0g:\/\//, "");
    if (/^0x[0-9a-fA-F]{64}$/.test(root)) {
      try {
        const res = await fetch(STORAGE_GATEWAY + root, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
        if (res.ok) cfg = await res.json();
      } catch { /* brain not retrievable yet — fall back to generic name */ }
    }
  }

  const tier = Number(a[8]);
  const price = a[11] as bigint;
  return NextResponse.json({
    agentId: Number(id),
    owner,
    name: cfg?.name ?? cfg?.n ?? `Gaffer #${id}`,
    persona: cfg?.persona ?? cfg?.p ?? null,
    philosophy: cfg?.philosophy ?? cfg?.ph ?? null,
    tier,
    tierName: TIERS[tier] ?? "Rookie",
    contestsEntered: Number(a[2]),
    roundsScored: Number(a[3]),
    careerPoints: Number(a[4]),
    careerEffective: Number(a[5]),
    wins: Number(a[6]),
    overrideCount: Number(a[7]),
    eligible: a[9] as boolean,
    minted: a[10] as boolean,
    priceOG: formatEther(price),
    listed: price > 0n,
  });
}
