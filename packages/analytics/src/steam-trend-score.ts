import { percentileRanks } from "./normalize.js";
import { windowedChange, type Observation } from "./velocity.js";

const DAY_MS = 86_400_000;

export const STEAM_TREND_COMPONENTS = [
  "rankGain",
  "playerMomentum7d",
  "reviewVelocity7d",
  "chartBreadth",
  "discoveryRecency",
  "sentimentMomentum7d",
] as const;

export type SteamTrendComponent = (typeof STEAM_TREND_COMPONENTS)[number];

/** Components already on a 0–1 scale; they are used as they are instead of being ranked. */
const UNIT_SCALE: ReadonlySet<SteamTrendComponent> = new Set(["chartBreadth", "discoveryRecency"]);

export interface SteamTrendScoreConfig {
  version: string;
  weights: Record<SteamTrendComponent, number>;
  windowDays: number;
  /** Games first observed longer ago than this get no discovery-recency credit. */
  recencyHorizonDays: number;
  minCohortSize: number;
  /** Minimum share of total weight that must be measurable, otherwise no score is given. */
  minWeightCoverage: number;
  /** Steam charts tracked, which is what `chartBreadth` is a share of. */
  chartCount: number;
}

/**
 * Steam has no star ratings and no country breadth, so this is its own versioned formula and never
 * a rescaling of `trend_score_v1`. Rank gain comes from Steam's own last-week rank, so a partial
 * score exists from the first collection; the other signals need history inside the window.
 */
export const STEAM_TREND_SCORE_V1: SteamTrendScoreConfig = {
  version: "steam_trend_v1",
  weights: {
    rankGain: 0.3,
    playerMomentum7d: 0.25,
    reviewVelocity7d: 0.2,
    chartBreadth: 0.1,
    discoveryRecency: 0.1,
    sentimentMomentum7d: 0.05,
  },
  windowDays: 7,
  recencyHorizonDays: 30,
  minCohortSize: 3,
  minWeightCoverage: 0.4,
  chartCount: 2,
};

export interface SteamChartPositionInput {
  rank: number;
  /** Steam's own rank a week earlier; `null` when Steam did not give one. */
  lastWeekRank: number | null;
}

/** Structural input, so this package never depends on the database package. */
export interface SteamTrendCandidate {
  id: string;
  firstSeenAt: Date;
  /** Newest-chart position per chart; `null` when the game is not in it. */
  charts: Record<"most_played" | "top_sellers", SteamChartPositionInput | null>;
  snapshots: ReadonlyArray<{
    capturedAt: Date;
    currentPlayers: number | null;
    reviewPositive: number | null;
    reviewTotal: number | null;
  }>;
}

export type SteamRawComponents = Record<SteamTrendComponent, number | null>;

export function computeSteamRawComponents(
  candidate: SteamTrendCandidate,
  asOf: Date,
  config: SteamTrendScoreConfig = STEAM_TREND_SCORE_V1,
): SteamRawComponents {
  const options = { windowDays: config.windowDays };
  const positions = Object.values(candidate.charts);
  const gains = positions.flatMap((position) =>
    position && position.lastWeekRank !== null ? [position.lastWeekRank - position.rank] : [],
  );
  const inCharts = positions.filter((position) => position !== null).length;
  const ageDays = Math.max(0, (asOf.getTime() - candidate.firstSeenAt.getTime()) / DAY_MS);

  const players = candidate.snapshots.map((s): Observation => ({ capturedAt: s.capturedAt, value: s.currentPlayers }));
  const reviews = candidate.snapshots.map((s): Observation => ({ capturedAt: s.capturedAt, value: s.reviewTotal }));
  const sentiment = candidate.snapshots.map(
    (s): Observation => ({
      capturedAt: s.capturedAt,
      value: s.reviewTotal !== null && s.reviewTotal > 0 && s.reviewPositive !== null ? (100 * s.reviewPositive) / s.reviewTotal : null,
    }),
  );

  const playerChange = windowedChange(players, options);
  const reviewChange = windowedChange(reviews, options);
  const sentimentChange = windowedChange(sentiment, options);

  return {
    // The best movement across charts counts; a game absent from both has no rank movement to judge.
    rankGain: gains.length === 0 ? null : Math.max(...gains),
    // Relative change, so a game with 1M players is not favoured over one that doubled from 1,000.
    playerMomentum7d:
      playerChange.status === "ok" && playerChange.from.value > 0 ? playerChange.delta / playerChange.from.value : null,
    reviewVelocity7d: reviewChange.status === "ok" ? reviewChange.perDay : null,
    chartBreadth: inCharts / config.chartCount,
    discoveryRecency: Math.max(0, 1 - ageDays / config.recencyHorizonDays),
    sentimentMomentum7d: sentimentChange.status === "ok" ? sentimentChange.delta : null,
  };
}

export interface SteamScoredComponent {
  component: SteamTrendComponent;
  raw: number | null;
  /** Percentile within the Steam cohort, or the 0–1 value itself for unit-scale components. */
  normalized: number | null;
  weight: number;
  /** Points added to the score; contributions of a scored game sum to its score. */
  contribution: number | null;
}

export interface SteamTrendScore {
  id: string;
  formulaVersion: string;
  /** 0–100, or `null` when too few components could be measured. */
  score: number | null;
  /** Share of total weight that was measurable. */
  weightCoverage: number;
  components: SteamScoredComponent[];
  reason: string | null;
  cohortSize: number;
  /** Time of the newest reading used, so the reader can judge freshness. */
  latestObservationAt: Date | null;
}

/**
 * Scores the Steam cohort. Unmeasurable components are left out and the remaining weights are
 * rescaled, so a missing signal never counts as a bad one; the coverage figure says how much was used.
 */
export function scoreSteamTrending(
  candidates: readonly SteamTrendCandidate[],
  asOf: Date,
  config: SteamTrendScoreConfig = STEAM_TREND_SCORE_V1,
): SteamTrendScore[] {
  const raws = candidates.map((candidate) => computeSteamRawComponents(candidate, asOf, config));
  const normalizedByComponent = Object.fromEntries(
    STEAM_TREND_COMPONENTS.map((component) => [
      component,
      UNIT_SCALE.has(component)
        ? raws.map((raw) => raw[component])
        : percentileRanks(raws.map((raw) => raw[component]), config.minCohortSize),
    ]),
  ) as Record<SteamTrendComponent, (number | null)[]>;
  const totalWeight = Object.values(config.weights).reduce((sum, weight) => sum + weight, 0);

  return candidates.map((candidate, index) => {
    const raw = raws[index];
    const measured = STEAM_TREND_COMPONENTS.filter((component) => normalizedByComponent[component][index] !== null);
    const availableWeight = measured.reduce((sum, component) => sum + config.weights[component], 0);
    const weightCoverage = availableWeight / totalWeight;
    const scorable = availableWeight > 0 && weightCoverage >= config.minWeightCoverage;

    const components = STEAM_TREND_COMPONENTS.map((component): SteamScoredComponent => {
      const normalized = normalizedByComponent[component][index] ?? null;
      return {
        component,
        raw: raw ? raw[component] : null,
        normalized,
        weight: config.weights[component],
        contribution:
          scorable && normalized !== null ? (100 * config.weights[component] * normalized) / availableWeight : null,
      };
    });

    const times = [
      ...candidate.snapshots.map((snapshot) => snapshot.capturedAt.getTime()),
    ];
    return {
      id: candidate.id,
      formulaVersion: config.version,
      score: scorable ? components.reduce((sum, item) => sum + (item.contribution ?? 0), 0) : null,
      weightCoverage,
      components,
      reason: scorable ? null : `only ${(weightCoverage * 100).toFixed(0)}% of the score weight is measurable`,
      cohortSize: candidates.length,
      latestObservationAt: times.length === 0 ? null : new Date(Math.max(...times)),
    };
  });
}

export type SteamTrendTier = "exploding" | "trending" | "growing" | "low";

/** Display bands for `steam_trend_v1`; a change to these cut-offs is a new formula version. */
export function steamTrendTier(score: number): SteamTrendTier {
  if (score >= 81) return "exploding";
  if (score >= 61) return "trending";
  if (score >= 31) return "growing";
  return "low";
}
