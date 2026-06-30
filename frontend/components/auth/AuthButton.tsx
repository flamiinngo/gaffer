"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GafferMark } from "@/components/brand/Logo";
import { shortAddr } from "@/lib/chain";
import { LogOut, ChevronDown, LayoutGrid } from "lucide-react";

export function AuthButton() {
  const { authenticated, user, login, logout } = usePrivy();
  const [open, setOpen] = useState(false);

  if (!authenticated) {
    return (
      <Button onClick={() => login()} variant="ghost" size="sm">
        Sign in
      </Button>
    );
  }

  const address = user?.wallet?.address ?? "";
  const label = user?.email?.address ?? (address ? shortAddr(address) : "Account");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-[var(--radius-data)] border border-line bg-midfield px-2.5 py-1.5 text-sm text-chalk transition-colors hover:border-grass/40"
      >
        <GafferMark className="h-4 w-5" />
        <span className="mono max-w-[120px] truncate text-xs">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-data" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-[var(--radius-card)] border border-line bg-midfield shadow-xl">
            {address && (
              <div className="border-b border-line/60 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-data">Wallet</div>
                <div className="mono mt-0.5 text-xs text-chalk">{shortAddr(address, 6)}</div>
              </div>
            )}
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 border-b border-line/60 px-3 py-2.5 text-sm text-chalk transition-colors hover:bg-pitch hover:text-grass"
            >
              <LayoutGrid className="h-4 w-4" /> My Gaffers
            </Link>
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-data transition-colors hover:bg-pitch hover:text-danger"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
