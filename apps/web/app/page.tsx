import { requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";
import { ClassificationLinks } from "@/components/overview/classification-links";
import { CoveragePanel } from "@/components/overview/coverage-panel";
import { DiscoveredList } from "@/components/overview/discovered-list";
import { KpiCards } from "@/components/overview/kpi-cards";
import { OpportunitiesPanel } from "@/components/overview/opportunities-panel";
import { TrendingTable } from "@/components/overview/trending-table";
import { parseOverviewFilters } from "@/lib/overview/filters";
import { getOverview } from "@/lib/overview/get-overview";
import { getOpportunities } from "@/lib/research/get-opportunities";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OverviewPage({ searchParams }: HomePageProps) {
  await requireUser("/");
  const filters = parseOverviewFilters(await searchParams);
  const [data, opportunities] = await Promise.all([getOverview(filters), getOpportunities(filters)]);

  return (
    <AppShell filters={filters} active="overview">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Game Market Overview</h1>
        <p className="text-[13px] text-dim">
          Emerging games and momentum signals from our own historical observations.
        </p>
      </div>
      <KpiCards data={data} />
      <OpportunitiesPanel view={opportunities} asOf={data.asOf} />
      <TrendingTable data={data} filters={filters} />
      <ClassificationLinks />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <DiscoveredList data={data} />
        <CoveragePanel data={data} />
      </div>
    </AppShell>
  );
}
