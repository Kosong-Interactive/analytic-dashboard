import Link from "next/link";

import { GamesTabs } from "@/components/games/games-tabs";
import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { FreshnessLine } from "@/components/shell/freshness-line";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { WatchlistList } from "@/components/watchlist/watchlist-list";
import { requireUser } from "@/lib/auth/session";
import { MAX_COMPARED } from "@/lib/compare/comparison";
import { countryLabels, platformLabels } from "@/lib/overview/filters";
import { getWatchlist } from "@/lib/watchlist/get-watchlist";
import {
  parseWatchlistQuery,
  watchlistHref,
  watchlistViewLabels,
  watchlistViewValues,
} from "@/lib/watchlist/view-model";

export const metadata = { title: "Watchlist · Game Analytic" };

interface WatchlistPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WatchlistPage({ searchParams }: WatchlistPageProps) {
  await requireUser("/games/watchlist");
  const query = parseWatchlistQuery(await searchParams);
  const view = await getWatchlist(query);

  return (
    <AppShell filters={query} active="games" buildHref={(change) => watchlistHref(query, change)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Watchlist</h1>
        <p className="text-[13px] text-dim">
          Games the team is following · {countryLabels[query.country]} · {platformLabels[query.platform]}
        </p>
      </div>

      <GamesTabs active="watchlist" filters={query} compareIds={[]} watchlistCount={view.counts.active} />
      <FreshnessLine freshness={view.freshness} asOf={view.asOf} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Watchlist status"
          items={watchlistViewValues.map((value) => ({
            key: value,
            label: `${watchlistViewLabels[value]} (${view.counts[value]})`,
            href: watchlistHref(query, { view: value }),
            active: query.view === value,
          }))}
        />
        {view.rows.length > 1 ? (
          <Link
            href={`/games/compare?ids=${view.rows.slice(0, MAX_COMPARED).map((row) => row.entry.storeAppId).join(",")}`}
            className="flex h-8 items-center rounded-md border border-line-strong px-3 text-[13px] text-ink-soft hover:bg-surface-alt"
          >
            Compare the first {Math.min(view.rows.length, MAX_COMPARED)}
          </Link>
        ) : null}
      </div>

      <Panel title="Watched games" description="Shared by the team; each change records who made it">
        {view.rows.length === 0 ? (
          <EmptyState title={view.counts.all === 0 ? "Nothing on the watchlist yet" : "No entries with this status"}>
            {view.counts.all === 0 ? (
              <>
                Use the star on any row in{" "}
                <Link href="/games" className="underline">
                  All games
                </Link>
                , or “Add to watchlist” on a game page. Entries are kept per store and country.
              </>
            ) : (
              "Switch to another status to see the remaining entries."
            )}
          </EmptyState>
        ) : (
          <WatchlistList rows={view.rows} asOf={view.asOf} />
        )}
      </Panel>

      <p className="text-xs leading-5 text-dim">
        “Since added” compares the latest observation with the one stored when the game was added. Snapshots are stored
        on change, so the baseline may be older than the date it was added. A dash means a value is missing, never zero.
      </p>
    </AppShell>
  );
}
