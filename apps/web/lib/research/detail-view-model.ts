import type { Store } from "@analytic-dashboard/shared";
import { z } from "zod";

import { insightLabels, type ConfidenceBand } from "./view-model";

export const opportunityDecisionValues = ["shortlisted", "rejected", "prototype"] as const;
export type OpportunityDecisionStatus = (typeof opportunityDecisionValues)[number];

export const opportunityDecisionLabels: Record<OpportunityDecisionStatus, string> = {
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  prototype: "Start Prototype",
};

export const opportunityDecisionActionLabels: Record<OpportunityDecisionStatus, string> = {
  shortlisted: "Shortlist",
  rejected: "Reject",
  prototype: "Start Prototype",
};

export interface StoredOpportunityDetailInput {
  id: string;
  runId: string;
  store: Store;
  country: string;
  asOf: Date;
  formulaVersion: string;
  taxonomyVersion: string;
  windowDays: number;
  trackedGames: number;
  historyDays: number | null;
  freshness: string;
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

export interface StoredOpportunityDecisionInput {
  id: string;
  status: OpportunityDecisionStatus;
  note: string | null;
  owner: string | null;
  actor: string;
  createdAt: Date;
}

const dimensionSchema = z.object({ type: z.string(), slug: z.string(), displayName: z.string() });
const componentNameSchema = z.enum([
  "demandMomentum",
  "newEntrantPerformance",
  "competitionGap",
  "crossStoreConfirmation",
  "quality",
  "studioFit",
]);
const componentSchema = z.object({
  component: componentNameSchema,
  raw: z.number().nullable(),
  normalized: z.number().nullable(),
  weight: z.number(),
  contribution: z.number().nullable(),
});
const factsSchema = z.object({
  scoredMembers: z.number(),
  medianTrendScore: z.number().nullable(),
  newEntrants: z.number(),
  newEntrantsWithMomentum: z.number(),
  catalogueShare: z.number(),
  topThreeRatingShare: z.number().nullable(),
  medianRating: z.number().nullable(),
  otherStorePercentile: z.number().nullable(),
});
const storedDateSchema = z.union([z.date(), z.string().datetime().transform((value) => new Date(value))]);
const comparableSchema = z.object({
  id: z.string(),
  title: z.string(),
  trendScore: z.number().nullable(),
  rating: z.number().nullable(),
  ratingCount: z.number().nullable(),
  releaseDate: storedDateSchema.nullable(),
});
const linesSchema = z.array(z.string());
const confidenceBandSchema = z.enum(["high", "medium", "low"]);

export const opportunityComponentLabels: Record<z.infer<typeof componentNameSchema>, string> = {
  demandMomentum: "Demand momentum",
  newEntrantPerformance: "New-entrant performance",
  competitionGap: "Observed competition gap",
  crossStoreConfirmation: "Cross-store confirmation",
  quality: "Quality signal",
  studioFit: "Studio fit",
};

export interface OpportunityDetailView {
  id: string;
  title: string;
  store: Store;
  country: string;
  asOf: Date;
  formulaVersion: string;
  taxonomyVersion: string;
  windowDays: number;
  trackedGames: number;
  historyDays: number | null;
  freshness: string;
  memberCount: number;
  score: number | null;
  pendingReason: string | null;
  weightCoverage: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  insight: string | null;
  dimensions: Array<{ type: string; slug: string; displayName: string }>;
  components: Array<{
    key: z.infer<typeof componentNameSchema>;
    label: string;
    raw: number | null;
    normalized: number | null;
    weight: number;
    contribution: number | null;
  }>;
  facts: z.infer<typeof factsSchema>;
  comparables: Array<{
    id: string;
    title: string;
    trendScore: number | null;
    rating: number | null;
    ratingCount: number | null;
    releaseDate: Date | null;
  }>;
  positives: string[];
  risks: string[];
  caveats: string[];
  decisions: StoredOpportunityDecisionInput[];
  currentDecision: StoredOpportunityDecisionInput | null;
}

/** Parses stored JSON evidence before it reaches the analytical detail page. */
export function buildOpportunityDetailView(
  row: StoredOpportunityDetailInput,
  decisions: readonly StoredOpportunityDecisionInput[],
): OpportunityDetailView | null {
  const dimensions = z.array(dimensionSchema).min(1).safeParse(row.dimensions);
  const components = z.array(componentSchema).safeParse(row.components);
  const facts = factsSchema.safeParse(row.facts);
  const comparables = z.array(comparableSchema).safeParse(row.comparables);
  const positives = linesSchema.safeParse(row.positives);
  const risks = linesSchema.safeParse(row.counterSignals);
  const caveats = linesSchema.safeParse(row.caveats);
  const confidenceBand = confidenceBandSchema.safeParse(row.confidenceBand);
  if (
    !dimensions.success ||
    !components.success ||
    !facts.success ||
    !comparables.success ||
    !positives.success ||
    !risks.success ||
    !caveats.success ||
    !confidenceBand.success
  ) {
    return null;
  }

  return {
    id: row.id,
    title: dimensions.data.map((dimension) => dimension.displayName).join(" + "),
    store: row.store,
    country: row.country,
    asOf: row.asOf,
    formulaVersion: row.formulaVersion,
    taxonomyVersion: row.taxonomyVersion,
    windowDays: row.windowDays,
    trackedGames: row.trackedGames,
    historyDays: row.historyDays,
    freshness: row.freshness,
    memberCount: row.memberCount,
    score: row.score,
    pendingReason: row.reason,
    weightCoverage: row.weightCoverage,
    confidence: row.confidence,
    confidenceBand: confidenceBand.data,
    insight: row.insightType ? (insightLabels[row.insightType] ?? null) : null,
    dimensions: dimensions.data,
    components: components.data.map((component) => ({
      key: component.component,
      label: opportunityComponentLabels[component.component],
      raw: component.raw,
      normalized: component.normalized,
      weight: component.weight,
      contribution: component.contribution,
    })),
    facts: facts.data,
    comparables: comparables.data,
    positives: positives.data,
    risks: risks.data,
    caveats: caveats.data,
    decisions: [...decisions],
    currentDecision: decisions[0] ?? null,
  };
}
