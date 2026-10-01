import Link from "next/link";
import { Suspense } from "react";

import { KpiGrid, type Kpi } from "@/components/overview/kpi-cards";
import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { SteamChartTable } from "@/components/steam/chart-table";
import { SteamFreshness } from "@/components/steam/freshness";
import { SteamOpportunitiesFallback, SteamOpportunitiesSection } from "@/components/steam/opportunities-panel";
import { SteamGamesTable } from "@/components/steam/games-table";
import { SteamTrendTable } from "@/components/steam/trend-table";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format/format";
import { getSteamChart, getSteamTrendInputs } from "@/lib/steam/get-steam";
import { parseSteamGamesQuery } from "@/lib/steam/games-query";
import { buildSteamReleasesList, parseSteamReleasesQuery } from "@/lib/steam/releases";
import { buildSteamTrendList } from "@/lib/steam/trend";
import { parseSteamQuery, steamHref, toSteamCountry } from "@/lib/steam/query";

export const metadata = { title: "Steam Overview · Game Analytic" };

const DAY_MS = 86_400_000;
const TOP_CHART_ROWS = 10;
const LATEST_RELEASES = 5;

interface SteamOverviewPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamOverviewPage({ searchParams }: SteamOverviewPageProps) {
  await requireUser("/steam");
  const params = await searchParams;
  const query = parseSteamQuery({ country: params.country });
  const [{ catalog, history }, played] = await Promise.all([
    getSteamTrendInputs(query.country),
    getSteamChart({ country: query.country, chart: "most_played" }),
  ]);
  const { asOf, source } = catalog;
  const trend = buildSteamTrendList({ games: catalog.games, history, asOf });

  const released = buildSteamReleasesList({
    games: catalog.games,
    membership: catalog.membership,
    query: { ...parseSteamReleasesQuery({ country: query.country }), days: 30, sort: "newest", page: 1 },
    asOf,
  });
  const latest = { ...released, rows: released.rows.slice(0, LATEST_RELEASES) };
  const newlyDiscovered = catalog.games.filter((game) => asOf.getTime() - game.firstSeenAt.getTime() <= DAY_MS).length;
  const tableQuery = parseSteamGamesQuery({ country: query.country });
  const topChart = played.chart.rows.slice(0, TOP_CHART_ROWS);

  const kpis: Kpi[] = [
    {
      label: "Games Tracked",
      tip: "Steam games observed by this system. A sample of the Most Played and Top Sellers charts, not the Steam catalog.",
      value: catalog.games.length.toLocaleString("en-US"),
      note: "sampled from Steam charts",
    },
    {
      label: "Newly Discovered",
      tip: "Games first observed by this system in the last 24 hours. This is not the Steam release date.",
      value: newlyDiscovered.toLocaleString("en-US"),
      note: "first observed in the last 24h",
    },
    {
      label: "Released Recently",
      tip: "Tracked games whose Steam release date falls in the last 30 days.",
      value: released.total.toLocaleString("en-US"),
      note: "released in the last 30 days",
    },
    {
      label: "Last Collected",
      tip: "Finish time of the newest Steam collection run that produced data.",
      value: formatRelative(source.lastCollectedAt, asOf),
      note: source.lastCollectedAt ? `${source.lastCollectedAt.toISOString().replace("T", " ").slice(0, 16)} UTC` : "no successful run yet",
    },
  ];

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam-overview"
      buildHref={(change) => steamHref(query, { country: change.country === undefined ? undefined : toSteamCountry(change.country) }, "/steam")}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Steam Market Overview</h1>
        <p className="text-[15px] text-dim">
          Desktop games from the Steam Most Played and Top Sellers charts, from our own historical observations.
        </p>
      </div>

      <SteamFreshness source={source} capturedAt={catalog.chartCapturedAt.most_played} asOf={asOf} />
      <KpiGrid items={kpis} />

      <Suspense fallback={<SteamOpportunitiesFallback />}>
        <SteamOpportunitiesSection country={query.country} />
      </Suspense>

      <Panel
        title="Trending Games"
        description="Steam Trend Score (steam_trend_v1) · Steam Global · scored within Steam only"
        action={
          <Link href="/steam/trending" className="text-sm text-ink-soft underline-offset-2 hover:underline">
            Full ranking and rank movers
          </Link>
        }
      >
        {trend.rows.length === 0 ? (
          <EmptyState title="No Steam games scored yet">
            The Steam Trend Score needs at least three tracked games and enough measurable signals.
          </EmptyState>
        ) : (
          <SteamTrendTable
            rows={trend.rows.slice(0, 5)}
            country={query.country}
            caption={`Top ${Math.min(5, trend.rows.length)} of ${trend.scoredCount} scored Steam games by Steam Trend Score`}
          />
        )}
      </Panel>

      <Panel
        title="Most Played"
        description="Top of the Steam Global chart · players and reviews are Steam's own figures"
        action={
          <Link href="/steam/charts" className="text-sm text-ink-soft underline-offset-2 hover:underline">
            All charts
          </Link>
        }
      >
        {topChart.length === 0 ? (
          <EmptyState title="No Steam chart collected yet">Run the Steam discovery job to fill this chart.</EmptyState>
        ) : (
          <SteamChartTable rows={topChart} query={{ country: query.country, chart: "most_played" }} caption={`Top ${topChart.length} Most Played games`} />
        )}
      </Panel>

      <Panel
        title="Latest releases"
        description="Tracked games released in the last 30 days, newest first"
        action={
          <Link href="/steam/new-releases" className="text-sm text-ink-soft underline-offset-2 hover:underline">
            New Releases
          </Link>
        }
      >
        {latest.rows.length === 0 ? (
          <EmptyState title="No tracked game was released in the last 30 days">
            Only games that reach the Steam charts are tracked, so recent releases that have not charted yet are missing.
          </EmptyState>
        ) : (
          <SteamGamesTable rows={latest.rows} query={tableQuery} asOf={asOf} firstRank={1} caption="Latest Steam releases" />
        )}
      </Panel>
    </AppShell>
  );
}
