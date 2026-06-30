"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, http, custom, parseEther, parseEventLogs } from "viem";
import { Button } from "@/components/ui/Button";
import { managerAiAbi } from "@/lib/abi";
import { ogGalileo, CONTRACT_ADDRESS, explorerTx } from "@/lib/chain";
import { Loader2, ShieldCheck, ExternalLink, Copy, Check, Lock, Globe } from "lucide-react";

export function CreateContest() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [name, setName] = useState("");
  const [fee, setFee] = useState("0");
  const [brief, setBrief] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ tx: string; contestId: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setErr("");
    if (!authenticated) return login();
    const wallet = wallets[0];
    if (!wallet) return setErr("No wallet found — sign in again.");
    if (name.trim().length < 3) return setErr("Give your contest a name (3+ chars).");
    setBusy(true);
    try {
      await wallet.switchChain(ogGalileo.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({ account: wallet.address as `0x${string}`, chain: ogGalileo, transport: custom(provider) });
      const pub = createPublicClient({ chain: ogGalileo, transport: http() });
      const now = Math.floor(Date.now() / 1000);
      const start = now + 24 * 3600; // entries close in 24h, then it runs
      const end = now + days * 86400;
      const hash = await wc.writeContract({
        address: CONTRACT_ADDRESS,
        abi: managerAiAbi,
        functionName: "createContest",
        args: [name.trim(), parseEther(fee || "0"), BigInt(start), BigInt(end), isPrivate, brief.trim()],
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: managerAiAbi, eventName: "ContestCreated", logs: receipt.logs });
      const contestId = Number(logs[0]?.args.contestId ?? 0);
      setResult({ tx: hash, contestId });
    } catch (e) {
      setErr((e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? "Failed to create contest");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const link = typeof window !== "undefined" ? `${window.location.origin}/contest/${result.contestId}` : `/contest/${result.contestId}`;
    return (
      <div className="mt-8 space-y-5">
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-grass/30 bg-grass/5 px-6 py-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-grass/15 text-grass"><ShieldCheck className="h-7 w-7" /></span>
          <div>
            <h3 className="text-lg font-semibold text-chalk">Contest #{result.contestId} is live</h3>
            <p className="mt-1 text-sm text-data">{isPrivate ? "Private — share the invite link with the gaffers you want in." : "Public — it'll show in the contest list."}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-data)] border border-line bg-pitch px-4 py-3">
          <span className="mono truncate text-sm text-grass">{link}</span>
          <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 text-data transition-colors hover:text-grass">
            {copied ? <Check className="h-4 w-4 text-grass" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex gap-3">
          <Button href={`/contest/${result.contestId}`} variant="primary" size="md" className="flex-1 justify-center">Open contest</Button>
          <a href={explorerTx(result.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[var(--radius-data)] border border-line px-4 py-2 text-sm text-data transition-colors hover:text-grass">
            Tx <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <Field label="Contest name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Sunday League Cup" className="h-12 w-full rounded-[var(--radius-card)] border border-line bg-pitch px-4 text-chalk placeholder:text-data/60 focus:border-grass/50 focus:outline-none" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Entry fee (OG)" hint="0 = free to enter">
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className="h-12 w-full rounded-[var(--radius-card)] border border-line bg-pitch px-4 text-chalk focus:border-grass/50 focus:outline-none" />
        </Field>
        <Field label="Runs for" hint="entries close in 24h">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-12 w-full rounded-[var(--radius-card)] border border-line bg-pitch px-4 text-chalk focus:border-grass/50 focus:outline-none">
            <option value={7}>1 week</option>
            <option value={14}>2 weeks</option>
            <option value={30}>1 month</option>
          </select>
        </Field>
      </div>

      <Field label="Brief / custom instructions" hint="what the competing gaffers should optimise for">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="e.g. Knockout survival — back nations you trust to go deep; reward clean sheets." className="w-full rounded-[var(--radius-card)] border border-line bg-pitch px-4 py-3 text-sm text-chalk placeholder:text-data/60 focus:border-grass/50 focus:outline-none" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Toggle active={!isPrivate} onClick={() => setIsPrivate(false)} icon={<Globe className="h-4 w-4" />} label="Public" sub="Anyone can join" />
        <Toggle active={isPrivate} onClick={() => setIsPrivate(true)} icon={<Lock className="h-4 w-4" />} label="Private" sub="Invite link only" />
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}
      <Button onClick={create} variant="primary" size="lg" className="w-full justify-center" disabled={busy}>
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating onchain…</> : authenticated ? "Create contest" : "Sign in to create"}
      </Button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-data">{label}</span>
        {hint && <span className="text-[11px] text-data/70">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Toggle({ active, onClick, icon, label, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-left transition-colors ${active ? "border-grass/50 bg-grass/10" : "border-line bg-pitch hover:border-line/80"}`}>
      <span className={active ? "text-grass" : "text-data"}>{icon}</span>
      <span>
        <span className={`block text-sm font-semibold ${active ? "text-chalk" : "text-data"}`}>{label}</span>
        <span className="block text-[11px] text-data">{sub}</span>
      </span>
    </button>
  );
}
