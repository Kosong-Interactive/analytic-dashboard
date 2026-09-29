import "server-only";

import { loadLabelMembership, loadWatchlist } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { summarizeFreshness, type StoreFreshness } from "../freshness/summary";
import { MIN_LABEL_CONFIDENCE, TAXONOMY_VERSION } from "../labels/constants";
import { loadScoredSelection } from "../scoring/load-scored";
import type { WatchlistStatus } from "../watchlist/status";
import { buildExplorerList, type ExplorerList } from "./list";
import type { ExplorerQuery } from "./query";

export interface ExplorerView {
  asOf: Date;
  list: ExplorerList;
  freshness: StoreFreshness[];
  /** Watchlist status of listings in this storefront selection, by store listing id. */
  watched: Map<string, WatchlistStatus>;
  activeWatchlistCount: number;
  /** Selected games found in this selection; others were picked in another storefront. */
  compareSelection: Array<{ id: string; title: string; iconUrl: string | null }>;
}

/** Reads stored observations and labels only; it never triggers collection or classification. */
export async function getExplorer(query: ExplorerQuery): Promise<ExplorerView> {
  const stores =
    query.platform === "all" ? (["google_play", "app_store"] as const) : ([query.platform] as const);
  const [selection, membership, watchlist] = await Promise.all([
    loadScoredSelection(query),
    loadLabelMembership(getDatabase(), {
      stores,
      country: query.country,
      taxonomyVersion: TAXONOMY_VERSION,
      types: ["genre", "core_mechanic"],
      minConfidence: MIN_LABEL_CONFIDENCE,
    }),
    loadWatchlist(getDatabase(), { stores, country: query.country }),
  ]);
  const byId = new Map(selection.candidates.map((candidate) => [candidate.storeAppId, candidate]));

  return {
    asOf: selection.asOf,
    list: buildExplorerList({
      candidates: selection.candidates,
      scores: selection.scores,
      membership,
      query,
      asOf: selection.asOf,
    }),
    freshness: summarizeFreshness(selection.health, stores, selection.asOf),
    watched: new Map(watchlist.map((entry) => [entry.storeAppId, entry.status])),
    activeWatchlistCount: watchlist.filter((entry) => entry.status !== "archived").length,
    compareSelection: query.compare.flatMap((id) => {
      const candidate = byId.get(id);
      return candidate ? [{ id, title: candidate.title, iconUrl: candidate.iconUrl }] : [];
    }),
  };
}
