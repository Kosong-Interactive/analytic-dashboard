import { percentileRanks } from "./normalize.js";
import { windowedChange, type Observation } from "./velocity.js";

const DAY_MS = 86_400_000;

export const TREND_COMPONENTS = [
  "rankGain7d",
  "reviewVelocity7d",
  "ratingCountVelocity7d",
  "countryBreadthGrowth",
  "discoveryRecency",
  "ratingMomentum",
] as const;

export type TrendComponent = (typeof TREND_COMPONENTS)[number];

export interface TrendScoreConfig {
  version: string;
  weights: Record<TrendComponent, number>;
  windowDays: number;
  /** Games first observed longer ago than this get no discovery-recency credit. */
  recencyHorizonDays: number;
  minCohortSize: number;
  /** Minimum share of total weight that must be measurable, otherwise no score is given. */
  minWeightCoverage: number;
}

export const TREND_SCORE_V1: TrendScoreConfig = {
  version: "trend_score_v1",
  weights: {
    rankGain7d: 0.3,
    reviewVelocity7d: 0.25,
    ratingCountVelocity7d: 0.15,
    countryBreadthGrowth: 0.15,
    discoveryRecency: 0.1,
    ratingMomentum: 0.05,
  },
  windowDays: 7,
  recencyHorizonDays: 30,
  minCohortSize: 3,
  minWeightCoverage: 0.4,
};

/** Raw, unnormalized component values; `null` = could not be measured (not zero). */
export type RawComponents = Record<TrendComponent, number | null>;

export interface RawComponentInput {
  /** Chart positions, 1 = best. A rise in rank is a positive gain. */
  rankObservations: readonly Observation[];
  reviewCountObservations: readonly Observation[];
  ratingCountObservations: readonly Observation[];
  ratingObservations: readonly Observation[];
  /** Countries where the game was seen now vs. one window ago; `null` if not measurable. */
  countryBreadth: { current: number; previous: number } | null;
  /** First observed by this system, not necessarily released. */
  firstSeenAt: Date;
  asOf: Date;
}

export function computeRawComponents(
  input: RawComponentInput,
  config: TrendScoreConfig = TREND_SCORE_V1,
): RawComponents {
  const options = { windowDays: config.windowDays };
  const ageDays = Math.max(
    0,
    (input.asOf.getTime() - input.firstSeenAt.getTime()) / DAY_MS,
  );

  return {
    rankGain7d: changeOf(
      negate(input.rankObservations),
      options,
      (change) => change.delta,
    ),
    reviewVelocity7d: changeOf(
      input.reviewCountObservations,
      options,
      (change) => change.perDay,
    ),
    ratingCountVelocity7d: changeOf(
      input.ratingCountObservations,
      options,
      (change) => change.perDay,
    ),
    countryBreadthGrowth: input.countryBreadth
      ? input.countryBreadth.current - input.countryBreadth.previous
      : null,
    discoveryRecency: Math.max(0, 1 - ageDays / config.recencyHorizonDays),
    ratingMomentum: changeOf(input.ratingObservations, options, (change) => change.delta),
  };
}

export interface ScoredComponent {
  component: TrendComponent;
  raw: number | null;
  /** Percentile within the cohort (recency is already 0–1 and used as is). */
  normalized: number | null;
  weight: number;
  /** Points added to the score; contributions of a scored game sum to its score. */
  contribution: number | null;
}

export interface TrendScoreResult {
  id: string;
  formulaVersion: string;
  /** 0–100, or `null` when too few components could be measured. */
  score: number | null;
  /** Share of total weight that was measurable. */
  weightCoverage: number;
  components: ScoredComponent[];
  reason: string | null;
}

export interface CohortMember {
  id: string;
  raw: RawComponents;
}

/**
 * Scores members of one comparable cohort (same store, country, and category).
 * Unmeasurable components are left out and the remaining weights are rescaled, so a missing
 * signal never counts as a bad one; the coverage figure tells the reader how much was used.
 */
export function scoreCohort(
  members: readonly CohortMember[],
  config: TrendScoreConfig = TREND_SCORE_V1,
): TrendScoreResult[] {
  const normalizedByComponent = Object.fromEntries(
    TREND_COMPONENTS.map((component) => [
      component,
      component === "discoveryRecency"
        ? members.map((member) => member.raw[component])
        : percentileRanks(
            members.map((member) => member.raw[component]),
            config.minCohortSize,
          ),
    ]),
  ) as Record<TrendComponent, (number | null)[]>;

  return members.map((member, index) => {
    const measured = TREND_COMPONENTS.flatMap((component) => {
      const normalized = normalizedByComponent[component][index] ?? null;
      return normalized === null ? [] : [{ component, normalized }];
    });
    const availableWeight = measured.reduce(
      (sum, { component }) => sum + config.weights[component],
      0,
    );
    const weightCoverage = availableWeight / totalWeight(config);
    const scorable = availableWeight > 0 && weightCoverage >= config.minWeightCoverage;

    const components = TREND_COMPONENTS.map((component): ScoredComponent => {
      const normalized = normalizedByComponent[component][index] ?? null;
      const weight = config.weights[component];
      return {
        component,
        raw: member.raw[component],
        normalized,
        weight,
        contribution:
          scorable && normalized !== null
            ? (100 * weight * normalized) / availableWeight
            : null,
      };
    });

    const score = scorable
      ? components.reduce((sum, item) => sum + (item.contribution ?? 0), 0)
      : null;

    return {
      id: member.id,
      formulaVersion: config.version,
      score,
      weightCoverage,
      components,
      reason: scorable
        ? null
        : `only ${(weightCoverage * 100).toFixed(0)}% of the score weight is measurable`,
    };
  });
}

function totalWeight(config: TrendScoreConfig): number {
  return Object.values(config.weights).reduce((sum, weight) => sum + weight, 0);
}

function negate(observations: readonly Observation[]): Observation[] {
  return observations.map(({ capturedAt, value }) => ({
    capturedAt,
    value: value === null ? null : -value,
  }));
}

function changeOf(
  observations: readonly Observation[],
  options: { windowDays: number },
  pick: (change: Extract<ReturnType<typeof windowedChange>, { status: "ok" }>) => number,
): number | null {
  const change = windowedChange(observations, options);
  return change.status === "ok" ? pick(change) : null;
}

export type TrendTier = "exploding" | "trending" | "growing" | "low";

/** Display bands for `trend_score_v1`; a change to these cut-offs is a new formula version. */
export function trendTier(score: number): TrendTier {
  if (score >= 81) return "exploding";
  if (score >= 61) return "trending";
  if (score >= 31) return "growing";
  return "low";
}
