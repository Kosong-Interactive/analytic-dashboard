import { notFound } from "next/navigation";

import { EmptyState, Panel } from "@/components/overview/panel";
import { OpportunityDetail } from "@/components/research/opportunity-detail";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { overviewHref, type OverviewFilters } from "@/lib/overview/filters";
import { getOpportunityDetail } from "@/lib/research/get-opportunity-detail";

export const metadata = { title: "Research Evidence · Game Analytic" };

interface ResearchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResearchDetailPage({ params }: ResearchDetailPageProps) {
  const { id } = await params;
  await requireUser(`/research/${id}`);
  const result = await getOpportunityDetail(id);
  if (result.kind === "not_found") notFound();

  if (result.kind === "invalid_evidence") {
    const filters: OverviewFilters = { country: "id", platform: "all" };
    return (
      <AppShell filters={filters} active="overview">
        <Panel title="Research evidence unavailable">
          <EmptyState title="The stored calculation could not be validated">
            This result is hidden rather than showing incomplete or misleading evidence. Run research again or inspect the stored research row.
          </EmptyState>
        </Panel>
      </AppShell>
    );
  }

  const filters: OverviewFilters = {
    country: result.view.country === "us" ? "us" : "id",
    platform: result.view.store,
  };
  return (
    <AppShell filters={filters} active="overview" buildHref={(change) => overviewHref(filters, change)}>
      <OpportunityDetail view={result.view} now={new Date()} />
    </AppShell>
  );
}
