"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Cpu, Database, HardDrive, Link2, ShieldCheck, ExternalLink, Loader2, BadgeCheck } from "lucide-react";
import { explorerTx } from "@/lib/chain";

const STORAGE_GATEWAY = "https://indexer-storage-testnet-turbo.0g.ai/file?root=";

type VerifyResult = {
  root: string;
  storage: { verified: boolean; gateway: string; bytes: number; sha256: string | null };
  chain: {
    verified: boolean;
    tx: string | null;
    block: number | null;
    contestId: number | null;
    points: number | null;
    onchainPoints: number | null;
    multiplier: number | null;
    effectiveScore: number | null;
    contract: string;
  };
  compute: { model: string | null; provider: string };
  da: { available: boolean };
  verifiedAt: string;
};

type LayerState = "idle" | "checking" | "ok" | "fail";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The live, on-demand proof of one AI decision. Hitting "Verify on 0G" calls the real
 * /api/verify route, then reveals each of the four 0G layers turning green with the actual
 * returned data. No mock — the data is fetched live; only the reveal is paced for drama.
 */
export function ProofReceipt({ root, autostart = false }: { root: string; autostart?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(autostart ? "running" : "idle");
  const [layers, setLayers] = useState<Record<string, LayerState>>({
    storage: "idle",
    chain: "idle",
    compute: "idle",
    da: "idle",
  });
  const [res, setRes] = useState<VerifyResult | null>(null);

  async function run() {
    setPhase("running");
    setRes(null);
    setLayers({ storage: "checking", chain: "idle", compute: "idle", da: "idle" });
    try {
      const data: VerifyResult = await fetch(`/api/verify/${root}`, { cache: "no-store" }).then((r) => r.json());
      // staged reveal of real results
      await sleep(450);
      setLayers((l) => ({ ...l, storage: data.storage.verified ? "ok" : "fail", chain: "checking" }));
      await sleep(550);
      setLayers((l) => ({ ...l, chain: data.chain.verified ? "ok" : "fail", compute: "checking" }));
      await sleep(450);
      setLayers((l) => ({ ...l, compute: data.compute.model ? "ok" : "fail", da: "checking" }));
      await sleep(450);
      setLayers((l) => ({ ...l, da: data.da.available ? "ok" : "fail" }));
      setRes(data);
      setPhase("done");
    } catch {
      setPhase("error");
      setLayers({ storage: "fail", chain: "fail", compute: "fail", da: "fail" });
    }
  }

  const allOk = res && res.storage.verified && res.chain.verified;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-grass" />
          <div>
            <h3 className="text-sm font-semibold text-chalk">Proof of decision</h3>
            <p className="text-[11px] text-data">Verified live across all four 0G layers</p>
          </div>
        </div>
        {phase === "done" && allOk && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-grass/30 bg-grass/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-grass">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        )}
      </div>

      <div className="divide-y divide-line/50">
        <Layer
          state={layers.storage}
          icon={HardDrive}
          name="0G Storage"
          detail={
            res?.storage.verified
              ? `Re-fetched ${res.storage.bytes.toLocaleString()} bytes live · sha256 ${short(res.storage.sha256)}`
              : "Fetch the decision from 0G Storage by its root hash"
          }
          href={res ? STORAGE_GATEWAY + root : undefined}
          hrefLabel="open"
        />
        <Layer
          state={layers.chain}
          icon={Link2}
          name="0G Chain"
          detail={
            res?.chain.verified
              ? `Anchored in tx ${short(res.chain.tx)} · block ${res.chain.block?.toLocaleString()}`
              : "Confirm the same root was recorded onchain by the agent"
          }
          href={res?.chain.tx ? explorerTx(res.chain.tx) : undefined}
          hrefLabel="tx"
        />
        <Layer
          state={layers.compute}
          icon={Cpu}
          name="0G Compute"
          detail={res?.compute.model ? `Decided by ${res.compute.model}` : "The model that produced the pick"}
        />
        <Layer
          state={layers.da}
          icon={Database}
          name="0G Data Availability"
          detail={res?.da.available ? "Decision payload published & available" : "Decision data published to DA"}
        />
      </div>

      {/* onchain scoreline once verified */}
      {phase === "done" && res?.chain.verified && res.chain.onchainPoints != null && (
        <div className="grid grid-cols-3 gap-px border-t border-line/60 bg-line">
          <Mini label="Match points" value={String(res.chain.onchainPoints)} />
          <Mini label="Multiplier" value={`${res.chain.multiplier?.toFixed(2)}x`} accent />
          <Mini label="Effective" value={String(res.chain.effectiveScore)} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line/60 px-5 py-4">
        <span className="mono truncate text-[11px] text-data">0g://{root.slice(2, 12)}…{root.slice(-6)}</span>
        <button
          onClick={run}
          disabled={phase === "running"}
          className={clsx(
            "inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-data)] px-4 py-2 text-sm font-semibold transition-colors",
            phase === "running"
              ? "cursor-wait bg-midfield text-data"
              : "bg-grass text-pitch hover:bg-grass/90"
          )}
        >
          {phase === "running" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Verifying on 0G…</>
          ) : phase === "done" ? (
            <><ShieldCheck className="h-4 w-4" /> Verify again</>
          ) : (
            <><ShieldCheck className="h-4 w-4" /> Verify on 0G</>
          )}
        </button>
      </div>
    </div>
  );
}

function Layer({
  state,
  icon: Icon,
  name,
  detail,
  href,
  hrefLabel,
}: {
  state: LayerState;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-3.5 px-5 py-3.5 transition-colors", state === "ok" && "bg-grass/[0.04]")}>
      <span
        className={clsx(
          "grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-data)] border transition-colors",
          state === "ok"
            ? "border-grass/40 bg-grass/10 text-grass"
            : state === "fail"
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-line bg-midfield text-data"
        )}
      >
        {state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-chalk">{name}</span>
          {state === "ok" && <BadgeCheck className="h-3.5 w-3.5 text-grass" />}
        </div>
        <p className="mono truncate text-[11px] text-data">{detail}</p>
      </div>
      {href && state === "ok" && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-data transition-colors hover:text-grass"
        >
          {hrefLabel} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-midfield px-4 py-3 text-center">
      <div className={clsx("display text-2xl", accent ? "text-gold" : "text-chalk")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-data">{label}</div>
    </div>
  );
}

function short(s: string | null) {
  if (!s) return "—";
  return s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
