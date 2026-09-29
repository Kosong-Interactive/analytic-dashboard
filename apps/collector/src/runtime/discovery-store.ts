import type { NormalizedStoreApp } from "@analytic-dashboard/collectors";
import {
  finishCollectorRun,
  persistChartEntries,
  persistStoreApps,
  startCollectorRun,
  storeListingKey,
  type Database,
  type FinishCollectorRunInput,
  type StartCollectorRunInput,
} from "@analytic-dashboard/db";

export interface ChartBatch {
  chartType: string;
  category: string;
  entries: Array<{ rank: number; app: NormalizedStoreApp }>;
}

export interface DiscoveredBatch {
  apps: NormalizedStoreApp[];
  chart?: ChartBatch;
}

export interface PersistSummary {
  processed: number;
  changed: number;
  chartEntriesWritten: number;
}

/** Everything a discovery job needs from storage, so the job logic is testable without a database. */
export interface DiscoveryStore {
  startRun(input: StartCollectorRunInput): Promise<string | null>;
  persistBatch(batch: DiscoveredBatch, country: string): Promise<PersistSummary>;
  finishRun(runId: string | null, input: FinishCollectorRunInput): Promise<void>;
}

export function createDatabaseDiscoveryStore(db: Database): DiscoveryStore {
  return {
    startRun: (input) => startCollectorRun(db, input),

    async persistBatch(batch, country) {
      return db.transaction(async (tx) => {
        const stored = await persistStoreApps(tx, batch.apps);
        let chartEntriesWritten = 0;

        if (batch.chart && batch.chart.entries.length > 0) {
          const [first] = batch.chart.entries;
          const entries = batch.chart.entries.map((entry) => {
            const storeAppId = stored.storeAppIds.get(
              storeListingKey(entry.app),
            );
            if (!storeAppId) {
              throw new Error("Chart entry has no persisted store listing");
            }
            return { storeAppId, rank: entry.rank };
          });
          chartEntriesWritten = await persistChartEntries(tx, {
            chartType: batch.chart.chartType,
            category: batch.chart.category,
            country,
            capturedAt: new Date(first?.app.snapshot.capturedAt ?? Date.now()),
            entries,
          });
        }

        return {
          processed: stored.processed,
          changed:
            stored.newStoreApps +
            stored.metadataUpdated +
            stored.snapshotsWritten,
          chartEntriesWritten,
        };
      });
    },

    async finishRun(runId, input) {
      if (runId) {
        await finishCollectorRun(db, runId, input);
      }
    },
  };
}

/** Collects and counts without writing, for checking a discovery plan against the live sources. */
export function createDryRunDiscoveryStore(): DiscoveryStore {
  return {
    startRun: async () => null,
    persistBatch: async (batch) => ({
      processed: batch.apps.length,
      changed: 0,
      chartEntriesWritten: 0,
    }),
    finishRun: async () => undefined,
  };
}
