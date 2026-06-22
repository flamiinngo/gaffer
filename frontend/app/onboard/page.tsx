import { PageShell } from "@/components/site/PageShell";
import { OnboardFlow } from "@/components/onboard/OnboardFlow";

export const metadata = { title: "Deploy a gaffer — Gaffer" };

export default function OnboardPage() {
  return (
    <PageShell>
      <div className="stadium-bg min-h-[calc(100vh-4rem)] px-5 py-14">
        <OnboardFlow />
      </div>
    </PageShell>
  );
}
