"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, http, custom, parseEther } from "viem";
import { Button } from "@/components/ui/Button";
import { GafferCard } from "@/components/brand/GafferCard";
import { managerAiAbi } from "@/lib/abi";
import { ogGalileo, CONTRACT_ADDRESS, explorerTx } from "@/lib/chain";
import { ShieldCheck, Trophy, Loader2, Tag, ExternalLink } from "lucide-react";

type Item = {
  agentId: number;
  name: string;
  tier: number;
  roundsScored: number;
  wins: number;
  careerPoints: number;
  priceOG: string;
};

export function MarketBoard({ items }: { items: Item[] }) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});
  const [err, setErr] = useState<Record<number, string>>({});

  async function buy(it: Item) {
    setErr((e) => ({ ...e, [it.agentId]: "" }));
    if (!authenticated) return login();
    const wallet = wallets[0];
    if (!wallet) return setErr((e) => ({ ...e, [it.agentId]: "No wallet found — sign in again." }));
    setBusy(it.agentId);
    try {
      await wallet.switchChain(ogGalileo.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({ account: wallet.address as `0x${string}`, chain: ogGalileo, transport: custom(provider) });
      const pub = createPublicClient({ chain: ogGalileo, transport: http() });
      const tx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: managerAiAbi, functionName: "buyAgent", args: [BigInt(it.agentId)], value: parseEther(it.priceOG) });
      await pub.waitForTransactionReceipt({ hash: tx });
      setDone((d) => ({ ...d, [it.agentId]: tx }));
    } catch (e) {
      setErr((er) => ({ ...er, [it.agentId]: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Purchase failed" }));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-4 px-6 py-20 text-center">
        <Trophy className="h-10 w-10 text-line" />
        <div>
          <h3 className="text-lg font-semibold text-chalk">No agents listed right now</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-data">Agents become tradeable NFTs after 3 scored rounds. When an owner lists a veteran, it shows here — ready to sign.</p>
        </div>
        <Button href="/onboard" variant="primary" size="md">Deploy your own gaffer</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <GafferCard
          key={it.agentId}
          agentId={it.agentId}
          name={it.name}
          tier={it.tier}
          rounds={it.roundsScored}
          wins={it.wins}
          careerPts={it.careerPoints}
          footer={
            done[it.agentId] ? (
              <a href={explorerTx(done[it.agentId])} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-[var(--radius-data)] border border-grass/30 bg-grass/10 px-4 py-3 text-sm font-semibold text-grass">
                <ShieldCheck className="h-4 w-4" /> It&apos;s yours <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-data"><Tag className="h-3.5 w-3.5" /> Price</span>
                  <span className="display text-2xl text-gold">{Number(it.priceOG).toFixed(2)} OG</span>
                </div>
                <Button onClick={() => buy(it)} variant="primary" size="md" className="w-full justify-center" disabled={busy === it.agentId}>
                  {busy === it.agentId ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing…</> : authenticated ? "Sign this gaffer" : "Sign in to buy"}
                </Button>
                <Link href={`/gaffer/${it.agentId}`} className="mt-2 block text-center text-[11px] text-data transition-colors hover:text-grass">View full scorecard →</Link>
                {err[it.agentId] && <p className="mt-1 text-center text-xs text-danger">{err[it.agentId]}</p>}
              </>
            )
          }
        />
      ))}
    </div>
  );
}
