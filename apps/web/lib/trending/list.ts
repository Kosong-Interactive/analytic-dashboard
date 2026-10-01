import type { TrendingScore } from "@analytic-dashboard/analytics";

import { matchesPriceFilter } from "../format/price";
import {
  toTrendingRow,
  type OverviewCandidate,
  type TrendingRow,
} from "../overview/view-model";
import { PAGE_SIZE, type SortKey, type TrendingQuery } from "./query";

export interface TrendingList {
  rows: TrendingRow[];
  /** Games matching the filters, before pagination. */
  total: number;
  /** All tracked games in the selection, before filters. */
  tracked: number;
  scoredCount: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

type Entry = { row: TrendingRow };

/** Missing values sort last for every key, so an unmeasured game never outranks a measured one. */
const sorters: Record<SortKey, (a: TrendingRow, b: TrendingRow) => number> = {
  score: (a, b) => descNullsLast(a.score, b.score),
  ratings_velocity: (a, b) => descNullsLast(a.ratingCountPerDay, b.ratingCountPerDay),
  rank_gain: (a, b) => descNullsLast(a.rankChange, b.rankChange),
  newest: (a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime(),
  most_rated: (a, b) => descNullsLast(a.ratingCount, b.ratingCount),
};

function descNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function buildTrendingList(input: {
  candidates: readonly OverviewCandidate[];
  scores: readonly TrendingScore[];
  query: TrendingQuery;
}): TrendingList {
  const { candidates, scores, query } = input;
  const scoreById = new Map(scores.map((score) => [score.id, score]));

  const all: Entry[] = candidates.map((candidate) => ({
    row: toTrendingRow(candidate, scoreById.get(candidate.storeAppId), 0),
  }));

  // Unscored games are hidden unless asked for, or a score filter would silently drop them anyway.
  const filtered = all
    .map((entry) => entry.row)
    .filter((row) => query.includeUnscored || row.score !== null)
    .filter((row) => query.minScore === 0 || (row.score ?? -1) >= query.minScore)
    .filter((row) => matchesPriceFilter(row.price, query.price))
    .filter((row) => query.minRating === 0 || (row.rating ?? -1) >= query.minRating)
    .sort(
      (a, b) =>
        sorters[query.sort](a, b) ||
        descNullsLast(a.ratingCount, b.ratingCount) ||
        a.title.localeCompare(b.title),
    );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return {
    rows: filtered
      .slice(start, start + PAGE_SIZE)
      .map((row, index) => ({ ...row, rank: start + index + 1 })),
    total: filtered.length,
    tracked: candidates.length,
    scoredCount: all.filter((entry) => entry.row.score !== null).length,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}
