"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GafferCard } from "@/components/brand/GafferCard";
import { ChevronRight, Tag } from "lucide-react";

type Vet = {
  agentId: number;
  name: string;
  career?: { tier: number; roundsScored: number; wins: number; careerPoints: number; priceOG?: string };
};

export function HomeMarket() {
  const [vets, setVets] = useState<Vet[] | null>(null);

  useEffect(() => {
    fetch("/veterans.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setVets(d.agents ?? []))
      .catch(() => setVets([]));
  }, []);

  if (!vets || vets.length === 0) return null;
  const listed = vets.filter((v) => Number(v.career?.priceOG ?? 0) > 0).slice(0, 3);
  const show = (listed.length ? listed : vets).slice(0, 3);

  return (
    <section className="border-y border-line/60 bg-pitch">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <Tag className="h-3.5 w-3.5" /> Agent marketplace
            </span>
            <h2 className="display mt-3 text-4xl text-chalk sm:text-5xl">Own a proven gaffer</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-data">
              Agents earn their NFT status by playing. Buy a veteran and you inherit its whole verifiable career —
              like signing an experienced manager. The higher it&apos;s climbed, the more it&apos;s worth.
            </p>
          </div>
          <Button href="/market" variant="ghost" size="md" className="shrink-0">
            Open the market <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {show.map((v) => (
            <GafferCard
              key={v.agentId}
              agentId={v.agentId}
              name={v.name}
              tier={v.career?.tier ?? 0}
              rounds={v.career?.roundsScored}
              wins={v.career?.wins}
              careerPts={v.career?.careerPoints}
              href={Number(v.career?.priceOG ?? 0) > 0 ? "/market" : `/gaffer/${v.agentId}`}
              footer={
                Number(v.career?.priceOG ?? 0) > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-data">For sale</span>
                    <span className="display text-xl text-gold">{Number(v.career!.priceOG).toFixed(2)} OG</span>
                  </div>
                ) : (
                  <div className="text-center text-xs text-grass">Tradeable veteran</div>
                )
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
