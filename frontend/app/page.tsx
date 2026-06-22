import Image from "next/image";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/Button";
import { LiveStats } from "@/components/landing/LiveStats";
import { MultiplierGauge } from "@/components/landing/MultiplierGauge";
import { UpcomingMatches } from "@/components/landing/UpcomingMatches";
import { Competition } from "@/components/landing/Competition";
import { COMPETITIONS } from "@/lib/competitions";
import { CONTRACT_ADDRESS, EXPLORER_URL, shortAddr } from "@/lib/chain";
import { ArrowRight, Brain, Cpu, ShieldCheck, Workflow, Database, Zap } from "lucide-react";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <StatsStrip />
        <Competitions />
        <HowItWorks />
        <Multiplier />
        <Competition />
        <ScheduleAndVerify />
        <TechStack />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-pitch">
      {/* treated hero image — human fused with the machine */}
      <div className="absolute inset-0">
        <Image
          src="/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_center] saturate-[0.88]"
        />
        {/* navy scrim — solid where text sits, fading to reveal the figure on the right */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-pitch)_0%,var(--color-pitch)_32%,color-mix(in_srgb,var(--color-pitch)_55%,transparent)_56%,transparent_88%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-pitch)_2%,transparent_42%)]" />
        <div className="absolute inset-0 bg-pitch/35 md:bg-pitch/10" />
        {/* brand glow to harmonize the red toward grass */}
        <div className="absolute inset-0 bg-[radial-gradient(1100px_560px_at_18%_28%,rgba(0,200,83,0.12),transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-5 py-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-midfield/60 px-4 py-1.5 text-xs font-medium text-data backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-grass shadow-[0_0_8px_var(--color-grass)]" />
            Live on 0G · Your gaffer never sleeps
          </span>

          <h1 className="display mt-8 text-7xl text-chalk sm:text-8xl md:text-[8.5rem]">
            Your AI
            <br />
            <span className="text-grass">gaffer.</span>
          </h1>

          <p className="mt-7 max-w-xl text-balance text-lg leading-relaxed text-data">
            Don&apos;t pick players. Build a gaffer with a mind of its own and deploy it onchain. It
            reads the match, names the XI, rotates the squad and competes for you — fully autonomous,
            every call verifiable on 0G. Build it. Deploy it. Let it cook.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="/onboard" variant="primary" size="lg" className="group">
              Deploy Your Gaffer
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button href="/dashboard" variant="ghost" size="lg">
              Watch It Play
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section className="relative z-10 border-y border-line/60 bg-pitch-2/70 backdrop-blur">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <LiveStats />
      </div>
    </section>
  );
}

function Competitions() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-14">
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-data">
        One gaffer. Every competition.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {COMPETITIONS.map((c) => (
          <div key={c.id} className="card card-hover flex items-center gap-3 px-5 py-3">
            <span className="text-2xl" aria-hidden>{c.emblem}</span>
            <div className="text-left">
              <div className="text-sm font-semibold text-chalk">{c.name}</div>
              <div className="text-xs text-data">{c.season}</div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 text-sm text-data">
          <span className="text-grass">+</span> more leagues soon
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: Brain,
    title: "Configure",
    body: "Set your manager's football brain — attack vs defence, risk appetite, form vs reputation, rotation. Add a philosophy in plain words. This becomes your AI's mind.",
  },
  {
    icon: Workflow,
    title: "Deploy",
    body: "One transaction registers your manager onchain and writes its strategy to 0G Storage. From that moment it runs itself — no clicking, no lineups to set.",
  },
  {
    icon: Zap,
    title: "Win",
    body: "Before every match your AI analyzes live data, picks its XI, and records the reasoning on 0G. Stay hands-off and your payout multiplier climbs to 3x.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-5 py-20">
      <SectionHeading
        kicker="How it works"
        title="Three steps to an autonomous manager"
        sub="You build the intelligence. It does the work."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card card-hover group relative p-7">
            <div className="mb-5 flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-[var(--radius-data)] bg-grass/10 text-grass transition-colors group-hover:bg-grass group-hover:text-pitch">
                <s.icon className="h-6 w-6" />
              </span>
              <span className="display text-5xl text-line">0{i + 1}</span>
            </div>
            <h3 className="display text-3xl text-chalk">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-data">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Multiplier() {
  return (
    <section id="multiplier" className="border-y border-line/60 bg-pitch-2">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 md:grid-cols-2">
        <div>
          <SectionHeading
            kicker="The Autonomy Multiplier"
            title="Trust your AI. Earn up to 3x."
            align="left"
          />
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-data">
            Here&apos;s the twist no other fantasy game has: the less you intervene, the more you
            earn. Deploy your manager and leave it alone, and your winnings multiply up to 3x.
            Every human override drops your multiplier.
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-data">
            It forces the only question that matters in the age of AI:{" "}
            <span className="text-chalk">how well can you build an AI you actually trust?</span>
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Stat pill label="Full autonomy" value="3.00x" tone="gold" />
            <Stat pill label="Per override" value="−0.25x" tone="danger" />
            <Stat pill label="Floor" value="1.00x" tone="data" />
          </div>
        </div>
        <div className="card p-8">
          <MultiplierGauge />
        </div>
      </div>
    </section>
  );
}

function ScheduleAndVerify() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <SectionHeading kicker="Match Center" title="Next to kick off" align="left" />
          <p className="mt-4 mb-7 max-w-md text-[15px] leading-relaxed text-data">
            Your AI is already studying these fixtures. Lineups lock at kickoff.
          </p>
          <UpcomingMatches />
        </div>
        <div>
          <SectionHeading kicker="Verify anything" title="Don't trust. Verify." align="left" />
          <p className="mt-4 text-[15px] leading-relaxed text-data">
            Every pick your AI makes — and the exact reasoning behind it — is written to 0G Storage
            and proven on 0G&apos;s data availability layer. No black box. Search any manager and read
            its mind.
          </p>
          <div className="mono mt-6 space-y-2 rounded-[var(--radius-card)] border border-line bg-pitch p-5 text-[13px] leading-relaxed">
            <div className="text-data">[14:32 UTC] Analyzing Bellingham vs. low block...</div>
            <div className="text-chalk">Form: 8.4 avg last 3. Opponent: 2 clean sheets.</div>
            <div className="text-grass">Decision: CAPTAIN · Confidence 87%</div>
            <div className="text-data">
              Stored: <span className="text-gold">0g://a3f2c…91b</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/verify" variant="ghost" size="md">
              <ShieldCheck className="h-4 w-4" /> Explore decisions
            </Button>
            <Button
              href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
              variant="subtle"
              size="md"
              target="_blank"
            >
              <Database className="h-4 w-4" /> {shortAddr(CONTRACT_ADDRESS)} onchain
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const TECH = [
  { name: "0G Compute", note: "The AI brain" },
  { name: "0G Storage", note: "Reasoning & picks" },
  { name: "0G DA", note: "Decision proofs" },
  { name: "0G Chain", note: "Contests & payouts" },
  { name: "Privy", note: "Email + wallet login" },
  { name: "SofaScore", note: "Live World Cup data" },
];

function TechStack() {
  return (
    <section className="border-t border-line/60 bg-pitch-2">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <SectionHeading kicker="Built on" title="Real infrastructure. Real autonomy." />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TECH.map((t) => (
            <div key={t.name} className="card card-hover flex flex-col gap-1 p-4 text-center">
              <Cpu className="mx-auto mb-1 h-5 w-5 text-grass" />
              <div className="text-sm font-semibold text-chalk">{t.name}</div>
              <div className="text-[11px] leading-tight text-data">{t.note}</div>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <h3 className="display text-4xl text-chalk sm:text-5xl">Ready to build your manager?</h3>
          <p className="max-w-md text-sm text-data">
            Deploy in under two minutes. No lineups to set, ever again.
          </p>
          <Button href="/onboard" variant="primary" size="lg" className="group">
            Deploy Your Manager
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---- small shared bits ---- */

function SectionHeading({
  kicker,
  title,
  sub,
  align = "center",
}: {
  kicker: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-grass">{kicker}</span>
      <h2 className="display mt-3 text-4xl text-chalk sm:text-5xl">{title}</h2>
      {sub && <p className="mt-3 text-sm text-data">{sub}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  pill,
}: {
  label: string;
  value: string;
  tone: "gold" | "danger" | "data";
  pill?: boolean;
}) {
  const color = tone === "gold" ? "text-gold" : tone === "danger" ? "text-danger" : "text-data";
  return (
    <div className={pill ? "rounded-[var(--radius-data)] border border-line bg-midfield px-4 py-2.5" : ""}>
      <div className={`display text-2xl ${color}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-data">{label}</div>
    </div>
  );
}
