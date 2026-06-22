import { PageShell } from "@/components/site/PageShell";
import { MyGaffers } from "@/components/dashboard/MyGaffers";

export const metadata = { title: "Dashboard — Gaffer" };

export default function DashboardPage() {
  return (
    <PageShell>
      <MyGaffers />
    </PageShell>
  );
}
