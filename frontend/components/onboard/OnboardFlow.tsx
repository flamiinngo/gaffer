"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, keccak256, toHex, parseEther } from "viem";
import { Button } from "@/components/ui/Button";
import { GafferMark } from "@/components/brand/Logo";
import { managerAiAbi } from "@/lib/abi";
import { ogGalileo, CONTRACT_ADDRESS, explorerTx } from "@/lib/chain";
import { Check, ChevronLeft, ChevronRight, Sparkles, Trophy, Wallet, Loader2, ExternalLink, ShieldCheck } from "lucide-react";

const AVATAR_COLORS = [
  "#00C853", "#FFB700", "#7B8FBF", "#FF3B5C",
  "#00B8D4", "#AB47BC", "#FF7043", "#26A69A",
];

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
  const [avatar, setAvatar] = useState(0);
  const [sliders, setSliders] = useState<Record<string, number>>({
    attack: 60, risk: 50, form: 65, rotation: 40,
  });
  const [philosophy, setPhilosophy] = useState("");
  const [contests, setContests] = useState<Contest[] | null>(null);
  const [contestId, setContestId] = useState<number | null>(null);

  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [deploying, setDeploying] = useState(false);
  const [deployErr, setDeployErr] = useState("");
  const [result, setResult] = useState<{ tx: string; configHash: string } | null>(null);

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

  async function deploy() {
    setDeployErr("");
    if (!authenticated) return login();
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
      // 2. commit the manager config (hash recorded onchain; full blob mirrored to 0G by the agent)
      const config = { name, avatar, strategy: sliders, philosophy, owner: address };
      const configHash = keccak256(toHex(JSON.stringify(config)));
      // 3. enter the contest from the user's own wallet
      await wallet.switchChain(ogGalileo.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({ account: address, chain: ogGalileo, transport: custom(provider) });
      const feeWei = chosen ? parseEther(chosen.entryFeeOG || "0") : 0n;
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "enterContest",
        args: [BigInt(contestId), `0g://${configHash}`],
        value: feeWei,
      });
      setResult({ tx, configHash });
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
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Catenaccio Kid"
              className="h-14 w-full rounded-[var(--radius-card)] border border-line bg-pitch px-4 text-lg text-chalk placeholder:text-data/60 focus:border-grass/50 focus:outline-none"
            />
            <div className="mt-7">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-data">
                Choose a crest
              </p>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                {AVATAR_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setAvatar(i)}
                    className={clsx(
                      "relative grid aspect-square place-items-center rounded-[var(--radius-card)] border transition-all",
                      avatar === i
                        ? "scale-105 border-transparent"
                        : "border-line hover:border-data/50"
                    )}
                    style={{
                      background: `radial-gradient(circle at 50% 38%, ${c}26, var(--color-midfield-2) 72%)`,
                      boxShadow: avatar === i ? `0 0 0 2px ${c}, 0 0 20px ${c}55` : undefined,
                    }}
                    aria-label={`Crest ${i + 1}`}
                  >
                    <GafferMark className="h-7 w-8" color={c} />
                    {avatar === i && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title="Set its football brain" sub="These sliders and your notes become the AI's system prompt.">
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
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-grass/15 text-grass">
                    <ShieldCheck className="h-7 w-7" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-chalk">{name} is live</h3>
                    <p className="mt-1 text-sm text-data">Entered onchain. Your gaffer now competes autonomously.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <a href={explorerTx(result.tx)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-[var(--radius-data)] border border-line bg-pitch px-4 py-3 text-sm transition-colors hover:border-grass/40">
                    <span className="text-data">Entry transaction</span>
                    <span className="mono flex items-center gap-1.5 text-grass">{result.tx.slice(0, 12)}… <ExternalLink className="h-3.5 w-3.5" /></span>
                  </a>
                  <div className="flex items-center justify-between rounded-[var(--radius-data)] border border-line bg-pitch px-4 py-3 text-sm">
                    <span className="text-data">Config commitment</span>
                    <span className="mono text-gold">{result.configHash.slice(0, 10)}…{result.configHash.slice(-6)}</span>
                  </div>
                </div>
                <Button href="/dashboard" variant="primary" size="lg" className="w-full">Watch it play →</Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Summary label="Gaffer" value={name || "—"} />
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

                <Button variant="primary" size="lg" className="mt-6 w-full" onClick={deploy} disabled={deploying}>
                  {deploying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Deploying…</>
                  ) : !authenticated ? (
                    <><Wallet className="h-4 w-4" /> Sign in to deploy</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Deploy gaffer</>
                  )}
                </Button>
                <p className="mt-2 text-center text-[11px] text-data">Email or wallet — both work. We sponsor the gas.</p>
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
