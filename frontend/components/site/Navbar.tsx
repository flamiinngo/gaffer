"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { AuthButton } from "@/components/auth/AuthButton";

const NAV = [
  { label: "Contests", href: "/contest" },
  { label: "Market", href: "/market" },
  { label: "My Gaffers", href: "/dashboard" },
  { label: "Verify", href: "/verify" },
  { label: "Developers", href: "/developers" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-pitch/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
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
                {active && <span className="absolute inset-x-3.5 -bottom-px h-px bg-grass shadow-[0_0_8px_var(--color-grass)]" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="hidden md:block">
            <AuthButton />
          </div>
          <Button href="/onboard" variant="primary" size="sm">
            Deploy your gaffer
          </Button>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-[var(--radius-data)] border border-line text-chalk transition-colors hover:border-grass/40 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* mobile menu */}
      {open && (
        <div className="border-t border-line/60 bg-pitch md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-3">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "rounded-[var(--radius-data)] px-3 py-3 text-[15px] font-medium transition-colors",
                    active ? "bg-grass/10 text-grass" : "text-data hover:bg-midfield hover:text-chalk"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-line/60 pt-3">
              <AuthButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
