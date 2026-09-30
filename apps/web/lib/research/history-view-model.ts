import {
  analyzeOpportunityHistory,
  type OpportunityHistoryAnalysis,
  type OpportunityHistoryPoint,
} from "@analytic-dashboard/analytics";
import { z } from "zod";

export interface StoredOpportunityHistoryInput {
  id: string;
  createdAt: Date;
  store: string;
  country: string;
  formulaVersion: string;
  taxonomyVersion: string;
  opportunityKey: string;
  asOf: Date;
  score: number | null;
  confidence: number;
  confidenceBand: string;
  insightType: string | null;
  comparables: unknown;
  counterSignals: unknown;
}

export interface OpportunityHistoryView extends OpportunityHistoryAnalysis {
  skipped: number;
  timeline: Array<OpportunityHistoryPoint & { delta: number | null }>;
}

const comparableSchema = z.array(z.object({ id: z.string() }));
const counterSignalsSchema = z.array(z.string());
const confidenceBandSchema = z.enum(["low", "medium", "high"]);

export function opportunityHistoryIdentity(input: {
  store: string;
  country: string;
  formulaVersion: string;
  taxonomyVersion: string;
  opportunityKey: string;
}): string {
  return [input.store, input.country, input.formulaVersion, input.taxonomyVersion, input.opportunityKey].join("|");
}

/** Stored JSON remains untrusted; malformed history points are skipped and counted. */
export function buildOpportunityHistoryView(
  rows: readonly StoredOpportunityHistoryInput[],
  currentId: string,
): OpportunityHistoryView | null {
  const ordered = [...rows].sort(
    (left, right) => left.asOf.getTime() - right.asOf.getTime() || left.createdAt.getTime() - right.createdAt.getTime(),
  );
  const currentIndex = ordered.findIndex((row) => row.id === currentId);
  if (currentIndex < 0) return null;
  const latestPerDay = new Map<string, StoredOpportunityHistoryInput>();
  for (const row of ordered.slice(0, currentIndex + 1)) {
    latestPerDay.set(row.asOf.toISOString().slice(0, 10), row);
  }

  const points: OpportunityHistoryPoint[] = [];
  let skipped = 0;
  for (const row of latestPerDay.values()) {
    const comparables = comparableSchema.safeParse(row.comparables);
    const counterSignals = counterSignalsSchema.safeParse(row.counterSignals);
    const confidenceBand = confidenceBandSchema.safeParse(row.confidenceBand);
    if (!comparables.success || !counterSignals.success || !confidenceBand.success) {
      skipped += 1;
      continue;
    }
    points.push({
      id: row.id,
      asOf: row.asOf,
      score: row.score,
      confidence: row.confidence,
      confidenceBand: confidenceBand.data,
      insightType: row.insightType,
      comparableIds: comparables.data.map((item) => item.id),
      counterSignals: counterSignals.data,
    });
  }

  const analysis = analyzeOpportunityHistory(points);
  if (analysis.points.at(-1)?.id !== currentId) return null;
  const timeline = analysis.points.map((point, index) => {
    const previous = analysis.points[index - 1];
    return {
      ...point,
      delta: point.score === null || !previous || previous.score === null ? null : point.score - previous.score,
    };
  });
  return { ...analysis, skipped, timeline };
}
