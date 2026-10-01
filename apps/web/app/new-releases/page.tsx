import { GameTable } from "@/components/games/game-table";
import { EmptyState, Panel } from "@/components/overview/panel";
import { Pager } from "@/components/releases/pagination";
import { AppShell } from "@/components/shell/app-shell";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { requireUser } from "@/lib/auth/session";
import { countryLabels, platformLabels } from "@/lib/overview/filters";
import { buildReleasesList } from "@/lib/releases/list";
import {
  parseReleasesQuery,
  releaseSortLabels,
  releaseSortValues,
  releasesHref,
  windowValues,
} from "@/lib/releases/query";
import { loadScoredSelection } from "@/lib/scoring/load-scored";

export const metadata = { title: "New Releases · Game Analytic" };

interface NewReleasesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewReleasesPage({ searchParams }: NewReleasesPageProps) {
  await requireUser("/new-releases");
  const query = parseReleasesQuery(await searchParams);
  const selection = await loadScoredSelection(query);
  const list = buildReleasesList({
    candidates: selection.candidates,
    scores: selection.scores,
    query,
    asOf: selection.asOf,
  });

  return (
    <AppShell filters={query} active="releases" buildHref={(change) => releasesHref(query, change)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">New Releases</h1>
        <p className="text-[15px] text-dim">
          Games whose store release date falls in the last {query.days} days · {countryLabels[query.country]} ·{" "}
          {platformLabels[query.platform]}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Release window"
          items={windowValues.map((days) => ({
            key: String(days),
            label: `Last ${days} days`,
            href: releasesHref(query, { days }),
            active: query.days === days,
          }))}
        />
        <div className="flex items-center gap-2 text-sm text-dim">
          <span>Sort by</span>
          <SegmentedLinks
            label="Sort by"
            items={releaseSortValues.map((sort) => ({
              key: sort,
              label: releaseSortLabels[sort],
              href: releasesHref(query, { sort }),
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
            Try a longer window. Discovery samples store charts and keyword seeds, which favour established games, so
            recent releases are under-represented.
          </EmptyState>
        ) : (
          <GameTable
            rows={list.rows}
            showRelease
            caption={`Games released in the last ${query.days} days, sorted by ${releaseSortLabels[query.sort]}`}
          />
        )}
        <Pager
          page={list.page}
          pageCount={list.pageCount}
          pageSize={list.pageSize}
          total={list.total}
          hrefFor={(page) => releasesHref(query, { page })}
        />
      </Panel>

      <p className="text-sm leading-5 text-dim">
        Release dates come from the store and keep their storefront context. {list.withoutReleaseDate} tracked{" "}
        {list.withoutReleaseDate === 1 ? "game has" : "games have"} no release date and cannot appear here. “Newly
        discovered” on the Overview is a different signal: when this system first observed a game.
      </p>
    </AppShell>
  );
}
