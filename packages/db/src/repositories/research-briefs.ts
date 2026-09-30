import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { marketOpportunities, opportunityResearchBriefs, researchRuns } from "../schema/index";
import type { DatabaseExecutor } from "./executor";
import type { OpportunityDetailRow } from "./research";

export interface ResearchBriefRow {
  id: string;
  opportunityId: string;
  inputHash: string;
  promptVersion: string;
  model: string;
  brief: unknown;
  evidence: unknown;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
}

const detailSelection = {
  id: marketOpportunities.id,
  runId: marketOpportunities.runId,
  store: researchRuns.store,
  country: researchRuns.country,
  asOf: researchRuns.asOf,
  formulaVersion: researchRuns.formulaVersion,
  taxonomyVersion: researchRuns.taxonomyVersion,
  windowDays: researchRuns.windowDays,
  trackedGames: researchRuns.trackedGames,
  historyDays: researchRuns.historyDays,
  freshness: researchRuns.freshness,
  opportunityKey: marketOpportunities.opportunityKey,
  dimensions: marketOpportunities.dimensions,
  memberCount: marketOpportunities.memberCount,
  score: marketOpportunities.score,
  reason: marketOpportunities.reason,
  weightCoverage: marketOpportunities.weightCoverage,
  confidence: marketOpportunities.confidence,
  confidenceBand: marketOpportunities.confidenceBand,
  insightType: marketOpportunities.insightType,
  components: marketOpportunities.components,
  facts: marketOpportunities.facts,
  comparables: marketOpportunities.comparables,
  positives: marketOpportunities.positives,
  counterSignals: marketOpportunities.counterSignals,
  caveats: marketOpportunities.caveats,
};

const toNumber = (value: string | null) => (value === null ? null : Number(value));

/** Newest scored opportunities first; the worker filters already-generated input hashes. */
export async function loadResearchBriefCandidates(db: DatabaseExecutor, limit: number): Promise<OpportunityDetailRow[]> {
  const rows = await db
    .select(detailSelection)
    .from(marketOpportunities)
    .innerJoin(researchRuns, eq(researchRuns.id, marketOpportunities.runId))
    .where(and(eq(researchRuns.status, "succeeded"), isNotNull(marketOpportunities.score)))
    .orderBy(desc(researchRuns.asOf), desc(marketOpportunities.score), marketOpportunities.opportunityKey)
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    historyDays: toNumber(row.historyDays),
    score: toNumber(row.score),
    weightCoverage: Number(row.weightCoverage),
    confidence: Number(row.confidence),
  }));
}

export async function loadResearchBriefInputHashes(
  db: DatabaseExecutor,
  promptVersion: string,
  opportunityIds: readonly string[],
): Promise<Set<string>> {
  if (opportunityIds.length === 0) return new Set();
  const rows = await db
    .select({ opportunityId: opportunityResearchBriefs.opportunityId, inputHash: opportunityResearchBriefs.inputHash })
    .from(opportunityResearchBriefs)
    .where(and(
      eq(opportunityResearchBriefs.promptVersion, promptVersion),
      inArray(opportunityResearchBriefs.opportunityId, [...opportunityIds]),
    ));
  return new Set(rows.map((row) => `${row.opportunityId}:${row.inputHash}`));
}

export async function recordResearchBrief(
  db: DatabaseExecutor,
  input: Omit<ResearchBriefRow, "id" | "createdAt">,
): Promise<boolean> {
  const [created] = await db
    .insert(opportunityResearchBriefs)
    .values(input)
    .onConflictDoNothing()
    .returning({ id: opportunityResearchBriefs.id });
  return Boolean(created);
}

export async function loadLatestResearchBrief(
  db: DatabaseExecutor,
  opportunityId: string,
): Promise<ResearchBriefRow | null> {
  const [row] = await db
    .select()
    .from(opportunityResearchBriefs)
    .where(eq(opportunityResearchBriefs.opportunityId, opportunityId))
    .orderBy(desc(opportunityResearchBriefs.createdAt))
    .limit(1);
  return (row as ResearchBriefRow | undefined) ?? null;
}
