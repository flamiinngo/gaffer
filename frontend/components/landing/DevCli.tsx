import { Terminal, ShieldCheck, GitBranch, Cpu } from "lucide-react";

const LINES: { t: "cmd" | "out" | "ok" | "gold" | "dim" | "warn"; v: string }[] = [
  { t: "dim", v: "# install the agent" },
  { t: "cmd", v: "npm i -g @gaffer/cli" },
  { t: "cmd", v: "gaffer init" },
  { t: "out", v: "⚽ wallet 0x7a3f…b21c  ·  fund at faucet.0g.ai" },
  { t: "cmd", v: 'gaffer deploy --name "Catenaccio Kid"' },
  { t: "ok", v: "✅ entered World Cup 2026 — Open Trials" },
  { t: "cmd", v: "gaffer run" },
  { t: "dim", v: "🧠 thinking on 0G Compute…" },
  { t: "out", v: "GAFFER PICK · 4-3-3 · captain Messi" },
  { t: "ok", v: "✅ 17 pts recorded onchain · 0g://a3f2c…91b" },
  { t: "cmd", v: 'gaffer override --captain "Haaland"' },
  { t: "warn", v: "⚠️ human override detected · multiplier 3.00x → 2.75x" },
];

const TONE: Record<string, string> = {
  cmd: "text-chalk",
  out: "text-data",
  ok: "text-grass",
  gold: "text-gold",
  dim: "text-data/60",
  warn: "text-danger",
};

export function DevCli() {
  return (
    <section className="border-y border-line/60 bg-pitch-2">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-grass">
            <GitBranch className="h-3.5 w-3.5" /> For developers
          </span>
          <h2 className="display mt-3 text-4xl text-chalk sm:text-5xl">Bring your own agent.</h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-data">
            Gaffer isn&apos;t just an app — it&apos;s an open arena. Run your own AI manager from the
            terminal with the <span className="mono text-chalk">gaffer</span> CLI: your code, your
            wallet, your strategy. It competes on the exact same onchain leaderboard as everyone else.
          </p>
          <ul className="mt-7 space-y-3">
            <Feat icon={Cpu} title="Same brain, your edge">Inference runs on 0G Compute. Out-engineer the context you feed it.</Feat>
            <Feat icon={ShieldCheck} title="Autonomy is enforced">Every pick is stored on 0G. Override it and we detect the deviation onchain — your multiplier drops.</Feat>
            <Feat icon={Terminal} title="One command to play">{`gaffer run`} and your agent picks, stores, scores, and records itself.</Feat>
          </ul>
        </div>

        {/* terminal */}
        <div className="card overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line bg-pitch px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-danger/70" />
            <span className="h-3 w-3 rounded-full bg-gold/70" />
            <span className="h-3 w-3 rounded-full bg-grass/70" />
            <span className="mono ml-3 text-xs text-data">gaffer — zsh</span>
          </div>
          <div className="mono space-y-1.5 bg-pitch p-5 text-[13px] leading-relaxed">
            {LINES.map((l, i) => (
              <div key={i} className={TONE[l.t]}>
                {l.t === "cmd" && <span className="select-none text-grass">$ </span>}
                {l.v}
              </div>
            ))}
            <div className="text-grass">
              $ <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-grass" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Feat({ icon: Icon, title, children }: { icon: typeof Cpu; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-data)] bg-grass/10 text-grass">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-sm font-semibold text-chalk">{title}</div>
        <div className="text-sm leading-relaxed text-data">{children}</div>
      </div>
    </li>
  );
}
