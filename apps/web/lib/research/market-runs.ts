import type { Store } from "@analytic-dashboard/shared";

import type { ResearchRunInput } from "./view-model";

interface StorefrontRun extends ResearchRunInput {
  country: string;
}

/**
 * Collapses the per-storefront runs of a market into one run per platform for the panel state.
 * Cohort counts are distinct cohorts across the market, never a sum over storefronts, a run counts
 * as failed only when every storefront's newest run failed, and the history is the shortest one.
 */
export function summarizeMarketRuns(
  runs: readonly StorefrontRun[],
  cohorts: ReadonlyArray<{ store: Store; opportunityKey: string; scored: boolean }>,
): ResearchRunInput[] {
  const stores = [...new Set(runs.map((run) => run.store))];
  return stores.map((store) => {
    const ofStore = runs.filter((run) => run.store === store);
    const succeeded = ofStore.filter((run) => run.status === "succeeded");
    const histories = succeeded.flatMap((run) => (run.historyDays === null ? [] : [run.historyDays]));
    const distinct = new Map<string, boolean>();
    for (const cohort of cohorts.filter((item) => item.store === store)) {
      distinct.set(cohort.opportunityKey, (distinct.get(cohort.opportunityKey) ?? false) || cohort.scored);
    }
    return {
      store,
      status: succeeded.length > 0 ? "succeeded" : "failed",
      asOf: new Date(Math.max(...ofStore.map((run) => run.asOf.getTime()))),
      cohortsEvaluated: distinct.size,
      opportunitiesScored: [...distinct.values()].filter(Boolean).length,
      historyDays: histories.length === 0 ? null : Math.min(...histories),
    };
  });
}
