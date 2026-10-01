import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { SteamChartTable } from "@/components/steam/chart-table";
import { SteamFreshness } from "@/components/steam/freshness";
import { requireUser } from "@/lib/auth/session";
import { getSteamChart } from "@/lib/steam/get-steam";
import { parseSteamQuery, steamChartLabels, steamChartValues, steamHref, toSteamCountry } from "@/lib/steam/query";

export const metadata = { title: "Steam Charts · Game Analytic" };

interface SteamPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamPage({ searchParams }: SteamPageProps) {
  await requireUser("/steam/charts");
  const query = parseSteamQuery(await searchParams);
  const { chart, source, asOf } = await getSteamChart(query);
  const priceLabel = query.country === "id" ? "Indonesia (IDR)" : "Global (USD)";

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam-charts"
      noCounterpart
      buildHref={(change) => steamHref(query, { country: change.country === undefined ? undefined : toSteamCountry(change.country) })}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Steam Charts</h1>
        <p className="text-[15px] text-dim">
          {steamChartLabels[query.chart]} · Steam Global · prices in {priceLabel}
        </p>
      </div>

      <SteamFreshness source={source} capturedAt={chart.capturedAt} asOf={asOf} />

      <SegmentedLinks
        label="Chart"
        className="self-start"
        items={steamChartValues.map((value) => ({
          key: value,
          label: steamChartLabels[value],
          href: steamHref(query, { chart: value }),
          active: query.chart === value,
        }))}
      />

      <Panel
        title={steamChartLabels[query.chart]}
        description="Steam's own chart position. Player counts and reviews are Steam's figures, not sales or revenue; “—” means Steam gave no value."
      >
        {chart.rows.length === 0 ? (
          <EmptyState title="No Steam chart collected yet">
            Run the Steam discovery job to fill this chart.
          </EmptyState>
        ) : (
          <SteamChartTable
            rows={chart.rows}
            query={query}
            caption={`${steamChartLabels[query.chart]} chart, ${chart.rows.length} games`}
          />
        )}
      </Panel>
    </AppShell>
  );
}
