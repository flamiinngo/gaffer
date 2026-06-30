"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, http, custom, parseEther, parseEventLogs } from "viem";
import { Button } from "@/components/ui/Button";
import { Pitch, slotsFromXI } from "@/components/pitch/Pitch";
import { GafferBot } from "@/components/brand/GafferBot";
import { managerAiAbi } from "@/lib/abi";
import { ogGalileo, CONTRACT_ADDRESS, explorerTx } from "@/lib/chain";
import { poolFromProofs, buildPreviewXI, personaFor, type PoolPlayer, type Sliders } from "@/lib/onboardPreview";
import { Check, ChevronLeft, ChevronRight, Sparkles, Trophy, Loader2, ExternalLink, ShieldCheck, Cpu } from "lucide-react";


const STRATEGY = [
  { key: "attack", label: "Attack vs Defence", left: "Defensive", right: "Attacking", help: "How your gaffer balances the XI." },
  { key: "risk", label: "Risk Tolerance", left: "Safe", right: "Differential", help: "How aggressively it backs differentials." },
  { key: "form", label: "Form vs Reputation", left: "Big names", right: "In-form", help: "Recent form weight vs reputation." },
  { key: "rotation", label: "Squad Rotation", left: "Settled XI", right: "Rotate often", help: "How readily it changes the lineup." },
] as const;

type Contest = {
  id: number;
  name: string;
  prizePoolOG: string;
  entryFeeOG: string;
  participantCount: number;
  status: string;
};

const STEPS = ["Identity", "Strategy", "Contest", "Deploy"];

export function OnboardFlow() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [sliders, setSliders] = useState<Sliders>({
    attack: 60, risk: 50, form: 65, rotation: 40,
  });
  const [philosophy, setPhilosophy] = useState("");
  const [contests, setContests] = useState<Contest[] | null>(null);
  const [contestId, setContestId] = useState<number | null>(null);
  const [pool, setPool] = useState<PoolPlayer[]>([]);

  // live preview of the XI this gaffer would pick, reacting to the strategy sliders
  const persona = useMemo(() => personaFor(sliders), [sliders]);
  const preview = useMemo(
    () => (pool.length ? buildPreviewXI(pool, sliders) : null),
    [pool, sliders]
  );
  const previewSlots = useMemo(
    () =>
      preview
        ? slotsFromXI(preview.xi.map((p) => ({ ...p, captain: p.name === preview.captain })))
        : [],
    [preview]
  );

  useEffect(() => {
    fetch("/proofs.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPool(poolFromProofs(d.agents ?? [])))
      .catch(() => setPool([]));
  }, []);

  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [deploying, setDeploying] = useState(false);
  const [pendingDeploy, setPendingDeploy] = useState(false);
  const [deployErr, setDeployErr] = useState("");
  const [result, setResult] = useState<{ tx: string; configHash: string; agentId: number } | null>(null);

  useEffect(() => {
    fetch("/api/contests", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        // Only contests with entries still open (UPCOMING) can be deployed into.
        const open = (d.contests ?? []).filter((c: Contest) => c.status === "UPCOMING");
        setContests(open);
        const preferred = Number(process.env.NEXT_PUBLIC_OPEN_CONTEST_ID);
        const pick = open.find((c: Contest) => c.id === preferred) ?? open[0];
        if (pick) setContestId(pick.id);
      })
      .catch(() => setContests([]));
  }, []);

  // Seamless sign-in: clicking deploy while logged out opens Privy, and once the wallet is ready
  // we continue straight into the deploy — no second click, no relabelled button.
  useEffect(() => {
    if (pendingDeploy && authenticated && wallets[0]) {
      setPendingDeploy(false);
      void deploy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeploy, authenticated, wallets]);

  function onDeploy() {
    if (!authenticated) {
      setPendingDeploy(true);
      login();
    } else {
      void deploy();
    }
  }

  async function deploy() {
    setDeployErr("");
    const wallet = wallets[0];
    if (!wallet) return setDeployErr("No wallet found — try signing in again.");
    if (contestId == null) return setDeployErr("Pick a contest first.");
    setDeploying(true);
    try {
      const address = wallet.address as `0x${string}`;
      // 1. sponsor gas for brand-new (web2) wallets so they can transact
      await fetch("/api/deploy/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      // 2. commit a compact brain config onchain so the gaffer's name + persona are always
      //    recoverable on its profile and the marketplace. (Decision-level proofs anchor to 0G
      //    Storage each matchday when it actually plays.)
      const configHash = JSON.stringify({ n: name, p: persona.title, ph: philosophy, s: sliders });
      // 3. create the agent (a record that earns its way to a tradeable NFT), then enter the contest
      await wallet.switchChain(ogGalileo.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({ account: address, chain: ogGalileo, transport: custom(provider) });
      const pub = createPublicClient({ chain: ogGalileo, transport: http() });

      const createTx = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "createAgent",
        args: [configHash],
      });
      const createReceipt = await pub.waitForTransactionReceipt({ hash: createTx });
      const created = parseEventLogs({ abi: managerAiAbi, eventName: "AgentCreated", logs: createReceipt.logs });
      const agentId = created[0]?.args.agentId;
      if (agentId == null) throw new Error("Agent created but id not found — check the explorer.");

      const feeWei = chosen ? parseEther(chosen.entryFeeOG || "0") : 0n;
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "enterContest",
        args: [BigInt(contestId), agentId],
        value: feeWei,
      });
      await pub.waitForTransactionReceipt({ hash: tx });
      setResult({ tx, configHash, agentId: Number(agentId) });
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "Deploy failed";
      setDeployErr(msg);
    } finally {
      setDeploying(false);
    }
  }

  const canNext =
    (step === 0 && name.trim().length >= 2) ||
    (step === 1 && true) ||
    (step === 2 && contestId !== null) ||
    step === 3;

  const chosen = contests?.find((c) => c.id === contestId);

  return (
    <div className="mx-auto max-w-2xl">
      <Stepper step={step} />

      <div className="card mt-8 p-7 sm:p-9">
        {step === 0 && (
          <Step title="Name your gaffer" sub="Give it an identity. This is who climbs the table.">
            <div className="mb-5 flex flex-col items-center">
              <span className="h-32 w-32 overflow-hidden rounded-[var(--radius-card)] border border-line bg-pitch-2">
                <GafferBot agentId={0} name={name || "your gaffer"} tier={0} size={128} />
              </span>
              <p className="mt-2 text-[11px] text-data">Your gaffer-bot — it changes as you name it. This becomes its NFT.</p>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Catenaccio Kid"
              className="h-14 w-full rounded-[var(--radius-card)] border border-line bg-pitch px-4 text-lg text-chalk placeholder:text-data/60 focus:border-grass/50 focus:outline-none"
            />
            <p className="mt-3 text-xs text-data">Each name generates a unique gaffer-bot — its colours, eyes and kit are its own. Pick a name you like the look of.</p>
          </Step>
        )}

        {step === 1 && (
          <Step title="Set its football brain" sub="These sliders and your notes become the AI's system prompt — watch its team take shape as you tune.">
            <div className="mb-6 flex items-center gap-3 rounded-[var(--radius-card)] border border-grass/25 bg-grass/[0.06] px-4 py-3">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-data)] bg-pitch-2">
                <GafferBot agentId={0} name={name || "your gaffer"} tier={0} size={56} />
              </span>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-data">Emerging personality</div>
                <div className="text-base font-semibold text-chalk">
                  {name?.trim() ? `${name} · ` : ""}<span className="text-grass">{persona.title}</span>
                </div>
                <div className="text-xs text-data">&ldquo;{persona.tagline}&rdquo;</div>
              </div>
            </div>
            <div className="space-y-6">
              {STRATEGY.map((s) => (
                <div key={s.key}>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold text-chalk">{s.label}</label>
                    <span className="mono text-xs text-grass">{sliders[s.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sliders[s.key]}
                    onChange={(e) => setSliders((v) => ({ ...v, [s.key]: +e.target.value }))}
                    className="slider w-full"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-data">
                    <span>{s.left}</span>
                    <span>{s.right}</span>
                  </div>
                </div>
              ))}
              <div>
                <label className="mb-2 block text-sm font-semibold text-chalk">
                  Anything else your gaffer believes in?
                </label>
                <textarea
                  value={philosophy}
                  onChange={(e) => setPhilosophy(e.target.value)}
                  rows={3}
                  placeholder="e.g. Never trust a striker on a 4-game drought. Always captain the in-form #10."
                  className="w-full rounded-[var(--radius-card)] border border-line bg-pitch p-4 text-sm text-chalk placeholder:text-data/60 focus:border-grass/50 focus:outline-none"
                />
              </div>
            </div>

            {/* live preview — the XI this brain would pick from the current matchday pool */}
            {previewSlots.length > 0 && (
              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-data">
                    Sample XI · preview only
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-line/50 px-2.5 py-0.5 text-[11px] font-semibold text-data">
                    {preview?.formation}
                  </span>
                </div>
                <Pitch xi={previewSlots} formation={preview?.formation ?? "4-3-3"} />
                <p className="mt-2 flex items-center gap-1.5 text-center text-[11px] leading-relaxed text-data">
                  <Cpu className="h-3.5 w-3.5 text-grass" />
                  Not live yet — this is a taste of how your sliders shape its style. Once deployed, <span className="text-chalk">your gaffer makes its own real pick on 0G Compute</span> each matchday and gets sharper from its results.
                </p>
              </div>
            )}
          </Step>
        )}

        {step === 2 && (
          <Step title="Choose your contest" sub="Real prize pools, live onchain. Pick where your gaffer competes.">
            {!contests ? (
              <div className="space-y-3">
                {[0, 1].map((i) => <div key={i} className="skeleton h-20 w-full rounded-[var(--radius-card)]" />)}
              </div>
            ) : contests.length === 0 ? (
              <p className="py-8 text-center text-sm text-data">No open contests right now. Check back shortly.</p>
            ) : (
              <div className="space-y-3">
                {contests.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setContestId(c.id)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-[var(--radius-card)] border p-4 text-left transition-all",
                      contestId === c.id ? "border-grass bg-grass/5" : "border-line bg-midfield-2 hover:border-data/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-data)] bg-grass/10 text-grass">
                        <Trophy className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-chalk">{c.name}</div>
                        <div className="text-xs text-data">
                          {Number(c.prizePoolOG).toFixed(2)} OG pool · {c.participantCount} managers
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gold">{Number(c.entryFeeOG).toFixed(2)} OG</div>
                      <div className="text-[11px] text-data">entry</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Step>
        )}

        {step === 3 && (
          <Step
            title={result ? "Gaffer deployed" : "Deploy your gaffer"}
            sub={result ? "It's onchain and autonomous from here." : "Review, then send it onto the pitch. It runs itself from here."}
          >
            {result ? (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-grass/30 bg-grass/5 px-6 py-8 text-center">
                  <span className="h-28 w-28 overflow-hidden rounded-[var(--radius-card)] border border-grass/30 bg-pitch-2">
                    <GafferBot agentId={result.agentId} name={name} tier={0} size={112} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-chalk">{name} is live</h3>
                    <p className="mt-0.5 text-sm font-semibold text-grass">{persona.title} · Rookie · Season 1</p>
                    <p className="mt-1.5 text-sm text-data">Its brain is committed to 0G. From here it picks, scores and builds a verifiable career — autonomously. The longer you trust it, the more it&apos;s worth.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <a href={explorerTx(result.tx)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-[var(--radius-data)] border border-line bg-pitch px-4 py-3 text-sm transition-colors hover:border-grass/40">
                    <span className="text-data">Entry transaction</span>
                    <span className="mono flex items-center gap-1.5 text-grass">{result.tx.slice(0, 12)}… <ExternalLink className="h-3.5 w-3.5" /></span>
                  </a>
                  <div className="flex items-center justify-between rounded-[var(--radius-data)] border border-line bg-pitch px-4 py-3 text-sm">
                    <span className="text-data">Your agent</span>
                    <span className="mono text-gold">#{result.agentId}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[var(--radius-data)] border border-line bg-pitch px-4 py-3 text-sm">
                    <span className="text-data">Brain committed</span>
                    <span className="font-semibold text-gold">{persona.title}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button href={`/gaffer/${result.agentId}`} variant="primary" size="lg" className="flex-1 justify-center">View your gaffer →</Button>
                  <Button href="/dashboard" variant="ghost" size="lg" className="justify-center">My Gaffers</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-pitch-2 px-4 py-3">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-data)] bg-pitch"><GafferBot agentId={0} name={name || "your gaffer"} tier={0} size={64} /></span>
                  <div>
                    <div className="text-base font-semibold text-chalk">{name || "Your gaffer"}</div>
                    <div className="text-xs text-grass">{persona.title} · about to go onchain</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <Summary label="Gaffer" value={name || "—"} />
                  <Summary label="Personality" value={persona.title} />
                  <Summary label="Strategy" value={`ATK ${sliders.attack} · RISK ${sliders.risk} · FORM ${sliders.form} · ROT ${sliders.rotation}`} mono />
                  <Summary label="Contest" value={chosen?.name ?? "—"} />
                  <Summary label="Entry fee" value={chosen ? `${Number(chosen.entryFeeOG).toFixed(2)} OG` : "—"} accent />
                </div>

                <div className="mono mt-5 rounded-[var(--radius-card)] border border-line bg-pitch p-4 text-xs leading-relaxed text-data">
                  On deploy: <span className="text-chalk">enterContest()</span> registers you onchain →
                  config committed → the agent runs your gaffer on <span className="text-grass">0G Compute</span> each matchday.
                </div>

                {deployErr && (
                  <p className="mt-4 rounded-[var(--radius-data)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{deployErr}</p>
                )}

                <Button variant="primary" size="lg" className="mt-6 w-full" onClick={onDeploy} disabled={deploying || pendingDeploy}>
                  {deploying || pendingDeploy ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Deploying…</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Deploy your gaffer</>
                  )}
                </Button>
                <p className="mt-2 text-center text-[11px] text-data">Email or wallet — both work, and we sponsor the gas. You&apos;ll sign in once if you haven&apos;t already.</p>
              </>
            )}
          </Step>
        )}

        {/* nav */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1 text-sm text-data transition-colors hover:text-chalk disabled:opacity-0"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < 3 ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-grass">
              <Sparkles className="h-3.5 w-3.5" /> Ready to deploy
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={clsx(
                "grid h-9 w-9 place-items-center rounded-full border text-sm font-bold transition-all",
                i < step
                  ? "border-grass bg-grass text-pitch"
                  : i === step
                    ? "border-grass bg-grass/10 text-grass"
                    : "border-line bg-midfield text-data"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={clsx("text-[11px] font-medium", i === step ? "text-chalk" : "text-data")}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={clsx("mx-2 h-px flex-1 -translate-y-2.5", i < step ? "bg-grass" : "bg-line")} />
          )}
        </div>
      ))}
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="display text-3xl text-chalk">{title}</h2>
      <p className="mt-1.5 mb-6 text-sm text-data">{sub}</p>
      {children}
    </div>
  );
}

function Summary({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-data)] border border-line bg-midfield-2 px-4 py-3">
      <span className="text-xs uppercase tracking-wider text-data">{label}</span>
      <span className={clsx("text-sm font-semibold", accent ? "text-gold" : "text-chalk", mono && "mono text-xs")}>
        {value}
      </span>
    </div>
  );
}
