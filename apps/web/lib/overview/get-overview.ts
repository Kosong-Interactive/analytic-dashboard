import "server-only";

import { scoreTrending } from "@analytic-dashboard/analytics";
import { loadSourceHealth, loadTrendCandidates } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import type { OverviewFilters } from "./filters";
import { buildOverview, type OverviewData } from "./view-model";

const WINDOW_DAYS = 7;
const RANK_CHART = "TOP_FREE";

/** Reads stored observations only; it never triggers collection. */
export async function getOverview(
  filters: OverviewFilters,
  asOf: Date = new Date(),
): Promise<OverviewData> {
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
  const scores = scoreTrending(candidates, { asOf, rankChartType: RANK_CHART });

  return buildOverview({
    candidates,
    scores,
    health: health.filter(
      (row) => filters.platform === "all" || row.source === filters.platform,
    ),
    asOf,
  });
}
