import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

export function PageHeader({
  kicker,
  title,
  sub,
  right,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line/60 bg-pitch-2">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {kicker && (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-grass">
              {kicker}
            </span>
          )}
          <h1 className="display mt-2 text-5xl text-chalk sm:text-6xl">{title}</h1>
          {sub && <p className="mt-3 max-w-xl text-sm leading-relaxed text-data">{sub}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}
