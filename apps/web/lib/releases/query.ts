import { z } from "zod";

import { parseOverviewFilters, type OverviewFilters } from "../overview/filters";

export const windowValues = [7, 30, 90] as const;
export type ReleaseWindow = (typeof windowValues)[number];

export const releaseSortValues = ["newest", "most_rated", "ratings_velocity", "score"] as const;
export type ReleaseSort = (typeof releaseSortValues)[number];

export const releaseSortLabels: Record<ReleaseSort, string> = {
  newest: "Newest",
  most_rated: "Most rated",
  ratings_velocity: "Ratings / day",
  score: "Trend Score",
};

export const RELEASES_PAGE_SIZE = 20;

const queryShape = z.object({
  days: z.coerce
    .number()
    .refine((value): value is ReleaseWindow => (windowValues as readonly number[]).includes(value))
    .catch(30),
  sort: z.enum(releaseSortValues).catch("newest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ReleasesQuery = OverviewFilters & {
  days: ReleaseWindow;
  sort: ReleaseSort;
  page: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseReleasesQuery(params: RawSearchParams): ReleasesQuery {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = queryShape.parse({
    days: first(params.days),
    sort: first(params.sort),
    page: first(params.page),
  });
  return { ...parseOverviewFilters(params), ...parsed, days: parsed.days as ReleaseWindow };
}

export function releasesHref(current: ReleasesQuery, change: Partial<ReleasesQuery>): string {
  const next: ReleasesQuery = {
    ...current,
    ...(change.page === undefined ? { page: 1 } : {}),
    ...change,
  };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.platform !== "all") query.set("platform", next.platform);
  if (next.days !== 30) query.set("days", String(next.days));
  if (next.sort !== "newest") query.set("sort", next.sort);
  if (next.page !== 1) query.set("page", String(next.page));
  const text = query.toString();
  return text ? `/new-releases?${text}` : "/new-releases";
}
