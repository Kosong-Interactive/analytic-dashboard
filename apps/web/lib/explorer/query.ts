import { z } from "zod";

import { parseCompareIds } from "../compare/comparison";
import { parseOverviewFilters, type OverviewFilters } from "../overview/filters";

export const explorerSortValues = ["most_rated", "rating", "score", "newest", "released", "name"] as const;
export type ExplorerSort = (typeof explorerSortValues)[number];

export const explorerSortLabels: Record<ExplorerSort, string> = {
  most_rated: "Most rated",
  rating: "Rating",
  score: "Trend Score",
  newest: "Newest discovered",
  released: "Release date",
  name: "Name",
};

export const releasedValues = ["any", "30", "90", "365", "unknown"] as const;
export type ReleasedFilter = (typeof releasedValues)[number];

export const releasedLabels: Record<ReleasedFilter, string> = {
  any: "Any time",
  "30": "Last 30 days",
  "90": "Last 90 days",
  "365": "Last 12 months",
  unknown: "No release date",
};

export const momentumValues = ["any", "trending", "growing", "scored", "unscored"] as const;
export type MomentumFilter = (typeof momentumValues)[number];

export const momentumLabels: Record<MomentumFilter, string> = {
  any: "Any",
  trending: "Trending (61+)",
  growing: "Growing (31+)",
  scored: "Scored",
  unscored: "Not scored yet",
};

export const labelStatusValues = ["any", "labelled", "unlabelled", "confirmed"] as const;
export type LabelStatusFilter = (typeof labelStatusValues)[number];

export const labelStatusLabels: Record<LabelStatusFilter, string> = {
  any: "Any",
  labelled: "Has genre or mechanic",
  unlabelled: "No genre or mechanic",
  confirmed: "Manually confirmed",
};

export const explorerRatingOptions = [0, 3, 3.5, 4, 4.5] as const;
export const EXPLORER_PAGE_SIZE = 25;

/** Label types a Genres or Mechanics row can open in Games. */
export const labelFilterTypes = ["genre", "subgenre", "core_mechanic", "meta_mechanic", "theme", "multiplayer_mode"] as const;
export type LabelFilterType = (typeof labelFilterTypes)[number];

export interface LabelFilter {
  type: LabelFilterType;
  slug: string;
}

const labelFilterSchema = z
  .string()
  .regex(/^[a-z_]{1,32}:[a-z0-9_]{1,64}$/)
  .transform((value) => {
    const [type = "", slug = ""] = value.split(":");
    return { type, slug };
  })
  .pipe(z.object({ type: z.enum(labelFilterTypes), slug: z.string() }))
  .optional()
  .catch(undefined);

const slug = z
  .string()
  .regex(/^[a-z0-9_]{1,64}$/)
  .optional()
  .catch(undefined);

const queryShape = z.object({
  q: z
    .string()
    .transform((value) => value.trim().slice(0, 80))
    .optional()
    .catch(undefined)
    .transform((value) => value ?? ""),
  category: z
    .string()
    .transform((value) => value.trim().slice(0, 80))
    .optional()
    .catch(undefined)
    .transform((value) => value ?? ""),
  genre: slug,
  mechanic: slug,
  released: z.enum(releasedValues).catch("any"),
  minRating: z.coerce
    .number()
    .refine((value) => (explorerRatingOptions as readonly number[]).includes(value))
    .catch(0),
  momentum: z.enum(momentumValues).catch("any"),
  labels: z.enum(labelStatusValues).catch("any"),
  sort: z.enum(explorerSortValues).catch("most_rated"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ExplorerQuery = OverviewFilters & {
  q: string;
  category: string;
  genre: string | undefined;
  mechanic: string | undefined;
  /** Any taxonomy label, e.g. a theme opened from the Mechanics page. */
  label: LabelFilter | undefined;
  released: ReleasedFilter;
  minRating: number;
  momentum: MomentumFilter;
  labels: LabelStatusFilter;
  sort: ExplorerSort;
  page: number;
  /** Games picked for Compare; kept across filters and pages. */
  compare: string[];
};

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Unknown values fall back to "no filter", so a stale or hand-edited link still renders. */
export function parseExplorerQuery(params: RawSearchParams): ExplorerQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsed = queryShape.parse({
    q: first(params.q),
    category: first(params.category),
    genre: first(params.genre) || undefined,
    mechanic: first(params.mechanic) || undefined,
    released: first(params.released),
    minRating: first(params.minRating),
    momentum: first(params.momentum),
    labels: first(params.labels),
    sort: first(params.sort),
    page: first(params.page),
  });
  return {
    ...parseOverviewFilters(params),
    ...parsed,
    genre: parsed.genre,
    mechanic: parsed.mechanic,
    label: labelFilterSchema.parse(first(params.label) || undefined),
    compare: parseCompareIds(params.compare),
  };
}

/**
 * Builds a shareable URL. Defaults are omitted and any filter change returns to page 1, except a
 * change to the compare selection, which keeps the page so picking games does not jump around.
 */
export function explorerHref(current: ExplorerQuery, change: Partial<ExplorerQuery>): string {
  const keepsPage = change.page !== undefined || Object.keys(change).every((key) => key === "compare");
  const next: ExplorerQuery = {
    ...current,
    ...(keepsPage ? {} : { page: 1 }),
    ...change,
  };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.platform !== "all") query.set("platform", next.platform);
  if (next.q) query.set("q", next.q);
  if (next.category) query.set("category", next.category);
  if (next.genre) query.set("genre", next.genre);
  if (next.mechanic) query.set("mechanic", next.mechanic);
  if (next.label) query.set("label", `${next.label.type}:${next.label.slug}`);
  if (next.released !== "any") query.set("released", next.released);
  if (next.minRating !== 0) query.set("minRating", String(next.minRating));
  if (next.momentum !== "any") query.set("momentum", next.momentum);
  if (next.labels !== "any") query.set("labels", next.labels);
  if (next.sort !== "most_rated") query.set("sort", next.sort);
  if (next.page !== 1) query.set("page", String(next.page));
  if (next.compare.length > 0) query.set("compare", next.compare.join(","));
  const text = query.toString();
  return text ? `/games?${text}` : "/games";
}

/** The filters that narrow the result, excluding country, platform, sort, and page. */
export const clearedExplorerFilters: Partial<ExplorerQuery> = {
  q: "",
  category: "",
  genre: undefined,
  mechanic: undefined,
  label: undefined,
  released: "any",
  minRating: 0,
  momentum: "any",
  labels: "any",
};
