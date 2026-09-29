import type { Store } from "@analytic-dashboard/shared";

import { toSourceStatus, type OverviewSourceHealth, type SourceState } from "../overview/view-model";

export interface StoreFreshness {
  store: Store;
  /** Most recent successful collection across that store's jobs, or `null` if never collected. */
  lastCollectedAt: Date | null;
  /** The worst state among the store's jobs, so one failing job is never hidden by a fresh one. */
  state: SourceState;
}

const severity: Record<SourceState, number> = { fresh: 0, stale: 1, failed: 2, never: 3 };

/** One freshness line per selected store, from the collector-run health rows. */
export function summarizeFreshness(
  health: readonly OverviewSourceHealth[],
  stores: ReadonlyArray<Store>,
  asOf: Date,
): StoreFreshness[] {
  return stores.map((store) => {
    const statuses = health.filter((row) => row.source === store).map((row) => toSourceStatus(row, asOf));
    if (statuses.length === 0) return { store, lastCollectedAt: null, state: "never" };
    const collected = statuses.flatMap((status) => (status.lastCollectedAt ? [status.lastCollectedAt.getTime()] : []));
    return {
      store,
      lastCollectedAt: collected.length === 0 ? null : new Date(Math.max(...collected)),
      state: statuses.reduce<SourceState>(
        (worst, status) => (severity[status.state] > severity[worst] ? status.state : worst),
        "fresh",
      ),
    };
  });
}
