import "server-only";

import { OPPORTUNITY_SCORE_V1 } from "@analytic-dashboard/analytics";
import { loadLatestOpportunities, loadOpportunityHistories } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import type { OverviewFilters } from "../overview/filters";
import { buildOpportunitiesView, type OpportunitiesView } from "./view-model";

const OVERVIEW_CARDS = 5;

/** Reads stored research results only; research itself runs as a daily job. */
export async function getOpportunities(filters: OverviewFilters): Promise<OpportunitiesView> {
  const stores = filters.platform === "all" ? (["google_play", "app_store"] as const) : ([filters.platform] as const);
  const db = getDatabase();
  const { runs, opportunities, preview } = await loadLatestOpportunities(db, {
    stores,
    country: filters.country,
    formulaVersion: OPPORTUNITY_SCORE_V1.version,
    // A few extra rows so a card that fails to parse does not leave a gap.
    limit: OVERVIEW_CARDS + 3,
  });
  const selected = opportunities.slice(0, OVERVIEW_CARDS + 3);
  const histories = await loadOpportunityHistories(db, selected.map((opportunity) => ({
    store: opportunity.store,
    country: opportunity.country,
    formulaVersion: opportunity.formulaVersion,
    taxonomyVersion: opportunity.taxonomyVersion,
    opportunityKey: opportunity.opportunityKey,
    asOf: opportunity.asOf,
  })));
  return buildOpportunitiesView({ opportunities, preview, runs, histories, limit: OVERVIEW_CARDS });
}
