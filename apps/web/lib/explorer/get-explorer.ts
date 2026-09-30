import "server-only";

import { loadLabelMembership, loadTaxonomyLabels, loadWatchlist } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { summarizeFreshness, type StoreFreshness } from "../freshness/summary";
import { buildLabelOverview, type LabelStats } from "../labels/aggregate";
import { MIN_LABEL_CONFIDENCE, TAXONOMY_VERSION } from "../labels/constants";
import { loadScoredSelection } from "../scoring/load-scored";
import type { WatchlistStatus } from "../watchlist/status";
import { buildExplorerList, type ExplorerList } from "./list";
import type { ExplorerQuery, LabelFilter } from "./query";

export interface ExplorerView {
  asOf: Date;
  list: ExplorerList;
  freshness: StoreFreshness[];
  /** Watchlist status of listings in this storefront selection, by store listing id. */
  watched: Map<string, WatchlistStatus>;
  activeWatchlistCount: number;
  /** Selected games found in this selection; others were picked in another storefront. */
  compareSelection: Array<{ id: string; title: string; iconUrl: string | null }>;
  /** The label filter's taxonomy entry and roll-up; `null` without a filter or for an unknown label. */
  label: { filter: LabelFilter; displayName: string; stats: LabelStats | null } | null;
}

/** Reads stored observations and labels only; it never triggers collection or classification. */
export async function getExplorer(query: ExplorerQuery): Promise<ExplorerView> {
  const stores =
    query.platform === "all" ? (["google_play", "app_store"] as const) : ([query.platform] as const);
  const db = getDatabase();
  // A label outside the active taxonomy is ignored rather than showing an always-empty list.
  const taxonomyLabel = query.label
    ? (await loadTaxonomyLabels(db, TAXONOMY_VERSION)).find(
        (entry) => entry.type === query.label?.type && entry.slug === query.label.slug,
      )
    : undefined;
  const effective: ExplorerQuery = { ...query, label: taxonomyLabel ? query.label : undefined };
  const types = [...new Set(["genre", "core_mechanic", ...(effective.label ? [effective.label.type] : [])] as const)];

  const [selection, membership, watchlist] = await Promise.all([
    loadScoredSelection(effective),
    loadLabelMembership(db, {
      stores,
      country: effective.country,
      taxonomyVersion: TAXONOMY_VERSION,
      types,
      minConfidence: MIN_LABEL_CONFIDENCE,
    }),
    loadWatchlist(db, { stores, country: effective.country }),
  ]);
  const byId = new Map(selection.candidates.map((candidate) => [candidate.storeAppId, candidate]));
  const filter = effective.label;
  // Same roll-up as the Genres and Mechanics pages, so the header matches the row that linked here.
  const stats = filter
    ? (buildLabelOverview({
        candidates: selection.candidates,
        scores: selection.scores,
        membership: membership.filter((row) => row.type === filter.type),
        sort: "games",
        asOf: selection.asOf,
      }).labels.find((entry) => entry.slug === filter.slug) ?? null)
    : null;

  return {
    asOf: selection.asOf,
    list: buildExplorerList({
      candidates: selection.candidates,
      scores: selection.scores,
      membership,
      query: effective,
      asOf: selection.asOf,
    }),
    freshness: summarizeFreshness(selection.health, stores, selection.asOf),
    watched: new Map(watchlist.map((entry) => [entry.storeAppId, entry.status])),
    activeWatchlistCount: watchlist.filter((entry) => entry.status !== "archived").length,
    compareSelection: query.compare.flatMap((id) => {
      const candidate = byId.get(id);
      return candidate ? [{ id, title: candidate.title, iconUrl: candidate.iconUrl }] : [];
    }),
    label: filter && taxonomyLabel ? { filter, displayName: taxonomyLabel.displayName, stats } : null,
  };
}
