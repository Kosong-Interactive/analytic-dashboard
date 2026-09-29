import "server-only";

import { scoreTrending, type TrendingScore } from "@analytic-dashboard/analytics";
import {
  loadSourceHealth,
  loadTrendCandidates,
  type SourceHealthRow,
  type TrendCandidateRow,
} from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import type { OverviewFilters } from "../overview/filters";

const WINDOW_DAYS = 7;
const RANK_CHART = "TOP_FREE";

export interface ScoredSelection {
  asOf: Date;
  candidates: TrendCandidateRow[];
  scores: TrendingScore[];
  health: SourceHealthRow[];
}

/** Reads stored observations only; it never triggers collection. */
export async function loadScoredSelection(
  filters: OverviewFilters,
  asOf: Date = new Date(),
): Promise<ScoredSelection> {
  const db = getDatabase();
  const stores =
    filters.platform === "all"
      ? (["google_play", "app_store"] as const)
      : ([filters.platform] as const);

  const [perStore, health] = await Promise.all([
    Promise.all(
      stores.map((store) =>
        loadTrendCandidates(db, {
          store,
          country: filters.country,
          asOf,
          windowDays: WINDOW_DAYS,
          chartType: RANK_CHART,
        }),
      ),
    ),
    loadSourceHealth(db, [filters.country]),
  ]);

  const candidates = perStore.flat();
  return {
    asOf,
    candidates,
    scores: scoreTrending(candidates, { asOf, rankChartType: RANK_CHART }),
    health: health.filter(
      (row) => filters.platform === "all" || row.source === filters.platform,
    ),
  };
}
