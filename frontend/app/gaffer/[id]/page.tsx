import { PageShell } from "@/components/site/PageShell";
import { GafferProfile } from "@/components/gaffer/GafferProfile";

export default async function GafferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <GafferProfile agentId={id} />
    </PageShell>
  );
}
