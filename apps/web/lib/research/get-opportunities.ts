import "server-only";

import { aggregateMarketOpportunities, OPPORTUNITY_SCORE_V1 } from "@analytic-dashboard/analytics";
import {
  loadMarketOpportunityIndex,
  loadOpportunitiesByIds,
  loadOpportunityHistories,
  type StoredOpportunity,
  type StoredOpportunityPreview,
} from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { scopeLabel, storefrontsOf, type OverviewFilters } from "../overview/filters";
import { summarizeMarketRuns } from "./market-runs";
import { buildOpportunitiesView, type OpportunitiesView, type OpportunityScope } from "./view-model";

const OVERVIEW_CARDS = 5;

/**
 * Reads stored research results only; research itself runs as a daily job. A SEA or World market
 * combines the storefront runs: each cohort is one opportunity whose score is the median storefront.
 */
export async function getOpportunities(filters: OverviewFilters): Promise<OpportunitiesView> {
  const stores = filters.platform === "all" ? (["google_play", "app_store"] as const) : ([filters.platform] as const);
  const storefronts = storefrontsOf(filters);
  const combined = storefronts.length > 1;
  const db = getDatabase();
  const { runs, index } = await loadMarketOpportunityIndex(db, {
    stores,
    countries: storefronts,
    formulaVersion: OPPORTUNITY_SCORE_V1.version,
  });

  const aggregated = aggregateMarketOpportunities(index, storefronts);
  const scored = aggregated.filter((item) => item.opportunity.score !== null);
  // A few extra rows so a card that fails to parse does not leave a gap.
  const shown = scored.slice(0, OVERVIEW_CARDS + 3);
  // While nothing can be scored, surface the cohort with the most tracked games as a preview.
  const previewPick =
    scored.length === 0
      ? [...aggregated].sort(
          (a, b) =>
            b.opportunity.memberCount - a.opportunity.memberCount ||
            b.opportunity.confidence - a.opportunity.confidence ||
            a.opportunity.opportunityKey.localeCompare(b.opportunity.opportunityKey),
        )[0]
      : undefined;
  const picked = previewPick ? [previewPick] : shown;

  const full = await loadOpportunitiesByIds(db, picked.map((item) => item.opportunity.id));
  const byId = new Map(full.map((row) => [row.id, row]));
  const ordered = picked.flatMap((item) => {
    const row = byId.get(item.opportunity.id);
    return row ? [{ row, item }] : [];
  });

  const scopes = new Map<string, OpportunityScope>();
  if (combined) {
    for (const { row, item } of ordered) {
      scopes.set(row.id, {
        label: scopeLabel(filters),
        scored: item.scoredStorefronts,
        evaluated: item.evaluatedStorefronts,
        total: storefronts.length,
      });
    }
  }

  const opportunities = ordered.flatMap(({ row }) => (row.score === null ? [] : [row as StoredOpportunity]));
  const previewRow = ordered.map(({ row }) => row).find((row): row is StoredOpportunityPreview => row.score === null) ?? null;
  const histories = await loadOpportunityHistories(
    db,
    opportunities.map((opportunity) => ({
      store: opportunity.store,
      country: opportunity.country,
      formulaVersion: opportunity.formulaVersion,
      taxonomyVersion: opportunity.taxonomyVersion,
      opportunityKey: opportunity.opportunityKey,
      asOf: opportunity.asOf,
    })),
  );

  return buildOpportunitiesView({
    opportunities,
    preview: previewRow,
    runs: summarizeMarketRuns(
      runs,
      index.map((row) => ({ store: row.store, opportunityKey: row.opportunityKey, scored: row.score !== null })),
    ),
    histories,
    limit: OVERVIEW_CARDS,
    scopes,
  });
}
