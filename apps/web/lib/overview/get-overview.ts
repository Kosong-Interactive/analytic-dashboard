import "server-only";

import { loadSteamSourceHealth } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { loadScoredSelection } from "../scoring/load-scored";
import type { OverviewFilters } from "./filters";
import { buildOverview, toSteamSourceStatus, type OverviewData, type SteamSourceStatus } from "./view-model";

export type OverviewWithSources = OverviewData & { steam: SteamSourceStatus };

export async function getOverview(
  filters: OverviewFilters,
  asOf: Date = new Date(),
): Promise<OverviewWithSources> {
  const [selection, steam] = await Promise.all([
    loadScoredSelection(filters, asOf),
    loadSteamSourceHealth(getDatabase()),
  ]);
  return { ...buildOverview(selection), steam: toSteamSourceStatus(steam, asOf) };
}
