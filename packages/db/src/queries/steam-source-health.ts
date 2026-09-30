import { count, desc, inArray } from "drizzle-orm";

import { steamApps, steamCollectorRuns } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export interface SteamSourceHealthRow {
  /** Status of the most recent run, or null when Steam has never run. */
  latestStatus: "running" | "succeeded" | "partial" | "failed" | "cancelled" | null;
  latestErrorCount: number;
  /** Finish time of the newest run that stored data (succeeded or partial). */
  lastCollectedAt: Date | null;
  trackedGames: number;
}

/** Freshness of Steam Global collection. Error text is not returned; the dashboard shows counts only. */
export async function loadSteamSourceHealth(db: DatabaseExecutor): Promise<SteamSourceHealthRow> {
  const [latest, collected, tracked] = await Promise.all([
    db
      .select({ status: steamCollectorRuns.status, errorCount: steamCollectorRuns.errorCount })
      .from(steamCollectorRuns)
      .orderBy(desc(steamCollectorRuns.startedAt))
      .limit(1),
    db
      .select({ finishedAt: steamCollectorRuns.finishedAt, startedAt: steamCollectorRuns.startedAt })
      .from(steamCollectorRuns)
      .where(inArray(steamCollectorRuns.status, ["succeeded", "partial"]))
      .orderBy(desc(steamCollectorRuns.startedAt))
      .limit(1),
    db.select({ value: count() }).from(steamApps),
  ]);

  return {
    latestStatus: latest[0]?.status ?? null,
    latestErrorCount: latest[0]?.errorCount ?? 0,
    lastCollectedAt: collected[0] ? (collected[0].finishedAt ?? collected[0].startedAt) : null,
    trackedGames: tracked[0]?.value ?? 0,
  };
}
