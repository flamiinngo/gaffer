"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, http, custom, parseEther } from "viem";
import { Button } from "@/components/ui/Button";
import { managerAiAbi } from "@/lib/abi";
import { ogGalileo, CONTRACT_ADDRESS, explorerTx } from "@/lib/chain";
import { Sparkles, Tag, ShieldCheck, Loader2, ExternalLink, Trophy } from "lucide-react";

type Career = {
  tier: number; tierName: string; roundsScored: number; wins: number;
  careerPoints: number; careerEffective: number; eligible: boolean; minted: boolean; priceOG?: string;
};
const MINT_MIN = 3;

export function GafferCareer({ agentId, owner, career }: { agentId: number; owner: string; career?: Career | null }) {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [busy, setBusy] = useState("");
  const [tx, setTx] = useState("");
  const [err, setErr] = useState("");
  const [price, setPrice] = useState("0.5");

  const wallet = wallets[0];
  const connected = authenticated && wallet?.address?.toLowerCase() === owner.toLowerCase();
  const listed = career ? Number(career.priceOG ?? 0) > 0 : false;

  async function send(fn: "mintAgent" | "listAgent" | "unlistAgent") {
    setErr(""); setBusy(fn);
    try {
      await wallet.switchChain(ogGalileo.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({ account: wallet.address as `0x${string}`, chain: ogGalileo, transport: custom(provider) });
      const pub = createPublicClient({ chain: ogGalileo, transport: http() });
      const base = { address: CONTRACT_ADDRESS, abi: managerAiAbi } as const;
      const hash = fn === "listAgent"
        ? await wc.writeContract({ ...base, functionName: "listAgent", args: [BigInt(agentId), parseEther(price)] })
        : await wc.writeContract({ ...base, functionName: fn, args: [BigInt(agentId)] });
      await pub.waitForTransactionReceipt({ hash });
      setTx(hash);
    } catch (e) {
      setErr((e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Transaction failed");
    } finally {
      setBusy("");
    }
  }

  if (!career) return null;
  void user;

  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-line bg-pitch-2/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Metric label="Tier" value={career.tierName} tone="gold" />
          <Metric label="Rounds scored" value={String(career.roundsScored)} />
          <Metric label="Contest wins" value={String(career.wins)} />
          <Metric label="Career points" value={String(career.careerPoints)} />
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${
          listed ? "border-gold/30 bg-gold/12 text-gold" : career.minted ? "border-grass/30 bg-grass/12 text-grass" : career.eligible ? "border-grass/30 bg-grass/12 text-grass" : "border-line bg-line/40 text-data"
        }`}>
          {listed ? <><Tag className="h-3.5 w-3.5" /> Listed · {Number(career.priceOG).toFixed(2)} OG</> :
            career.minted ? <><Sparkles className="h-3.5 w-3.5" /> Tradeable NFT</> :
            career.eligible ? <><Sparkles className="h-3.5 w-3.5" /> Eligible to mint</> :
            `${career.roundsScored}/${MINT_MIN} rounds to mint`}
        </span>
      </div>

      {/* the "what makes this worth more" line — visible to everyone */}
      <p className="mt-3 text-xs leading-relaxed text-data">
        {career.minted
          ? "A minted veteran — its whole verifiable career transfers to whoever owns it. Tradeable here and on any ERC-721 marketplace."
          : career.eligible
            ? "This gaffer has earned its stripes. The owner can mint it into a tradeable NFT."
            : `Agents become tradeable NFTs after ${MINT_MIN} scored rounds — that's how a proven veteran earns its value.`}
      </p>

      {connected && (
        <div className="mt-4 border-t border-line/60 pt-4">
          {tx ? (
            <a href={explorerTx(tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-grass">
              <ShieldCheck className="h-4 w-4" /> Done — view on 0G <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : !career.minted ? (
            <Button onClick={() => send("mintAgent")} variant="primary" size="sm" disabled={!career.eligible || busy === "mintAgent"}>
              {busy === "mintAgent" ? <><Loader2 className="h-4 w-4 animate-spin" /> Minting…</> : <><Sparkles className="h-4 w-4" /> {career.eligible ? "Mint as tradeable NFT" : `Not eligible yet (${career.roundsScored}/${MINT_MIN})`}</>}
            </Button>
          ) : listed ? (
            <Button onClick={() => send("unlistAgent")} variant="subtle" size="sm" disabled={busy === "unlistAgent"}>
              {busy === "unlistAgent" ? <><Loader2 className="h-4 w-4 animate-spin" /> Removing…</> : <>Unlist from market</>}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-[var(--radius-data)] border border-line bg-pitch px-3 py-2">
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="w-16 bg-transparent text-sm text-chalk outline-none" />
                <span className="text-xs text-data">OG</span>
              </div>
              <Button onClick={() => send("listAgent")} variant="primary" size="sm" disabled={busy === "listAgent" || !(Number(price) > 0)}>
                {busy === "listAgent" ? <><Loader2 className="h-4 w-4 animate-spin" /> Listing…</> : <><Trophy className="h-4 w-4" /> List for sale</>}
              </Button>
            </div>
          )}
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-bold ${tone === "gold" ? "text-gold" : "text-chalk"}`}>{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-data">{label}</span>
    </span>
  );
}
