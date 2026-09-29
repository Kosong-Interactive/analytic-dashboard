import {
  computeRawComponents,
  scoreCohort,
  TREND_SCORE_V1,
  type TrendScoreConfig,
  type TrendScoreResult,
} from "./trend-score.js";
import type { Observation } from "./velocity.js";

/** Structural input, so this package never depends on the database package. */
export interface TrendingCandidate {
  storeAppId: string;
  store: string;
  country: string;
  storeCategory: string | null;
  firstSeenAt: Date;
  snapshots: ReadonlyArray<{
    capturedAt: Date;
    rating: number | null;
    ratingCount: number | null;
    reviewCount: number | null;
  }>;
  ranks: ReadonlyArray<{ chartType: string; capturedAt: Date; rank: number }>;
  countryBreadth: { current: number; previous: number };
}

export interface ScoreTrendingOptions {
  asOf: Date;
  /** Chart whose positions feed the rank-gain component; other charts are ignored. */
  rankChartType: string;
  /** `store_country` keeps cohorts large enough to normalize; category cohorts need much more data. */
  cohortBy?: "store_country" | "store_country_category";
  config?: TrendScoreConfig;
}

export interface TrendingScore extends TrendScoreResult {
  cohort: string;
  cohortSize: number;
  /** Time of the newest reading used, so the reader can judge freshness. */
  latestObservationAt: Date | null;
}

export function scoreTrending(
  candidates: readonly TrendingCandidate[],
  { asOf, rankChartType, cohortBy = "store_country", config = TREND_SCORE_V1 }: ScoreTrendingOptions,
): TrendingScore[] {
  const cohorts = new Map<string, TrendingCandidate[]>();
  for (const candidate of candidates) {
    const key = cohortKey(candidate, cohortBy);
    const members = cohorts.get(key);
    if (members) members.push(candidate);
    else cohorts.set(key, [candidate]);
  }

  return [...cohorts].flatMap(([cohort, members]) => {
    const scored = scoreCohort(
      members.map((member) => ({
        id: member.storeAppId,
        raw: computeRawComponents(
          {
            rankObservations: member.ranks
              .filter((reading) => reading.chartType === rankChartType)
              .map((reading) => ({ capturedAt: reading.capturedAt, value: reading.rank })),
            reviewCountObservations: series(member, "reviewCount"),
            ratingCountObservations: series(member, "ratingCount"),
            ratingObservations: series(member, "rating"),
            // A game with no listing a window ago has no growth baseline; that is not "zero growth".
            countryBreadth:
              member.countryBreadth.previous > 0 ? member.countryBreadth : null,
            firstSeenAt: member.firstSeenAt,
            asOf,
          },
          config,
        ),
      })),
      config,
    );

    return scored.map((result, index): TrendingScore => ({
      ...result,
      cohort,
      cohortSize: members.length,
      latestObservationAt: latestReading(members[index]),
    }));
  });
}

function cohortKey(
  candidate: TrendingCandidate,
  cohortBy: "store_country" | "store_country_category",
): string {
  const base = `${candidate.store}:${candidate.country}`;
  return cohortBy === "store_country"
    ? base
    : `${base}:${candidate.storeCategory ?? "unknown"}`;
}

function series(
  candidate: TrendingCandidate,
  field: "rating" | "ratingCount" | "reviewCount",
): Observation[] {
  return candidate.snapshots.map((snapshot) => ({
    capturedAt: snapshot.capturedAt,
    value: snapshot[field],
  }));
}

function latestReading(candidate: TrendingCandidate | undefined): Date | null {
  if (!candidate) return null;
  const times = [
    ...candidate.snapshots.map((s) => s.capturedAt.getTime()),
    ...candidate.ranks.map((r) => r.capturedAt.getTime()),
  ];
  return times.length === 0 ? null : new Date(Math.max(...times));
}
