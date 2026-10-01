import { EmptyState, Panel } from "@/components/overview/panel";
import { Pager } from "@/components/releases/pagination";
import { AppShell } from "@/components/shell/app-shell";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { SteamFreshness } from "@/components/steam/freshness";
import { SteamGamesTable } from "@/components/steam/games-table";
import { requireUser } from "@/lib/auth/session";
import { getSteamGameCatalog } from "@/lib/steam/get-steam";
import { parseSteamGamesQuery } from "@/lib/steam/games-query";
import {
  buildSteamReleasesList,
  parseSteamReleasesQuery,
  steamReleaseSortLabels,
  steamReleaseSortValues,
  steamReleasesHref,
  steamWindowValues,
} from "@/lib/steam/releases";

export const metadata = { title: "Steam New Releases · Game Analytic" };

interface SteamReleasesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamReleasesPage({ searchParams }: SteamReleasesPageProps) {
  await requireUser("/steam/new-releases");
  const query = parseSteamReleasesQuery(await searchParams);
  const catalog = await getSteamGameCatalog(query.country);
  const list = buildSteamReleasesList({
    games: catalog.games,
    membership: catalog.membership,
    query,
    asOf: catalog.asOf,
  });
  // The table links carry only the country.
  const tableQuery = parseSteamGamesQuery({ country: query.country });
  const priceLabel = query.country === "id" ? "Indonesia (IDR)" : "Global (USD)";

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam-releases"
      buildHref={(change) => steamReleasesHref(query, { country: change.country })}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">New Releases</h1>
        <p className="text-[15px] text-dim">
          Games whose Steam release date falls in the last {query.days} days · Steam Global · prices in {priceLabel}
        </p>
      </div>

      <SteamFreshness source={catalog.source} capturedAt={catalog.chartCapturedAt.most_played} asOf={catalog.asOf} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Release window"
          items={steamWindowValues.map((days) => ({
            key: String(days),
            label: `Last ${days} days`,
            href: steamReleasesHref(query, { days }),
            active: query.days === days,
          }))}
        />
        <div className="flex items-center gap-2 text-sm text-dim">
          <span>Sort by</span>
          <SegmentedLinks
            label="Sort by"
            items={steamReleaseSortValues.map((sort) => ({
              key: sort,
              label: steamReleaseSortLabels[sort],
              href: steamReleasesHref(query, { sort }),
              active: query.sort === sort,
            }))}
          />
        </div>
      </div>

      <Panel
        title="Released games"
        description={`${list.total} of ${list.tracked} tracked games were released in this window`}
      >
        {list.rows.length === 0 ? (
          <EmptyState title="No tracked game was released in this window">
            Try a longer window. Only games that reach the Steam Most Played or Top Sellers charts are tracked, so recent
            releases that have not charted yet are missing.
          </EmptyState>
        ) : (
          <SteamGamesTable
            rows={list.rows}
            query={tableQuery}
            asOf={catalog.asOf}
            firstRank={(list.page - 1) * list.pageSize + 1}
            caption={`Steam games released in the last ${query.days} days, sorted by ${steamReleaseSortLabels[query.sort]}`}
          />
        )}
        <Pager
          page={list.page}
          pageCount={list.pageCount}
          pageSize={list.pageSize}
          total={list.total}
          hrefFor={(page) => steamReleasesHref(query, { page })}
        />
      </Panel>

      <p className="text-sm leading-5 text-dim">
        Coverage is limited to games seen in the Steam Most Played or Top Sellers charts, not every new release. Release
        dates come from Steam. {list.withoutReleaseDate} tracked{" "}
        {list.withoutReleaseDate === 1 ? "game has" : "games have"} no release date and cannot appear here. “Newly
        discovered” elsewhere is a different signal: when this system first observed a game.
      </p>
    </AppShell>
  );
}
