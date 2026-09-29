import {
  trendTier,
  type TrendComponent,
  type TrendingScore,
  type TrendTier,
} from "@analytic-dashboard/analytics";

const DAY_MS = 86_400_000;
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const TRENDING_MIN_SCORE = 61;
const TRENDING_ROWS = 10;
const DISCOVERED_ROWS = 5;

/** Structural subset of the database candidate row, so this module is testable without a database. */
export interface OverviewCandidate {
  storeAppId: string;
  store: "app_store" | "google_play";
  country: string;
  title: string;
  developerName: string | null;
  storeCategory: string | null;
  storeUrl: string;
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
  source: "app_store" | "google_play";
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
  developer: string | null;
  store: "app_store" | "google_play";
  country: string;
  category: string | null;
  storeUrl: string;
  rating: number | null;
  ratingCount: number | null;
  ratingCountPerDay: number | null;
  rankChange: number | null;
  score: number;
  tier: TrendTier;
  weightCoverage: number;
  latestObservationAt: Date | null;
  components: ScoreComponentView[];
}

export interface DiscoveredRow {
  id: string;
  title: string;
  developer: string | null;
  store: "app_store" | "google_play";
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
  source: "app_store" | "google_play";
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
    trending: scored.slice(0, TRENDING_ROWS).map(({ candidate, score, value }, index) => ({
      id: candidate.storeAppId,
      rank: index + 1,
      title: candidate.title,
      developer: candidate.developerName,
      store: candidate.store,
      country: candidate.country,
      category: candidate.storeCategory,
      storeUrl: candidate.storeUrl,
      rating: latestRating(candidate),
      ratingCount: latestRatingCount(candidate),
      ratingCountPerDay: rawOf(score, "ratingCountVelocity7d"),
      rankChange: rawOf(score, "rankGain7d"),
      score: value,
      tier: trendTier(value),
      weightCoverage: score.weightCoverage,
      latestObservationAt: score.latestObservationAt,
      components: score.components.map((c) => ({
        component: c.component,
        raw: c.raw,
        weight: c.weight,
        contribution: c.contribution,
      })),
    })),
    discovered: [...candidates]
      .sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime())
      .slice(0, DISCOVERED_ROWS)
      .map((candidate) => ({
        id: candidate.storeAppId,
        title: candidate.title,
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

function toSourceStatus(row: OverviewSourceHealth, asOf: Date): SourceStatus {
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
