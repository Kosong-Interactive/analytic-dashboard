import Link from "next/link";

import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { SteamFreshness } from "@/components/steam/freshness";
import { RankMoversTable } from "@/components/steam/rank-movers";
import { SteamTrendTable } from "@/components/steam/trend-table";
import { requireUser } from "@/lib/auth/session";
import { getSteamTrendInputs } from "@/lib/steam/get-steam";
import { buildRankMovers } from "@/lib/steam/rank-movers";
import { buildSteamTrendList } from "@/lib/steam/trend";
import { parseSteamQuery, steamChartLabels, steamChartValues, steamHref } from "@/lib/steam/query";

export const metadata = { title: "Steam Trending · Game Analytic" };

interface SteamTrendingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamTrendingPage({ searchParams }: SteamTrendingPageProps) {
  await requireUser("/steam/trending");
  const query = parseSteamQuery(await searchParams);
  const { catalog, history, asOf } = await getSteamTrendInputs(query.country);
  const trend = buildSteamTrendList({ games: catalog.games, history, asOf });
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

      <Panel
        title="Steam Trend Score"
        description={`steam_trend_v1 · ranked within the ${trend.tracked} tracked Steam games · Steam Global`}
      >
        {trend.rows.length === 0 ? (
          <EmptyState title="No Steam games scored yet">
            The score needs at least three tracked games and enough measurable signals. Run the Steam discovery job to
            collect them.
          </EmptyState>
        ) : (
          <SteamTrendTable
            rows={trend.rows.slice(0, 25)}
            country={query.country}
            caption={`Top ${Math.min(25, trend.rows.length)} of ${trend.scoredCount} scored Steam games by Steam Trend Score`}
          />
        )}
        <p className="border-t border-line-soft px-4 py-3 text-xs leading-5 text-dim">
          {trend.scoredCount} of {trend.tracked} tracked games scored
          {trend.averageCoverage === null ? "" : `, on average ${Math.round(trend.averageCoverage * 100)}% of the score weight measurable`}
          . Chart rank gain uses Steam&apos;s own last-week rank, so it counts from the first collection; player growth,
          review speed, and sentiment change need about 3.5 days of history and are left out (not counted as zero) until
          then. Steam has no star ratings or country breadth, so this is a separate formula from the Mobile Trend Score and
          the two are never compared directly.
        </p>
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
