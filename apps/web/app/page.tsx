import { requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";
import { ClassificationPending } from "@/components/overview/classification-pending";
import { CoveragePanel } from "@/components/overview/coverage-panel";
import { DiscoveredList } from "@/components/overview/discovered-list";
import { KpiCards } from "@/components/overview/kpi-cards";
import { TrendingTable } from "@/components/overview/trending-table";
import { parseOverviewFilters } from "@/lib/overview/filters";
import { getOverview } from "@/lib/overview/get-overview";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OverviewPage({ searchParams }: HomePageProps) {
  await requireUser("/");
  const filters = parseOverviewFilters(await searchParams);
  const data = await getOverview(filters);

  return (
    <AppShell filters={filters} active="overview">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Mobile Game Market</h1>
        <p className="text-[13px] text-dim">
          Emerging games and momentum signals from our own historical observations.
        </p>
      </div>
      <KpiCards data={data} />
      <TrendingTable data={data} filters={filters} />
      <ClassificationPending />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <DiscoveredList data={data} />
        <CoveragePanel data={data} />
      </div>
    </AppShell>
  );
}
