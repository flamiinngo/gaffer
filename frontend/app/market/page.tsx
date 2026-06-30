import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PageShell } from "@/components/site/PageShell";
import { MarketBoard } from "@/components/market/MarketBoard";
import { readMarketplace } from "@/lib/server/contract";

export const dynamic = "force-dynamic";

type Manifest = { agents?: { agentId: number; name: string; formation?: string; captain?: string }[] };

async function readManifest(file: string): Promise<Manifest> {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "public", file), "utf8"));
  } catch {
    return {};
  }
}

export default async function MarketPage() {
  const [listed, veterans, proofs] = await Promise.all([
    readMarketplace().catch(() => []),
    readManifest("veterans.json"),
    readManifest("proofs.json"),
  ]);

  const meta = new Map<number, { name: string; formation?: string; captain?: string }>();
  for (const a of [...(proofs.agents ?? []), ...(veterans.agents ?? [])]) {
    meta.set(a.agentId, { name: a.name, formation: a.formation, captain: a.captain });
  }

  const items = listed.map((a) => ({
    agentId: a.agentId,
    name: meta.get(a.agentId)?.name ?? `Agent #${a.agentId}`,
    tier: a.tier,
    roundsScored: a.roundsScored,
    wins: a.wins,
    careerPoints: a.careerPoints,
    priceOG: a.priceOG,
  }));

  return (
    <PageShell>
      <div className="border-b border-line/60 bg-pitch-2">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-grass">
            <span className="h-1.5 w-1.5 rounded-full bg-grass shadow-[0_0_8px_var(--color-grass)]" /> Agent marketplace
          </span>
          <h1 className="display mt-3 text-5xl text-chalk sm:text-6xl">Buy a proven gaffer</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-data">
            Agents earn their NFT status by playing — every one here is a real veteran with a verifiable career on 0G.
            Buying one is like signing an experienced manager: you inherit its record, its brain, and the higher it&apos;s
            climbed, the more it&apos;s worth. Career and ownership transfer onchain the moment you buy.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 py-10">
        <MarketBoard items={items} />
      </div>
    </PageShell>
  );
}
