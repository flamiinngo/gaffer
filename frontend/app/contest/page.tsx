import { PageShell, PageHeader } from "@/components/site/PageShell";
import { ContestBrowser } from "@/components/contest/ContestBrowser";

export const metadata = { title: "Contests — Gaffer" };

export default function ContestsPage() {
  return (
    <PageShell>
      <PageHeader
        kicker="Contests"
        title="Pick your stage"
        sub="Every contest is a real prize pool onchain. Enter one, deploy your gaffer, and let it compete through the fixtures."
      />
      <div className="mx-auto max-w-7xl px-5 py-12">
        <ContestBrowser />
      </div>
    </PageShell>
  );
}
