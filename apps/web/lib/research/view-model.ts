import type { Store } from "@analytic-dashboard/shared";
import { z } from "zod";

/** Structural subsets of the database rows, so this module is testable without a database. */
export interface StoredOpportunityInput {
  id: string;
  store: Store;
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
  facts: unknown;
  comparables: unknown;
  positives: unknown;
  counterSignals: unknown;
  caveats: unknown;
}

export interface StoredOpportunityPreviewInput extends Omit<StoredOpportunityInput, "score"> {
  score: null;
  reason: string | null;
}

export interface ResearchRunInput {
  store: Store;
  status: "succeeded" | "failed";
  asOf: Date;
  cohortsEvaluated: number;
  opportunitiesScored: number;
  historyDays: number | null;
}

// Stored jsonb is written by the research job, but it is still parsed rather than trusted.
const dimensionsSchema = z.array(z.object({ type: z.string(), slug: z.string(), displayName: z.string() })).min(1);
const factsSchema = z.object({
  catalogueShare: z.number(),
  newEntrants: z.number(),
  newEntrantsWithMomentum: z.number(),
});
const comparablesSchema = z.array(
  z.object({ id: z.string(), title: z.string(), trendScore: z.number().nullable(), ratingCount: z.number().nullable() }),
);
const linesSchema = z.array(z.string());

export const insightLabels: Record<string, string> = {
  build_opportunity: "Build Opportunity",
  emerging_pattern: "Emerging Pattern",
  proven_market: "Proven Market",
  watch_carefully: "Watch Carefully",
};

export type ConfidenceBand = "high" | "medium" | "low";

export interface OpportunityCard {
  id: string;
  title: string;
  store: Store;
  country: string;
  insight: string | null;
  score: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** A high score with low confidence is an early signal, not a strong recommendation. */
  earlySignal: boolean;
  weightCoverage: number;
  memberCount: number;
  catalogueShare: number;
  whyNow: string[];
  risks: string[];
  caveats: string[];
  comparables: Array<{ id: string; title: string }>;
  /** Games explorer link when every dimension is filterable there; `null` otherwise. */
  browseHref: string | null;
  asOf: Date;
}

export interface OpportunityPreview extends Omit<OpportunityCard, "score" | "insight" | "earlySignal"> {
  reason: string | null;
}

export type ResearchState =
  | { kind: "ready" }
  | { kind: "no_runs" }
  | { kind: "awaiting_scores"; cohorts: number; historyDays: number | null }
  | { kind: "failed" };

export interface OpportunitiesView {
  cards: OpportunityCard[];
  /** A real evaluated cohort without enough demand history for a score; never a recommendation. */
  preview: OpportunityPreview | null;
  state: ResearchState;
  /** Newest run per store, for "updated" freshness; failed runs are flagged. */
  runs: Array<{ store: Store; asOf: Date; failed: boolean }>;
  /** Cards that could not be parsed are left out and counted, never shown half-empty. */
  skipped: number;
}

const bandSchema = z.enum(["high", "medium", "low"]);

function browseHref(dimensions: z.infer<typeof dimensionsSchema>, country: string, store: Store): string | null {
  const query = new URLSearchParams();
  for (const dimension of dimensions) {
    if (dimension.type === "genre") query.set("genre", dimension.slug);
    else if (dimension.type === "core_mechanic") query.set("mechanic", dimension.slug);
    else return null;
  }
  if (country !== "id") query.set("country", country);
  query.set("platform", store);
  return `/games?${query.toString()}`;
}

function toCard(row: StoredOpportunityInput): OpportunityCard | null {
  const dimensions = dimensionsSchema.safeParse(row.dimensions);
  const facts = factsSchema.safeParse(row.facts);
  const comparables = comparablesSchema.safeParse(row.comparables);
  const positives = linesSchema.safeParse(row.positives);
  const counter = linesSchema.safeParse(row.counterSignals);
  const caveats = linesSchema.safeParse(row.caveats);
  const band = bandSchema.safeParse(row.confidenceBand);
  if (!dimensions.success || !facts.success || !comparables.success || !positives.success || !counter.success || !caveats.success || !band.success) {
    return null;
  }
  return {
    id: row.id,
    title: dimensions.data.map((d) => d.displayName).join(" + "),
    store: row.store,
    country: row.country,
    insight: row.insightType ? (insightLabels[row.insightType] ?? null) : null,
    score: row.score,
    confidence: row.confidence,
    confidenceBand: band.data,
    earlySignal: band.data === "low",
    weightCoverage: row.weightCoverage,
    memberCount: row.memberCount,
    catalogueShare: facts.data.catalogueShare,
    whyNow: positives.data.slice(0, 2),
    risks: counter.data.slice(0, 2),
    caveats: caveats.data,
    comparables: comparables.data.slice(0, 3).map(({ id, title }) => ({ id, title })),
    browseHref: browseHref(dimensions.data, row.country, row.store),
    asOf: row.asOf,
  };
}

function toPreview(row: StoredOpportunityPreviewInput): OpportunityPreview | null {
  const parsed = toCard({ ...row, score: 0 });
  if (!parsed) return null;
  return {
    id: parsed.id,
    title: parsed.title,
    store: parsed.store,
    country: parsed.country,
    confidence: parsed.confidence,
    confidenceBand: parsed.confidenceBand,
    weightCoverage: parsed.weightCoverage,
    memberCount: parsed.memberCount,
    catalogueShare: parsed.catalogueShare,
    whyNow: parsed.whyNow,
    risks: parsed.risks,
    caveats: parsed.caveats,
    comparables: parsed.comparables,
    browseHref: parsed.browseHref,
    asOf: parsed.asOf,
    reason: row.reason,
  };
}

/** Cards for the Overview, plus a state that explains an empty panel instead of hiding it. */
export function buildOpportunitiesView(input: {
  opportunities: readonly StoredOpportunityInput[];
  preview?: StoredOpportunityPreviewInput | null;
  runs: readonly ResearchRunInput[];
  limit: number;
}): OpportunitiesView {
  const parsed = input.opportunities.map(toCard);
  const cards = parsed.filter((card): card is OpportunityCard => card !== null).slice(0, input.limit);
  const preview = cards.length === 0 && input.preview ? toPreview(input.preview) : null;
  const runs = input.runs.map((run) => ({ store: run.store, asOf: run.asOf, failed: run.status === "failed" }));

  let state: ResearchState;
  if (cards.length > 0) state = { kind: "ready" };
  else if (input.runs.length === 0) state = { kind: "no_runs" };
  else if (input.runs.every((run) => run.status === "failed")) state = { kind: "failed" };
  else {
    const succeeded = input.runs.filter((run) => run.status === "succeeded");
    const histories = succeeded.flatMap((run) => (run.historyDays === null ? [] : [run.historyDays]));
    state = {
      kind: "awaiting_scores",
      cohorts: succeeded.reduce((sum, run) => sum + run.cohortsEvaluated - run.opportunitiesScored, 0),
      historyDays: histories.length === 0 ? null : Math.min(...histories),
    };
  }

  return { cards, preview, state, runs, skipped: parsed.length - parsed.filter(Boolean).length };
}
