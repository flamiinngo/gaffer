"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/Button";
import { GafferMark } from "@/components/brand/Logo";
import { GafferCard } from "@/components/brand/GafferCard";
import { explorerAddress, shortAddr } from "@/lib/chain";
import { Plus, Trophy, ShieldCheck, Sparkles, Tag } from "lucide-react";

type Gaffer = {
  agentId: number;
  tier: number;
  tierName: string;
  roundsScored: number;
  contestsEntered: number;
  careerPoints: number;
  wins: number;
  eligible: boolean;
  minted: boolean;
  listed: boolean;
  priceOG: string;
};

const MINT_MIN = 3;

export function MyGaffers() {
  const { authenticated, user, login } = usePrivy();
  const [gaffers, setGaffers] = useState<Gaffer[] | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const address = user?.wallet?.address;

  useEffect(() => {
    if (!authenticated || !address) return;
    setGaffers(null);
    fetch(`/api/my-gaffers?address=${address}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const gs: Gaffer[] = d.gaffers ?? [];
        setGaffers(gs);
        // resolve each gaffer's real name from its onchain brain
        gs.forEach((g) =>
          fetch(`/api/agent/${g.agentId}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((info) => info?.name && setNames((n) => ({ ...n, [g.agentId]: info.name })))
            .catch(() => {})
        );
      })
      .catch(() => setGaffers([]));
  }, [authenticated, address]);

  // Signed out → a clear personal-context prompt (NOT the public live view, which was confusing).
  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md px-5 py-28 text-center">
        <GafferMark className="mx-auto h-10 w-12 opacity-70" />
        <h2 className="mt-4 text-2xl font-semibold text-chalk">Your gaffers live here</h2>
        <p className="mt-2 text-sm text-data">Sign in to see the AI managers you own — their careers, NFTs and standings. Watching the arena needs no sign-in; this is your personal stable.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => login()} variant="primary" size="md">Sign in</Button>
          <Button href="/onboard" variant="ghost" size="md">Deploy a gaffer</Button>
        </div>
      </div>
    );
  }

  // Signed in → personal stable of agent assets
  const totalEffective = gaffers?.reduce((n, g) => n + g.careerPoints, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-card)] border border-line bg-midfield">
            <GafferMark className="h-8 w-9" />
          </span>
          <div>
            <h1 className="display text-4xl text-chalk">My Gaffers</h1>
            <p className="mt-1 text-sm text-data">
              {user?.email?.address ?? (address && shortAddr(address, 5))}
              {gaffers && gaffers.length > 0 && <> · {gaffers.length} agent{gaffers.length > 1 ? "s" : ""} · {totalEffective} career points</>}
            </p>
          </div>
        </div>
        <Button href="/onboard" variant="primary" size="md"><Plus className="h-4 w-4" /> Deploy your gaffer</Button>
      </div>

      {gaffers === null ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-52 rounded-[var(--radius-card)]" />)}
        </div>
      ) : gaffers.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-4 px-6 py-20 text-center">
          <GafferMark className="h-10 w-12 opacity-60" />
          <div>
            <h3 className="text-lg font-semibold text-chalk">No gaffers deployed yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-data">Build your first AI manager, drop it into a contest, and watch it compete. Deploying is free.</p>
          </div>
          <Button href="/onboard" variant="primary" size="md">Deploy your gaffer</Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {gaffers.map((g) => (
            <GafferCard
              key={g.agentId}
              agentId={g.agentId}
              name={names[g.agentId] ?? `Agent #${g.agentId}`}
              tier={g.tier}
              rounds={g.roundsScored}
              wins={g.wins}
              careerPts={g.careerPoints}
              href={`/gaffer/${g.agentId}`}
              footer={
                <div className="flex items-center justify-center text-xs">
                  {g.listed ? (
                    <span className="inline-flex items-center gap-1.5 text-gold"><Tag className="h-3.5 w-3.5" /> Listed · {Number(g.priceOG).toFixed(2)} OG</span>
                  ) : g.minted ? (
                    <span className="inline-flex items-center gap-1.5 text-grass"><ShieldCheck className="h-3.5 w-3.5" /> Tradeable NFT</span>
                  ) : g.eligible ? (
                    <span className="inline-flex items-center gap-1.5 text-grass"><Sparkles className="h-3.5 w-3.5" /> Ready to mint</span>
                  ) : (
                    <span className="text-data">{g.roundsScored}/{MINT_MIN} rounds to tradeable NFT</span>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}

      {gaffers && gaffers.length > 0 && address && (
        <div className="mt-6 text-center">
          <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="mono text-xs text-data transition-colors hover:text-grass">
            <Trophy className="mr-1 inline h-3.5 w-3.5" /> verify your gaffers onchain · {shortAddr(address, 5)}
          </a>
        </div>
      )}
    </div>
  );
}
