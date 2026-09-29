import "server-only";

import type { TrendingScore } from "@analytic-dashboard/analytics";
import { loadLabelMembership, loadListingContexts, type LabelMembershipRow, type TrendCandidateRow } from "@analytic-dashboard/db";
import { countryCodeSchema, type Store } from "@analytic-dashboard/shared";

import { getDatabase } from "../database";
import { MIN_LABEL_CONFIDENCE, TAXONOMY_VERSION } from "../labels/constants";
import type { OverviewCandidate } from "../overview/view-model";
import { loadScoredSelection } from "../scoring/load-scored";
import { buildComparison, searchCandidates, type CompareQuery, type Comparison } from "./comparison";

export interface CompareView {
  asOf: Date;
  comparison: Comparison;
  /** Search results from the storefront chosen in the top bar; empty without a search. */
  results: OverviewCandidate[];
}

/**
 * Loads each storefront cohort once (a listing's score is relative to its own cohort), so
 * comparing four games costs at most two selections per country, never one per game.
 */
export async function getCompare(query: CompareQuery): Promise<CompareView> {
  const db = getDatabase();
  const asOf = new Date();
  const contexts = await loadListingContexts(db, query.ids);

  const groups = new Map<string, { store: Store; country: "id" | "us"; ids: string[] }>();
  for (const context of contexts) {
    const country = countryCodeSchema.safeParse(context.country);
    if (!country.success) continue;
    const key = `${context.store}:${country.data}`;
    const group = groups.get(key) ?? { store: context.store, country: country.data, ids: [] };
    group.ids.push(context.storeAppId);
    groups.set(key, group);
  }

  const [loaded, searchSelection] = await Promise.all([
    Promise.all(
      [...groups.values()].map(async (group) => {
        const [selection, membership] = await Promise.all([
          loadScoredSelection({ country: group.country, platform: group.store }, asOf),
          loadLabelMembership(db, {
            stores: [group.store],
            country: group.country,
            taxonomyVersion: TAXONOMY_VERSION,
            types: ["genre", "core_mechanic"],
            minConfidence: MIN_LABEL_CONFIDENCE,
          }),
        ]);
        const wanted = new Set(group.ids);
        return {
          candidates: selection.candidates.filter((candidate) => wanted.has(candidate.storeAppId)),
          scores: selection.scores.filter((score) => wanted.has(score.id)),
          membership: membership.filter((row) => wanted.has(row.storeAppId)),
        };
      }),
    ),
    query.q ? loadScoredSelection(query, asOf) : null,
  ]);

  const candidates: TrendCandidateRow[] = loaded.flatMap((group) => group.candidates);
  const scores: TrendingScore[] = loaded.flatMap((group) => group.scores);
  const membership: LabelMembershipRow[] = loaded.flatMap((group) => group.membership);

  return {
    asOf,
    comparison: buildComparison({ ids: query.ids, candidates, scores, membership }),
    results: searchSelection ? searchCandidates(searchSelection.candidates, query.q, query.ids) : [],
  };
}
