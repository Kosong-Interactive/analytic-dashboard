import {
  trendTier,
  type TrendingScore,
  type TrendTier,
} from "@analytic-dashboard/analytics";
import type { GameHistory } from "@analytic-dashboard/db";

import { detectPriceChanges, type PriceChange } from "../format/price";
import type { ScoreComponentView } from "../overview/view-model";

const DAY_MS = 86_400_000;
export const HISTORY_DAYS = 30;

export interface SeriesPoint {
  /** ISO timestamp, so the series can cross to a client chart component. */
  at: string;
  value: number;
}

export interface MetricView {
  label: string;
  tip: string;
  value: string;
  note: string;
}

export interface ObservationRow {
  capturedAt: Date;
  rating: number | null;
  ratingCount: number | null;
  reviewCount: number | null;
  /** Google Play reports install ranges, never exact downloads. */
  installs: string | null;
  version: string | null;
}

export interface GameDetailView {
  listing: GameHistory["listing"];
  siblings: GameHistory["siblings"];
  asOf: Date;
  score: {
    value: number | null;
    tier: TrendTier | null;
    note: string | null;
    weightCoverage: number;
    cohort: string | null;
    cohortSize: number | null;
    formulaVersion: string;
    components: ScoreComponentView[];
  };
  latest: {
    capturedAt: Date | null;
    rating: number | null;
    ratingCount: number | null;
    rank: { chartType: string; rank: number; capturedAt: Date } | null;
  };
  series: {
    ratingCount: SeriesPoint[];
    rating: SeriesPoint[];
    rank: SeriesPoint[];
    rankChartType: string | null;
  };
  /** Upfront store price only; in-app purchases are not collected. */
  price: {
    /** Latest reading; `price` is null when the store gave none, which is not the same as free. */
    current: { price: number | null; currency: string | null; capturedAt: Date } | null;
    /** Oldest first, within the stored history window. */
    changes: PriceChange[];
  };
  /** Newest first, for the provenance table. */
  observations: ObservationRow[];
  /** Days covered by stored observations; tells the reader how much history exists. */
  historyDays: number | null;
}

export function buildGameDetail(input: {
  history: GameHistory;
  score: TrendingScore | undefined;
  rankChartType: string;
  asOf: Date;
}): GameDetailView {
  const { history, score, rankChartType, asOf } = input;
  const snapshots = history.snapshots;
  const latestSnapshot = snapshots.at(-1);
  const ranks = history.ranks.filter((row) => row.chartType === rankChartType);
  const latestRank = ranks.at(-1);
  const first = snapshots[0];

  return {
    listing: history.listing,
    siblings: history.siblings,
    asOf,
    score: {
      value: score?.score ?? null,
      tier: score?.score === null || score === undefined ? null : trendTier(score.score),
      note: score?.reason ?? (score ? null : "This storefront is not scored."),
      weightCoverage: score?.weightCoverage ?? 0,
      cohort: score?.cohort ?? null,
      cohortSize: score?.cohortSize ?? null,
      formulaVersion: score?.formulaVersion ?? "trend_score_v1",
      components: (score?.components ?? []).map((c) => ({
        component: c.component,
        raw: c.raw,
        weight: c.weight,
        contribution: c.contribution,
      })),
    },
    latest: {
      capturedAt: latestSnapshot?.capturedAt ?? null,
      rating: latestSnapshot?.rating ?? null,
      ratingCount: latestSnapshot?.ratingCount ?? null,
      rank: latestRank
        ? { chartType: latestRank.chartType, rank: latestRank.rank, capturedAt: latestRank.capturedAt }
        : null,
    },
    series: {
      ratingCount: toSeries(snapshots, "ratingCount"),
      rating: toSeries(snapshots, "rating"),
      rank: ranks.map((row) => ({ at: row.capturedAt.toISOString(), value: row.rank })),
      rankChartType: ranks.length > 0 ? rankChartType : null,
    },
    price: {
      current: latestSnapshot
        ? { price: latestSnapshot.price, currency: latestSnapshot.currency, capturedAt: latestSnapshot.capturedAt }
        : null,
      changes: detectPriceChanges(snapshots),
    },
    observations: [...snapshots].reverse().map((row) => ({
      capturedAt: row.capturedAt,
      rating: row.rating,
      ratingCount: row.ratingCount,
      reviewCount: row.reviewCount,
      installs: formatInstallRange(row.minInstalls, row.maxInstalls),
      version: row.version,
    })),
    historyDays: first ? (asOf.getTime() - first.capturedAt.getTime()) / DAY_MS : null,
  };
}

function toSeries(
  rows: GameHistory["snapshots"],
  field: "rating" | "ratingCount",
): SeriesPoint[] {
  return rows.flatMap((row) => {
    const value = row[field];
    return value === null ? [] : [{ at: row.capturedAt.toISOString(), value }];
  });
}

/** "100K+" or "100K–500K"; never a single exact number. */
export function formatInstallRange(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  if (max === null || max <= min) return `${compact(min)}+`;
  return `${compact(min)}–${compact(max)}`;
}

function compact(value: number): string {
  if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return String(value);
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
