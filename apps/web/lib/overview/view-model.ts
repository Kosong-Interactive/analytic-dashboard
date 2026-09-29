import {
  trendTier,
  type TrendComponent,
  type TrendingScore,
  type TrendTier,
} from "@analytic-dashboard/analytics";
import type { Store } from "@analytic-dashboard/shared";

const DAY_MS = 86_400_000;
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const TRENDING_MIN_SCORE = 61;
const TRENDING_ROWS = 10;
const DISCOVERED_ROWS = 5;

/** Structural subset of the database candidate row, so this module is testable without a database. */
export interface OverviewCandidate {
  storeAppId: string;
  store: Store;
  country: string;
  title: string;
  developerName: string | null;
  storeCategory: string | null;
  storeUrl: string;
  iconUrl: string | null;
  releaseDate: Date | null;
  firstSeenAt: Date;
  snapshots: ReadonlyArray<{
    capturedAt: Date;
    rating: number | null;
    ratingCount: number | null;
  }>;
  ranks: ReadonlyArray<{ chartType: string; capturedAt: Date; rank: number }>;
  countryBreadth: { current: number; previous: number };
}

export interface OverviewSourceHealth {
  source: Store;
  country: string;
  jobType: string;
  latestStatus: string;
  latestErrorCount: number;
  lastCollectedAt: Date | null;
}

export interface ScoreComponentView {
  component: TrendComponent;
  raw: number | null;
  weight: number;
  contribution: number | null;
}

export interface TrendingRow {
  id: string;
  rank: number;
  title: string;
  iconUrl: string | null;
  developer: string | null;
  store: Store;
  country: string;
  category: string | null;
  storeUrl: string;
  rating: number | null;
  ratingCount: number | null;
  ratingCountPerDay: number | null;
  rankChange: number | null;
  /** `null` when the game could not be scored yet (not the same as a score of zero). */
  score: number | null;
  scoreNote: string | null;
  tier: TrendTier | null;
  weightCoverage: number;
  latestObservationAt: Date | null;
  firstSeenAt: Date;
  releaseDate: Date | null;
  components: ScoreComponentView[];
}

export interface DiscoveredRow {
  id: string;
  title: string;
  iconUrl: string | null;
  developer: string | null;
  store: Store;
  category: string | null;
  storeUrl: string;
  rating: number | null;
  ratingCount: number | null;
  firstSeenAt: Date;
  releaseDate: Date | null;
}

export type SourceState = "fresh" | "stale" | "failed" | "never";

export interface SourceStatus {
  key: string;
  source: Store;
  country: string;
  jobType: string;
  state: SourceState;
  lastCollectedAt: Date | null;
  latestStatus: string;
  latestErrorCount: number;
}

export interface OverviewData {
  asOf: Date;
  kpis: {
    tracked: number;
    newlyDiscovered24h: number;
    trendingCount: number;
    scoredCount: number;
    lastCollectedAt: Date | null;
  };
  /** Days between the oldest observation and now, so an empty ranking can say why. */
  historyDays: number | null;
  trending: TrendingRow[];
  discovered: DiscoveredRow[];
  sources: SourceStatus[];
}

export function buildOverview(input: {
  candidates: readonly OverviewCandidate[];
  scores: readonly TrendingScore[];
  health: readonly OverviewSourceHealth[];
  asOf: Date;
}): OverviewData {
  const { candidates, scores, health, asOf } = input;
  const scoreById = new Map(scores.map((score) => [score.id, score]));

  const scored = candidates.flatMap((candidate) => {
    const score = scoreById.get(candidate.storeAppId);
    return score && score.score !== null ? [{ candidate, score, value: score.score }] : [];
  });
  scored.sort(
    (a, b) =>
      b.value - a.value ||
      (latestRatingCount(b.candidate) ?? 0) - (latestRatingCount(a.candidate) ?? 0) ||
      a.candidate.title.localeCompare(b.candidate.title),
  );

  const sources = health.map((row) => toSourceStatus(row, asOf));
  const collected = sources.flatMap((s) => (s.lastCollectedAt ? [s.lastCollectedAt] : []));

  const observed = candidates.flatMap((candidate) =>
    candidate.snapshots.map((snapshot) => snapshot.capturedAt.getTime()),
  );

  return {
    asOf,
    kpis: {
      tracked: candidates.length,
      newlyDiscovered24h: candidates.filter(
        (c) => asOf.getTime() - c.firstSeenAt.getTime() <= DAY_MS,
      ).length,
      trendingCount: scored.filter((s) => s.value >= TRENDING_MIN_SCORE).length,
      scoredCount: scored.length,
      lastCollectedAt:
        collected.length === 0
          ? null
          : new Date(Math.max(...collected.map((date) => date.getTime()))),
    },
    historyDays:
      observed.length === 0
        ? null
        : (asOf.getTime() - Math.min(...observed)) / DAY_MS,
    trending: scored
      .slice(0, TRENDING_ROWS)
      .map(({ candidate, score }, index) => toTrendingRow(candidate, score, index + 1)),
    discovered: [...candidates]
      .sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime())
      .slice(0, DISCOVERED_ROWS)
      .map((candidate) => ({
        id: candidate.storeAppId,
        title: candidate.title,
        iconUrl: candidate.iconUrl,
        developer: candidate.developerName,
        store: candidate.store,
        category: candidate.storeCategory,
        storeUrl: candidate.storeUrl,
        rating: latestRating(candidate),
        ratingCount: latestRatingCount(candidate),
        firstSeenAt: candidate.firstSeenAt,
        releaseDate: candidate.releaseDate,
      })),
    sources,
  };
}

export function toSourceStatus(row: OverviewSourceHealth, asOf: Date): SourceStatus {
  let state: SourceState;
  if (row.latestStatus === "failed") state = "failed";
  else if (row.lastCollectedAt === null) state = "never";
  else if (asOf.getTime() - row.lastCollectedAt.getTime() > STALE_AFTER_MS) state = "stale";
  else state = "fresh";

  return {
    key: `${row.source}:${row.country}:${row.jobType}`,
    source: row.source,
    country: row.country,
    jobType: row.jobType,
    state,
    lastCollectedAt: row.lastCollectedAt,
    latestStatus: row.latestStatus,
    latestErrorCount: row.latestErrorCount,
  };
}

function rawOf(score: TrendingScore, component: TrendComponent): number | null {
  return score.components.find((c) => c.component === component)?.raw ?? null;
}

function latest(candidate: OverviewCandidate) {
  return [...candidate.snapshots].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  )[0];
}

function latestRating(candidate: OverviewCandidate): number | null {
  return latest(candidate)?.rating ?? null;
}

function latestRatingCount(candidate: OverviewCandidate): number | null {
  return latest(candidate)?.ratingCount ?? null;
}

export function toTrendingRow(
  candidate: OverviewCandidate,
  score: TrendingScore | undefined,
  rank: number,
): TrendingRow {
  const value = score?.score ?? null;
  return {
    id: candidate.storeAppId,
    rank,
    title: candidate.title,
    iconUrl: candidate.iconUrl,
    developer: candidate.developerName,
    store: candidate.store,
    country: candidate.country,
    category: candidate.storeCategory,
    storeUrl: candidate.storeUrl,
    rating: latestRating(candidate),
    ratingCount: latestRatingCount(candidate),
    ratingCountPerDay: score ? rawOf(score, "ratingCountVelocity7d") : null,
    rankChange: score ? rawOf(score, "rankGain7d") : null,
    score: value,
    scoreNote: score?.reason ?? null,
    tier: value === null ? null : trendTier(value),
    weightCoverage: score?.weightCoverage ?? 0,
    latestObservationAt: score?.latestObservationAt ?? null,
    firstSeenAt: candidate.firstSeenAt,
    releaseDate: candidate.releaseDate,
    components: (score?.components ?? []).map((c) => ({
      component: c.component,
      raw: c.raw,
      weight: c.weight,
      contribution: c.contribution,
    })),
  };
}
