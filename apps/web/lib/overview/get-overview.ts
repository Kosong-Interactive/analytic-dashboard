import "server-only";

import { loadScoredSelection } from "../scoring/load-scored";
import type { OverviewFilters } from "./filters";
import { buildOverview, type OverviewData } from "./view-model";

export async function getOverview(
  filters: OverviewFilters,
  asOf: Date = new Date(),
): Promise<OverviewData> {
  return buildOverview(await loadScoredSelection(filters, asOf));
}
