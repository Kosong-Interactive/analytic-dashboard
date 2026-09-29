import "server-only";

import { OPPORTUNITY_SCORE_V1 } from "@analytic-dashboard/analytics";
import { loadLatestOpportunities } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import type { OverviewFilters } from "../overview/filters";
import { buildOpportunitiesView, type OpportunitiesView } from "./view-model";

const OVERVIEW_CARDS = 5;

/** Reads stored research results only; research itself runs as a daily job. */
export async function getOpportunities(filters: OverviewFilters): Promise<OpportunitiesView> {
  const stores = filters.platform === "all" ? (["google_play", "app_store"] as const) : ([filters.platform] as const);
  const { runs, opportunities } = await loadLatestOpportunities(getDatabase(), {
    stores,
    country: filters.country,
    formulaVersion: OPPORTUNITY_SCORE_V1.version,
    // A few extra rows so a card that fails to parse does not leave a gap.
    limit: OVERVIEW_CARDS + 3,
  });
  return buildOpportunitiesView({ opportunities, runs, limit: OVERVIEW_CARDS });
}
