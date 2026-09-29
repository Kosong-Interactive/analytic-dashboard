import { and, eq } from "drizzle-orm";

import { collectorRuns } from "../schema/index";
import type { DatabaseExecutor } from "./executor";

export type CollectorRunSource = (typeof collectorRuns.$inferInsert)["source"];
export type CollectorRunFinalStatus = Exclude<
  (typeof collectorRuns.$inferInsert)["status"],
  "running" | undefined
>;

export interface StartCollectorRunInput {
  source: CollectorRunSource;
  jobType: string;
  country: string;
  locale: string;
  startedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface FinishCollectorRunInput {
  status: CollectorRunFinalStatus;
  finishedAt: Date;
  discoveredCount: number;
  changedCount: number;
  retryCount: number;
  errorCount: number;
  errorSample: string | null;
  metadata?: Record<string, unknown>;
}

export async function startCollectorRun(
  db: DatabaseExecutor,
  input: StartCollectorRunInput,
): Promise<string> {
  const [run] = await db
    .insert(collectorRuns)
    .values({
      source: input.source,
      jobType: input.jobType,
      country: input.country,
      locale: input.locale,
      startedAt: input.startedAt,
      metadata: input.metadata ?? {},
    })
    .returning({ id: collectorRuns.id });

  if (!run) {
    throw new Error("Collector run was not created");
  }
  return run.id;
}

/** Only a run that is still `running` can be finished, so a repeated call is a no-op. */
export async function finishCollectorRun(
  db: DatabaseExecutor,
  runId: string,
  input: FinishCollectorRunInput,
): Promise<boolean> {
  const updated = await db
    .update(collectorRuns)
    .set({
      status: input.status,
      finishedAt: input.finishedAt,
      discoveredCount: input.discoveredCount,
      changedCount: input.changedCount,
      retryCount: input.retryCount,
      errorCount: input.errorCount,
      errorSample: input.errorSample,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    })
    .where(and(eq(collectorRuns.id, runId), eq(collectorRuns.status, "running")))
    .returning({ id: collectorRuns.id });

  return updated.length === 1;
}
