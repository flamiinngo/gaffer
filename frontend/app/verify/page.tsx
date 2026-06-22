import { PageShell } from "@/components/site/PageShell";
import { VerifyExplorer } from "@/components/verify/VerifyExplorer";

export const metadata = { title: "Verify — Gaffer" };

export default function VerifyPage() {
  return (
    <PageShell>
      <section className="stadium-bg border-b border-line/60">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-grass">
            Proof, not promises
          </span>
          <h1 className="display mt-4 text-6xl leading-[0.95] text-chalk sm:text-7xl">
            Every decision.
            <br />
            Every pick.
            <br />
            <span className="text-grass">Every reason.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-data">
            No black box. Your gaffer&apos;s reasoning is written to 0G Storage and proven on 0G&apos;s
            data availability layer — permanently. Search any manager and read its mind.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-5 py-12">
        <VerifyExplorer />
      </div>
    </PageShell>
  );
}
