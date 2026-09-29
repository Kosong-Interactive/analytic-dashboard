import { and, desc, inArray } from "drizzle-orm";

import { collectorRuns, type StoreId } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export interface SourceHealthRow {
  source: StoreId;
  country: string;
  jobType: string;
  /** Status of the most recent run, whatever its outcome. */
  latestStatus: "running" | "succeeded" | "partial" | "failed" | "cancelled";
  latestStartedAt: Date;
  latestErrorCount: number;
  /** Finish time of the newest run that produced data (succeeded or partial), if any. */
  lastCollectedAt: Date | null;
  lastCollectedDiscoveredCount: number | null;
}

/**
 * Freshness per source, country, and job type. Error text is deliberately not returned:
 * it can carry provider details and the dashboard only needs the outcome and counts.
 */
export async function loadSourceHealth(
  db: DatabaseExecutor,
  countries: readonly string[],
): Promise<SourceHealthRow[]> {
  if (countries.length === 0) return [];

  const scope = inArray(collectorRuns.country, [...countries]);
  const [latest, collected] = await Promise.all([
    db
      .selectDistinctOn([
        collectorRuns.source,
        collectorRuns.country,
        collectorRuns.jobType,
      ])
      .from(collectorRuns)
      .where(scope)
      .orderBy(
        collectorRuns.source,
        collectorRuns.country,
        collectorRuns.jobType,
        desc(collectorRuns.startedAt),
      ),
    db
      .selectDistinctOn([
        collectorRuns.source,
        collectorRuns.country,
        collectorRuns.jobType,
      ])
      .from(collectorRuns)
      .where(
        and(scope, inArray(collectorRuns.status, ["succeeded", "partial"])),
      )
      .orderBy(
        collectorRuns.source,
        collectorRuns.country,
        collectorRuns.jobType,
        desc(collectorRuns.startedAt),
      ),
  ]);

  const key = (row: { source: string; country: string; jobType: string }) =>
    `${row.source}:${row.country}:${row.jobType}`;
  const collectedByKey = new Map(collected.map((row) => [key(row), row]));

  return latest.map((row) => {
    const good = collectedByKey.get(key(row));
    return {
      source: row.source,
      country: row.country,
      jobType: row.jobType,
      latestStatus: row.status,
      latestStartedAt: row.startedAt,
      latestErrorCount: row.errorCount,
      lastCollectedAt: good ? (good.finishedAt ?? good.startedAt) : null,
      lastCollectedDiscoveredCount: good ? good.discoveredCount : null,
    };
  });
}
