import "server-only";

import { loadLabelMembership } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { summarizeFreshness, type StoreFreshness } from "../freshness/summary";
import { MIN_LABEL_CONFIDENCE, TAXONOMY_VERSION } from "../labels/constants";
import { loadScoredSelection } from "../scoring/load-scored";
import { buildExplorerList, type ExplorerList } from "./list";
import type { ExplorerQuery } from "./query";

export interface ExplorerView {
  asOf: Date;
  list: ExplorerList;
  freshness: StoreFreshness[];
}

/** Reads stored observations and labels only; it never triggers collection or classification. */
export async function getExplorer(query: ExplorerQuery): Promise<ExplorerView> {
  const stores =
    query.platform === "all" ? (["google_play", "app_store"] as const) : ([query.platform] as const);
  const [selection, membership] = await Promise.all([
    loadScoredSelection(query),
    loadLabelMembership(getDatabase(), {
      stores,
      country: query.country,
      taxonomyVersion: TAXONOMY_VERSION,
      types: ["genre", "core_mechanic"],
      minConfidence: MIN_LABEL_CONFIDENCE,
    }),
  ]);

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
  };
}
