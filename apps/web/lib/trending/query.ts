import { z } from "zod";

import { parseOverviewFilters, type OverviewFilters } from "../overview/filters";

export const sortValues = [
  "score",
  "ratings_velocity",
  "rank_gain",
  "newest",
  "most_rated",
] as const;
export type SortKey = (typeof sortValues)[number];

export const sortLabels: Record<SortKey, string> = {
  score: "Trend Score",
  ratings_velocity: "Ratings / day",
  rank_gain: "Rank gain",
  newest: "Newest discovered",
  most_rated: "Most rated",
};

export const ratingOptions = [0, 3, 3.5, 4, 4.5] as const;
export const scoreOptions = [0, 31, 61, 81] as const;
export const PAGE_SIZE = 20;

/** Accepts only listed numeric values; anything else falls back to the first ("no filter") option. */
function fromOptions(options: readonly number[]) {
  return z.coerce
    .number()
    .refine((value) => options.includes(value))
    .catch(options[0] ?? 0);
}

const queryShape = z.object({
  sort: z.enum(sortValues).catch("score"),
  minRating: fromOptions(ratingOptions),
  minScore: fromOptions(scoreOptions),
  includeUnscored: z.enum(["1"]).optional().catch(undefined).transform((value) => value === "1"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type TrendingQuery = OverviewFilters & z.infer<typeof queryShape>;

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseTrendingQuery(params: RawSearchParams): TrendingQuery {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const parsed = queryShape.parse({
    sort: first(params.sort),
    minRating: first(params.minRating),
    minScore: first(params.minScore),
    includeUnscored: first(params.includeUnscored),
    page: first(params.page),
  });
  return { ...parseOverviewFilters(params), ...parsed };
}

/** Builds a shareable URL. Defaults are omitted and any filter change returns to page 1. */
export function trendingHref(
  current: TrendingQuery,
  change: Partial<TrendingQuery>,
): string {
  const next: TrendingQuery = {
    ...current,
    ...(change.page === undefined ? { page: 1 } : {}),
    ...change,
  };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.platform !== "all") query.set("platform", next.platform);
  if (next.sort !== "score") query.set("sort", next.sort);
  if (next.minRating !== 0) query.set("minRating", String(next.minRating));
  if (next.minScore !== 0) query.set("minScore", String(next.minScore));
  if (next.includeUnscored) query.set("includeUnscored", "1");
  if (next.page !== 1) query.set("page", String(next.page));
  const text = query.toString();
  return text ? `/trending?${text}` : "/trending";
}
