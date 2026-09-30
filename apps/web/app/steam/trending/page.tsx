import Link from "next/link";

import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { SteamFreshness } from "@/components/steam/freshness";
import { RankMoversTable } from "@/components/steam/rank-movers";
import { requireUser } from "@/lib/auth/session";
import { getSteamGameCatalog } from "@/lib/steam/get-steam";
import { buildRankMovers } from "@/lib/steam/rank-movers";
import { parseSteamQuery, steamChartLabels, steamChartValues, steamHref } from "@/lib/steam/query";

export const metadata = { title: "Steam Trending · Game Analytic" };

interface SteamTrendingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamTrendingPage({ searchParams }: SteamTrendingPageProps) {
  await requireUser("/steam/trending");
  const query = parseSteamQuery(await searchParams);
  const catalog = await getSteamGameCatalog(query.country);
  const movers = buildRankMovers(catalog.games, query.chart);
  const base = "/steam/trending";
  const countryQuery = query.country === "id" ? "" : `country=${query.country}`;

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam-trending"
      buildHref={(change) => steamHref(query, { country: change.country }, base)}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Trending Games</h1>
        <p className="text-[13px] text-dim">Steam Global · chart movement against last week</p>
      </div>

      <SteamFreshness source={catalog.source} capturedAt={catalog.chartCapturedAt[query.chart]} asOf={catalog.asOf} />

      <Panel title="Trend Score" description="Steam Trend Score is not available yet">
        <EmptyState title="Desktop trend score is being prepared">
          Mobile Trend Score is built from store ratings, rating velocity, and country breadth, which Steam does not
          have. A separate, versioned Desktop score is planned, so no Steam score is shown here and the Mobile score is
          never applied to Steam games.
        </EmptyState>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Chart"
          items={steamChartValues.map((value) => ({
            key: value,
            label: steamChartLabels[value],
            href: steamHref(query, { chart: value }, base),
            active: query.chart === value,
          }))}
        />
        <Link
          href={countryQuery ? `/steam/games?${countryQuery}&sort=chart` : "/steam/games?sort=chart"}
          className="text-xs text-ink-soft underline-offset-2 hover:underline"
        >
          Browse all tracked games
        </Link>
      </div>

      <Panel
        title={`Rank movers · ${steamChartLabels[query.chart]}`}
        description="Places gained or lost against Steam's own last-week rank. This is a rank change, not a Trend Score."
      >
        {movers.inChart === 0 ? (
          <EmptyState title="This chart has not been collected yet">Run the Steam discovery job to fill it.</EmptyState>
        ) : movers.measured === 0 ? (
          <EmptyState title="Steam gave no last-week ranks">
            Movement needs a last-week rank from Steam, which this chart did not include.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-line-soft xl:grid-cols-2">
            <div className="bg-surface">
              <RankMoversTable title="Rising" movers={movers.risers} country={query.country} />
            </div>
            <div className="bg-surface">
              <RankMoversTable title="Falling" movers={movers.fallers} country={query.country} />
            </div>
          </div>
        )}
        <p className="border-t border-line-soft px-4 py-3 text-xs text-dim">
          {movers.inChart} games in this chart · {movers.measured} with a last-week rank · {movers.unchanged} unchanged.
          Games without a last-week rank are left out, not counted as new or as zero movement.
        </p>
      </Panel>
    </AppShell>
  );
}
