import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { marketOpportunities, researchRuns, type StoreId } from "../schema/index";
import type { DatabaseExecutor } from "./executor";

export interface ResearchRunInput {
  formulaVersion: string;
  taxonomyVersion: string;
  store: StoreId;
  country: string;
  windowDays: number;
  asOf: Date;
  inputHash: string;
  trackedGames: number;
  historyDays: number | null;
  freshness: string;
}

export interface OpportunityRowInput {
  opportunityKey: string;
  dimensions: unknown;
  memberCount: number;
  score: number | null;
  reason: string | null;
  weightCoverage: number;
  confidence: number;
  confidenceBand: string;
  insightType: string | null;
  components: unknown;
  facts: unknown;
  comparables: unknown;
  positives: unknown;
  counterSignals: unknown;
  caveats: unknown;
}

const INSERT_CHUNK = 200;

/**
 * Stores one run and its opportunities in one transaction. A run whose inputs match an existing
 * run (same versions, storefront, and input hash) is skipped, so a rerun is a no-op.
 */
export async function recordResearchRun(
  db: DatabaseExecutor,
  input: { run: ResearchRunInput; opportunities: readonly OpportunityRowInput[] },
): Promise<{ created: boolean; runId: string | null }> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(researchRuns)
      .values({
        ...input.run,
        status: "succeeded",
        historyDays: input.run.historyDays === null ? null : input.run.historyDays.toFixed(2),
        cohortsEvaluated: input.opportunities.length,
        opportunitiesScored: input.opportunities.filter((o) => o.score !== null).length,
      })
      .onConflictDoNothing()
      .returning({ id: researchRuns.id });
    if (!run) return { created: false, runId: null };

    for (let start = 0; start < input.opportunities.length; start += INSERT_CHUNK) {
      await tx.insert(marketOpportunities).values(
        input.opportunities.slice(start, start + INSERT_CHUNK).map((o) => ({
          ...o,
          runId: run.id,
          score: o.score === null ? null : o.score.toFixed(2),
          weightCoverage: o.weightCoverage.toFixed(3),
          confidence: o.confidence.toFixed(3),
        })),
      );
    }
    return { created: true, runId: run.id };
  });
}

/** Records a run that could not be calculated, so the dashboard can say research is failing. */
export async function recordFailedResearchRun(
  db: DatabaseExecutor,
  input: Omit<ResearchRunInput, "inputHash"> & { errorSample: string },
): Promise<void> {
  await db.insert(researchRuns).values({
    ...input,
    inputHash: `failed:${input.asOf.toISOString()}`,
    status: "failed",
    historyDays: input.historyDays === null ? null : input.historyDays.toFixed(2),
    cohortsEvaluated: 0,
    opportunitiesScored: 0,
  }).onConflictDoNothing();
}

export interface ResearchRunSummary {
  id: string;
  store: StoreId;
  country: string;
  status: "succeeded" | "failed";
  asOf: Date;
  formulaVersion: string;
  trackedGames: number;
  cohortsEvaluated: number;
  opportunitiesScored: number;
  historyDays: number | null;
  freshness: string;
  errorSample: string | null;
}

export interface StoredOpportunity {
  id: string;
  runId: string;
  store: StoreId;
  country: string;
  asOf: Date;
  opportunityKey: string;
  dimensions: unknown;
  memberCount: number;
  score: number;
  weightCoverage: number;
  confidence: number;
  confidenceBand: string;
  insightType: string | null;
  components: unknown;
  facts: unknown;
  comparables: unknown;
  positives: unknown;
  counterSignals: unknown;
  caveats: unknown;
}

const toNumber = (value: string | null) => (value === null ? null : Number(value));

/**
 * The latest run per selected storefront (failed runs included, so failure is visible) and the
 * best scored opportunities of the latest successful runs. Two queries regardless of storefronts.
 */
export async function loadLatestOpportunities(
  db: DatabaseExecutor,
  query: { stores: readonly StoreId[]; country: string; formulaVersion: string; limit: number },
): Promise<{ runs: ResearchRunSummary[]; opportunities: StoredOpportunity[] }> {
  if (query.stores.length === 0) return { runs: [], opportunities: [] };

  const rows = await db
    .selectDistinctOn([researchRuns.store, researchRuns.status], {
      id: researchRuns.id,
      store: researchRuns.store,
      country: researchRuns.country,
      status: researchRuns.status,
      asOf: researchRuns.asOf,
      formulaVersion: researchRuns.formulaVersion,
      trackedGames: researchRuns.trackedGames,
      cohortsEvaluated: researchRuns.cohortsEvaluated,
      opportunitiesScored: researchRuns.opportunitiesScored,
      historyDays: researchRuns.historyDays,
      freshness: researchRuns.freshness,
      errorSample: researchRuns.errorSample,
    })
    .from(researchRuns)
    .where(
      and(
        inArray(researchRuns.store, [...query.stores]),
        eq(researchRuns.country, query.country),
        eq(researchRuns.formulaVersion, query.formulaVersion),
      ),
    )
    .orderBy(researchRuns.store, researchRuns.status, desc(researchRuns.asOf), desc(researchRuns.createdAt));

  // Per store, the newest run overall, plus the newest successful one whose results are shown.
  const runs: ResearchRunSummary[] = [];
  const successful: ResearchRunSummary[] = [];
  for (const store of query.stores) {
    const ofStore = rows.filter((row) => row.store === store).map((row) => ({ ...row, historyDays: toNumber(row.historyDays) }));
    const newest = [...ofStore].sort((a, b) => b.asOf.getTime() - a.asOf.getTime())[0];
    if (newest) runs.push(newest);
    const ok = ofStore.find((row) => row.status === "succeeded");
    if (ok) successful.push(ok);
  }
  if (successful.length === 0) return { runs, opportunities: [] };

  const runById = new Map(successful.map((run) => [run.id, run]));
  const opportunityRows = await db
    .select()
    .from(marketOpportunities)
    .where(and(inArray(marketOpportunities.runId, [...runById.keys()]), isNotNull(marketOpportunities.score)))
    .orderBy(desc(marketOpportunities.score), desc(marketOpportunities.confidence), marketOpportunities.opportunityKey)
    .limit(query.limit);

  return {
    runs,
    opportunities: opportunityRows.flatMap((row) => {
      const run = runById.get(row.runId);
      if (!run) return [];
      return {
        id: row.id,
        runId: row.runId,
        store: run.store,
        country: run.country,
        asOf: run.asOf,
        opportunityKey: row.opportunityKey,
        dimensions: row.dimensions,
        memberCount: row.memberCount,
        score: Number(row.score),
        weightCoverage: Number(row.weightCoverage),
        confidence: Number(row.confidence),
        confidenceBand: row.confidenceBand,
        insightType: row.insightType,
        components: row.components,
        facts: row.facts,
        comparables: row.comparables,
        positives: row.positives,
        counterSignals: row.counterSignals,
        caveats: row.caveats,
      };
    }),
  };
}
