"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { AuthButton } from "@/components/auth/AuthButton";

const NAV = [
  { label: "Contests", href: "/contest" },
  { label: "Live", href: "/dashboard" },
  { label: "Verify", href: "/verify" },
  { label: "Developers", href: "/developers" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-pitch/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "relative rounded-[var(--radius-data)] px-3.5 py-2 text-sm font-medium transition-colors",
                  active ? "text-chalk" : "text-data hover:text-chalk"
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3.5 -bottom-px h-px bg-grass shadow-[0_0_8px_var(--color-grass)]" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5">
          <AuthButton />
          <Button href="/onboard" variant="primary" size="sm">
            Deploy
          </Button>
        </div>
      </div>
    </header>
  );
}
