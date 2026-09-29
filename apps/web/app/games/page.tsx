import Link from "next/link";

import { ExplorerControls } from "@/components/explorer/explorer-controls";
import { CompareTray } from "@/components/explorer/compare-tray";
import { ExplorerTable } from "@/components/explorer/explorer-table";
import { GamesTabs } from "@/components/games/games-tabs";
import { EmptyState, Panel } from "@/components/overview/panel";
import { Pager } from "@/components/releases/pagination";
import { AppShell } from "@/components/shell/app-shell";
import { FreshnessLine } from "@/components/shell/freshness-line";
import { requireUser } from "@/lib/auth/session";
import { MAX_COMPARED, toggleCompareId } from "@/lib/compare/comparison";
import { getExplorer } from "@/lib/explorer/get-explorer";
import { clearedExplorerFilters, explorerHref, explorerSortLabels, parseExplorerQuery } from "@/lib/explorer/query";
import { MIN_LABEL_CONFIDENCE } from "@/lib/labels/constants";
import { countryLabels, platformLabels } from "@/lib/overview/filters";

export const metadata = { title: "Games · Game Analytic" };

interface GamesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GamesPage({ searchParams }: GamesPageProps) {
  await requireUser("/games");
  const query = parseExplorerQuery(await searchParams);
  const { asOf, list, freshness, watched, activeWatchlistCount, compareSelection } = await getExplorer(query);
  const toggleCompareHref = (id: string) => explorerHref(query, { compare: toggleCompareId(query.compare, id) });

  return (
    <AppShell filters={query} active="games" buildHref={(change) => explorerHref(query, change)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Games</h1>
        <p className="text-[13px] text-dim">
          Every tracked game · {countryLabels[query.country]} · {platformLabels[query.platform]} · {list.tracked} tracked
        </p>
      </div>

      <GamesTabs active="all" filters={query} compareIds={query.compare} watchlistCount={activeWatchlistCount} />
      <FreshnessLine freshness={freshness} asOf={asOf} />
      <ExplorerControls query={query} options={list.options} />

      <Panel title="Tracked games" description={`${list.total} of ${list.tracked} tracked games match`}>
        {list.rows.length === 0 ? (
          <EmptyState title={list.tracked === 0 ? "No games collected for this storefront yet" : "No games match these filters"}>
            {list.tracked === 0 ? (
              "Games appear here after the scheduled collector has run for this country and platform."
            ) : (
              <>
                Loosen or{" "}
                <Link href={explorerHref(query, clearedExplorerFilters)} className="underline">
                  clear the filters
                </Link>
                . Games without a value (for example no release date or rating) never match a filter on that value.
              </>
            )}
          </EmptyState>
        ) : (
          <ExplorerTable
            rows={list.rows}
            asOf={asOf}
            actions={{ watched, compareIds: query.compare, compareFull: query.compare.length >= MAX_COMPARED, toggleCompareHref }}
            caption={`Tracked games sorted by ${explorerSortLabels[query.sort]}, page ${list.page} of ${list.pageCount}`}
          />
        )}
        <Pager
          page={list.page}
          pageCount={list.pageCount}
          pageSize={list.pageSize}
          total={list.total}
          hrefFor={(page) => explorerHref(query, { page })}
        />
      </Panel>

      <CompareTray
        selection={compareSelection}
        selectedCount={query.compare.length}
        compareHref={`/games/compare?ids=${query.compare.join(",")}${query.country !== "id" ? `&country=${query.country}` : ""}`}
        clearHref={explorerHref(query, { compare: [] })}
        removeHref={(id) => explorerHref(query, { compare: query.compare.filter((other) => other !== id) })}
      />

      <p className="text-xs leading-5 text-dim">
        Tracked games are a sample collected from store charts and keyword seeds, not the full store catalogue. “First
        seen” is when this system first observed a game, not its release date. Genre and mechanic labels are inferred
        (rules or AI, shown only at {Math.round(MIN_LABEL_CONFIDENCE * 100)}%+ confidence) unless confirmed manually. A
        dash means the value is missing, never zero.
      </p>
    </AppShell>
  );
}
