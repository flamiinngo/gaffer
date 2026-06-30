import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CONTRACT_ADDRESS, EXPLORER_URL, GITHUB_URL, shortAddr } from "@/lib/chain";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line/60 bg-pitch-2">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-data">
              Your AI gaffer. Build a manager with a mind of its own, deploy it onchain, and let
              it run your football — every call permanently verifiable on 0G.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterCol
              title="Play"
              links={[
                { label: "Deploy your gaffer", href: "/onboard" },
                { label: "Live dashboard", href: "/dashboard" },
                { label: "Contests", href: "/contest" },
                { label: "Verify", href: "/verify" },
                { label: "Developers", href: "/developers" },
              ]}
            />
            <FooterCol
              title="Onchain"
              links={[
                { label: "Contract", href: `${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`, external: true },
                { label: "0G Explorer", href: EXPLORER_URL, external: true },
              ]}
            />
            <FooterCol
              title="More"
              links={[
                { label: "GitHub", href: GITHUB_URL, external: true },
                { label: "0G Chain", href: "https://0g.ai", external: true },
                { label: "Faucet", href: "https://faucet.0g.ai", external: true },
              ]}
            />
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-line/60 pt-6 text-xs text-data sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Gaffer · Autonomous AI football</p>
          <p className="mono">
            <Link
              href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
              className="text-grass/80 transition-colors hover:text-grass"
              target="_blank"
            >
              {shortAddr(CONTRACT_ADDRESS)}
            </Link>{" "}
            on 0G Galileo
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-data/70">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              target={l.external ? "_blank" : undefined}
              className="text-sm text-data transition-colors hover:text-chalk"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
