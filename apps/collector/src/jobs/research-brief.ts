import { scoreStudioFit } from "@analytic-dashboard/analytics";
import {
  AllModelsExhaustedError,
  GeminiFatalError,
  RESEARCH_BRIEF_PROMPT_VERSION,
  researchBriefInputHash,
  researchBriefInputSchema,
  type ResearchBrief,
  type ResearchBriefInput,
} from "@analytic-dashboard/classifier";
import type { OpportunityDetailRow, StudioProfileRow } from "@analytic-dashboard/db";
import { z } from "zod";

const dimensionSchema = z.object({ type: z.string(), slug: z.string(), displayName: z.string() });
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
const comparableSchema = z.object({
  title: z.string(),
  trendScore: z.number().nullable(),
  rating: z.number().nullable(),
  ratingCount: z.number().nullable(),
});
const profileSchema = z.object({
  version: z.number().int().positive(),
  teamSize: z.number().int().positive(),
  targetDurationMonths: z.number().int().positive(),
  supportedPlatforms: z.array(z.string()),
  preferredLabels: z.array(z.string()),
  avoidedLabels: z.array(z.string()),
  capability2d: z.enum(["none", "basic", "strong"]),
  capability3d: z.enum(["none", "basic", "strong"]),
  onlineBackendCapability: z.enum(["none", "basic", "strong"]),
  contentProductionCapability: z.enum(["none", "basic", "strong"]),
  liveOpsCapability: z.enum(["none", "basic", "strong"]),
});

type Evidence = ResearchBriefInput["evidence"][number];
const percent = (value: number) => `${Math.round(value * 100)}%`;
const number = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

/** Converts immutable stored calculation fields into the only evidence the model is allowed to see. */
export function buildResearchBriefInput(
  row: OpportunityDetailRow,
  rawProfile: StudioProfileRow | null,
): ResearchBriefInput | null {
  if (row.score === null) return null;
  const dimensions = z.array(dimensionSchema).min(1).safeParse(row.dimensions);
  const facts = factsSchema.safeParse(row.facts);
  const comparables = z.array(comparableSchema).safeParse(row.comparables);
  const positives = z.array(z.string()).safeParse(row.positives);
  const risks = z.array(z.string()).safeParse(row.counterSignals);
  const caveats = z.array(z.string()).safeParse(row.caveats);
  if (!dimensions.success || !facts.success || !comparables.success || !positives.success || !risks.success || !caveats.success) {
    return null;
  }

  const evidence: Evidence[] = [
    { id: "market.score", label: "Market Opportunity", value: `${Math.round(row.score)} of 100 (${row.formulaVersion})` },
    { id: "research.confidence", label: "Research Confidence", value: `${percent(row.confidence)} (${row.confidenceBand})` },
    { id: "market.cohort", label: "Observed cohort", value: `${row.memberCount} games from ${row.trackedGames} tracked games` },
    { id: "market.coverage", label: "Score coverage", value: `${percent(row.weightCoverage)} measurable weight` },
    { id: "market.history", label: "History", value: row.historyDays === null ? "History unavailable" : `${row.historyDays.toFixed(1)} days of a ${row.windowDays}-day window` },
    { id: "market.freshness", label: "Source freshness", value: row.freshness },
    { id: "fact.scored_members", label: "Games with Trend Score", value: `${facts.data.scoredMembers} of ${row.memberCount}` },
    { id: "fact.new_entrants", label: "Recent releases", value: `${facts.data.newEntrants}; ${facts.data.newEntrantsWithMomentum} with momentum` },
    { id: "fact.catalogue_share", label: "Sampled catalogue share", value: percent(facts.data.catalogueShare) },
  ];
  if (facts.data.medianTrendScore !== null) evidence.push({ id: "fact.median_trend", label: "Median Trend Score", value: number(facts.data.medianTrendScore) });
  if (facts.data.topThreeRatingShare !== null) evidence.push({ id: "fact.top_three_share", label: "Top-three rating share", value: percent(facts.data.topThreeRatingShare) });
  if (facts.data.medianRating !== null) evidence.push({ id: "fact.median_rating", label: "Median rating", value: number(facts.data.medianRating) });
  if (facts.data.otherStorePercentile !== null) evidence.push({ id: "fact.other_store", label: "Other-store demand percentile", value: percent(facts.data.otherStorePercentile) });
  positives.data.slice(0, 8).forEach((value, index) => evidence.push({ id: `positive.${index + 1}`, label: "Positive signal", value: value.slice(0, 400) }));
  risks.data.slice(0, 8).forEach((value, index) => evidence.push({ id: `risk.${index + 1}`, label: "Counter-signal", value: value.slice(0, 400) }));
  caveats.data.slice(0, 8).forEach((value, index) => evidence.push({ id: `caveat.${index + 1}`, label: "Coverage caveat", value: value.slice(0, 400) }));
  comparables.data.slice(0, 5).forEach((game, index) => {
    evidence.push({
      id: `comparable.${index + 1}`,
      label: "Comparable game",
      value: `${game.title}; Trend Score ${game.trendScore === null ? "missing" : number(game.trendScore)}; rating ${game.rating === null ? "missing" : number(game.rating)}; rating count ${game.ratingCount === null ? "missing" : Math.round(game.ratingCount)}`,
    });
  });

  const profile = profileSchema.safeParse(rawProfile);
  if (profile.success) {
    const fit = scoreStudioFit(profile.data, { store: row.store, dimensions: dimensions.data, marketScore: row.score });
    evidence.push({
      id: "studio.profile",
      label: "Studio profile context",
      value: `Version ${profile.data.version}; ${profile.data.teamSize} people; ${profile.data.targetDurationMonths}-month target; 2D ${profile.data.capability2d}; 3D ${profile.data.capability3d}; backend ${profile.data.onlineBackendCapability}; content ${profile.data.contentProductionCapability}; live-ops ${profile.data.liveOpsCapability}`,
    });
    if (fit.score !== null) evidence.push({ id: "studio.fit", label: "Studio Fit", value: `${Math.round(fit.score)} of 100 (${fit.formulaVersion})` });
    fit.positives.slice(0, 5).forEach((value, index) => evidence.push({ id: `studio.positive.${index + 1}`, label: "Studio-fit signal", value }));
    fit.gaps.slice(0, 5).forEach((value, index) => evidence.push({ id: `studio.gap.${index + 1}`, label: "Studio-fit gap", value }));
  }

  return researchBriefInputSchema.parse({
    opportunityId: row.id,
    title: dimensions.data.map((item) => item.displayName).join(" + "),
    platform: row.store,
    market: row.country,
    asOf: row.asOf.toISOString(),
    evidence,
  });
}

export interface ResearchBriefGenerator {
  generate(input: ResearchBriefInput): Promise<{ model: string; brief: ResearchBrief; inputTokens: number; outputTokens: number }>;
}

export interface ResearchBriefStore {
  loadCandidates(limit: number): Promise<OpportunityDetailRow[]>;
  loadProfile(): Promise<StudioProfileRow | null>;
  loadExistingHashes(promptVersion: string, opportunityIds: readonly string[]): Promise<Set<string>>;
  record(input: {
    opportunityId: string;
    inputHash: string;
    promptVersion: string;
    model: string;
    brief: ResearchBrief;
    evidence: Evidence[];
    inputTokens: number;
    outputTokens: number;
  }): Promise<boolean>;
}

export interface ResearchBriefSummary {
  promptVersion: string;
  candidates: number;
  attempted: number;
  created: number;
  skippedInvalid: number;
  skippedExisting: number;
  inputTokens: number;
  outputTokens: number;
  quotaExhausted: boolean;
  errorCount: number;
  errorSample: string | null;
}

export interface ResearchBriefPlan {
  candidates: number;
  skippedInvalid: number;
  skippedExisting: number;
  pending: Array<{ input: ResearchBriefInput; hash: string }>;
}

/** Read-only planning path; it never invokes a model and never returns evidence to logs by itself. */
export async function planResearchBriefs(
  store: ResearchBriefStore,
  options: { limit: number; candidateLimit?: number },
): Promise<ResearchBriefPlan> {
  const [candidates, profile] = await Promise.all([
    store.loadCandidates(options.candidateLimit ?? Math.max(options.limit * 10, 100)),
    store.loadProfile(),
  ]);
  const existing = await store.loadExistingHashes(RESEARCH_BRIEF_PROMPT_VERSION, candidates.map((candidate) => candidate.id));
  const plan: ResearchBriefPlan = { candidates: candidates.length, skippedInvalid: 0, skippedExisting: 0, pending: [] };
  for (const candidate of candidates) {
    const input = buildResearchBriefInput(candidate, profile);
    if (!input) {
      plan.skippedInvalid += 1;
      continue;
    }
    const hash = researchBriefInputHash(input);
    if (existing.has(`${candidate.id}:${hash}`)) {
      plan.skippedExisting += 1;
      continue;
    }
    plan.pending.push({ input, hash });
  }
  return plan;
}

export async function runResearchBriefs(
  generator: ResearchBriefGenerator,
  store: ResearchBriefStore,
  options: { limit: number; candidateLimit?: number },
): Promise<ResearchBriefSummary> {
  const plan = await planResearchBriefs(store, options);
  const summary: ResearchBriefSummary = {
    promptVersion: RESEARCH_BRIEF_PROMPT_VERSION,
    candidates: plan.candidates,
    attempted: 0,
    created: 0,
    skippedInvalid: plan.skippedInvalid,
    skippedExisting: plan.skippedExisting,
    inputTokens: 0,
    outputTokens: 0,
    quotaExhausted: false,
    errorCount: 0,
    errorSample: null,
  };
  const errors: string[] = [];
  for (const item of plan.pending.slice(0, options.limit)) {
    summary.attempted += 1;
    try {
      const generated = await generator.generate(item.input);
      const created = await store.record({
        opportunityId: item.input.opportunityId,
        inputHash: item.hash,
        promptVersion: RESEARCH_BRIEF_PROMPT_VERSION,
        model: generated.model,
        brief: generated.brief,
        evidence: item.input.evidence,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
      });
      if (created) summary.created += 1;
      summary.inputTokens += generated.inputTokens;
      summary.outputTokens += generated.outputTokens;
    } catch (error) {
      if (error instanceof AllModelsExhaustedError) {
        summary.quotaExhausted = true;
        summary.attempted -= 1;
        break;
      }
      errors.push(`${item.input.opportunityId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      if (error instanceof GeminiFatalError) break;
    }
  }
  summary.errorCount = errors.length;
  summary.errorSample = errors.length === 0 ? null : errors.join("; ").slice(0, 300);
  return summary;
}
