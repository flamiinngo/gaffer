import { NextResponse } from "next/server";
import { publicClient } from "@/lib/server/contract";
import { CONTRACT_ADDRESS } from "@/lib/chain";
import { managerAiAbi } from "@/lib/abi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS = ["Rookie", "Pro", "Elite", "Legend"];
const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * ERC-721 metadata for a Gaffer agent — what every external marketplace / wallet reads via
 * tokenURI. Career attributes are pulled live from chain so the record a buyer sees is the real,
 * verifiable one; the display name is resolved from the 0G-anchored proofs manifest.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let a: readonly unknown[];
  try {
    a = (await publicClient.readContract({
      address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "getAgent", args: [BigInt(id)],
    })) as readonly unknown[];
  } catch {
    return NextResponse.json({ error: "no such agent" }, { status: 404 });
  }
  if ((a[0] as string) === ZERO) return NextResponse.json({ error: "no such agent" }, { status: 404 });

  const tier = Number(a[8]);
  const origin = new URL(req.url).origin;

  let name = `Gaffer Agent #${id}`;
  for (const file of ["proofs.json", "veterans.json"]) {
    try {
      const d = await fetch(`${origin}/${file}`, { cache: "no-store" }).then((r) => r.json());
      const m = (d?.agents ?? []).find((x: { agentId: number }) => String(x.agentId) === String(id));
      if (m?.name) { name = m.name; break; }
    } catch { /* try next */ }
  }

  const meta = {
    name,
    description:
      `An autonomous AI football manager on 0G — ${TIERS[tier]}, ${Number(a[3])} rounds scored, ${Number(a[6])} contest win(s). ` +
      `It picks its own teams on 0G Compute and every decision is verifiable on 0G. Its whole career carries to whoever owns it.`,
    image: `${origin}/api/nft/${id}/image`,
    external_url: `${origin}/gaffer/${id}`,
    attributes: [
      { trait_type: "Tier", value: TIERS[tier] ?? "Rookie" },
      { trait_type: "Rounds Scored", value: Number(a[3]) },
      { trait_type: "Career Points", value: Number(a[4]) },
      { trait_type: "Career Effective", value: Number(a[5]) },
      { trait_type: "Contest Wins", value: Number(a[6]) },
      { trait_type: "Contests Entered", value: Number(a[2]) },
      { trait_type: "Overrides", value: Number(a[7]) },
      { trait_type: "Status", value: (a[10] as boolean) ? "Tradeable NFT" : (a[9] as boolean) ? "Eligible to mint" : "Earning eligibility" },
    ],
  };
  return NextResponse.json(meta, { headers: { "cache-control": "public, max-age=60" } });
}
