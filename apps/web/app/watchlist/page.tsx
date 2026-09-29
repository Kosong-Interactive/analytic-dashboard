import Link from "next/link";

import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { FreshnessLine } from "@/components/shell/freshness-line";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { WatchlistList } from "@/components/watchlist/watchlist-list";
import { requireUser } from "@/lib/auth/session";
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
  await requireUser("/watchlist");
  const query = parseWatchlistQuery(await searchParams);
  const view = await getWatchlist(query);

  return (
    <AppShell filters={query} active="watchlist" buildHref={(change) => watchlistHref(query, change)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Watchlist</h1>
        <p className="text-[13px] text-dim">
          Games the team is following · {countryLabels[query.country]} · {platformLabels[query.platform]}
        </p>
      </div>

      <FreshnessLine freshness={view.freshness} asOf={view.asOf} />

      <SegmentedLinks
        label="Watchlist status"
        items={watchlistViewValues.map((value) => ({
          key: value,
          label: `${watchlistViewLabels[value]} (${view.counts[value]})`,
          href: watchlistHref(query, { view: value }),
          active: query.view === value,
        }))}
      />

      <Panel title="Watched games" description="Shared by the team; each change records who made it">
        {view.rows.length === 0 ? (
          <EmptyState title={view.counts.all === 0 ? "Nothing on the watchlist yet" : "No entries with this status"}>
            {view.counts.all === 0 ? (
              <>
                Open a game from{" "}
                <Link href="/games" className="underline">
                  Games
                </Link>{" "}
                or Trending and choose “Add to watchlist”. Entries are kept per store and country.
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
