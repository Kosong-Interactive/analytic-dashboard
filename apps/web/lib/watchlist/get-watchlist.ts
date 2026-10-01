import "server-only";

import { findWatchlistEntry, loadWatchlist } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { summarizeFreshness, type StoreFreshness } from "../freshness/summary";
import { loadScoredSelection } from "../scoring/load-scored";
import type { WatchlistStatus } from "./status";
import { buildWatchlistView, type WatchlistQuery, type WatchlistView } from "./view-model";
import { storefrontsOf } from "../overview/filters";

/** Reads stored entries and observations only; it never triggers collection. */
export async function getWatchlist(
  query: WatchlistQuery,
): Promise<WatchlistView & { asOf: Date; freshness: StoreFreshness[] }> {
  const stores =
    query.platform === "all" ? (["google_play", "app_store"] as const) : ([query.platform] as const);
  const [entries, selection] = await Promise.all([
    loadWatchlist(getDatabase(), { stores, country: query.country, countries: storefrontsOf(query) }),
    loadScoredSelection(query),
  ]);
  return {
    asOf: selection.asOf,
    freshness: summarizeFreshness(selection.health, stores, selection.asOf),
    ...buildWatchlistView({
      entries,
      candidates: selection.candidates,
      scores: selection.scores,
      view: query.view,
    }),
  };
}

export async function getWatchlistStatus(storeAppId: string): Promise<WatchlistStatus | null> {
  return (await findWatchlistEntry(getDatabase(), storeAppId))?.status ?? null;
}
