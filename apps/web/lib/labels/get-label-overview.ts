import "server-only";

import { loadLabelMembership, type LabelType } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { loadScoredSelection } from "../scoring/load-scored";
import { buildLabelOverview, type LabelOverview } from "./aggregate";
import { MIN_LABEL_CONFIDENCE, TAXONOMY_VERSION } from "./constants";
import type { LabelQuery } from "./query";
import { storefrontsOf } from "../overview/filters";


export async function getLabelOverview<T extends LabelType>(query: LabelQuery<T>): Promise<LabelOverview & { asOf: Date }> {
  const stores =
    query.platform === "all" ? (["google_play", "app_store"] as const) : ([query.platform] as const);
  const [selection, membership] = await Promise.all([
    loadScoredSelection(query),
    loadLabelMembership(getDatabase(), {
      stores,
      country: query.country,
      countries: storefrontsOf(query),
      taxonomyVersion: TAXONOMY_VERSION,
      types: [query.type],
      minConfidence: MIN_LABEL_CONFIDENCE,
    }),
  ]);

  return {
    asOf: selection.asOf,
    ...buildLabelOverview({
      candidates: selection.candidates,
      scores: selection.scores,
      membership,
      sort: query.sort,
      asOf: selection.asOf,
    }),
  };
}
