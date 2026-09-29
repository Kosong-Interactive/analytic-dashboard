import type { TrendingScore } from "@analytic-dashboard/analytics";

import {
  toTrendingRow,
  type OverviewCandidate,
  type TrendingRow,
} from "../overview/view-model";
import { RELEASES_PAGE_SIZE, type ReleaseSort, type ReleasesQuery } from "./query";

const DAY_MS = 86_400_000;

export interface ReleasesList {
  rows: TrendingRow[];
  total: number;
  tracked: number;
  /** Tracked games without a store release date; they can never appear here. */
  withoutReleaseDate: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

function descNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

const sorters: Record<ReleaseSort, (a: TrendingRow, b: TrendingRow) => number> = {
  newest: (a, b) => (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0),
  most_rated: (a, b) => descNullsLast(a.ratingCount, b.ratingCount),
  ratings_velocity: (a, b) => descNullsLast(a.ratingCountPerDay, b.ratingCountPerDay),
  score: (a, b) => descNullsLast(a.score, b.score),
};

/**
 * "Newly released" requires a store release date inside the window. Discovery time is a
 * different signal (`firstSeenAt`) and is never used as a substitute. Future dates are
 * excluded, since some stores list pre-registration dates.
 */
export function buildReleasesList(input: {
  candidates: readonly OverviewCandidate[];
  scores: readonly TrendingScore[];
  query: ReleasesQuery;
  asOf: Date;
}): ReleasesList {
  const { candidates, scores, query, asOf } = input;
  const scoreById = new Map(scores.map((score) => [score.id, score]));
  const windowStart = asOf.getTime() - query.days * DAY_MS;

  const released = candidates.filter((candidate) => {
    const time = candidate.releaseDate?.getTime();
    return time !== undefined && time >= windowStart && time <= asOf.getTime();
  });

  const rows = released
    .map((candidate) => toTrendingRow(candidate, scoreById.get(candidate.storeAppId), 0))
    .sort(
      (a, b) =>
        sorters[query.sort](a, b) ||
        (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0) ||
        a.title.localeCompare(b.title),
    );

  const pageCount = Math.max(1, Math.ceil(rows.length / RELEASES_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * RELEASES_PAGE_SIZE;

  return {
    rows: rows
      .slice(start, start + RELEASES_PAGE_SIZE)
      .map((row, index) => ({ ...row, rank: start + index + 1 })),
    total: rows.length,
    tracked: candidates.length,
    withoutReleaseDate: candidates.filter((candidate) => candidate.releaseDate === null).length,
    page,
    pageCount,
    pageSize: RELEASES_PAGE_SIZE,
  };
}
