import { steamCountrySchema } from "./query";
import { z } from "zod";

import { releasedValues } from "../explorer/query";
import { priceFilterValues } from "../format/price";

export const steamGameSortValues = ["players", "positive", "reviews", "chart", "newest", "released", "name"] as const;
export type SteamGameSort = (typeof steamGameSortValues)[number];

export const steamGameSortLabels: Record<SteamGameSort, string> = {
  players: "Players now",
  positive: "Positive reviews",
  reviews: "Most reviewed",
  chart: "Chart rank",
  newest: "Newest discovered",
  released: "Release date",
  name: "Name",
};

export const chartFilterValues = ["any", "most_played", "top_sellers"] as const;
export type ChartFilter = (typeof chartFilterValues)[number];
export const chartFilterLabels: Record<ChartFilter, string> = {
  any: "Any",
  most_played: "In Most Played",
  top_sellers: "In Top Sellers",
};

/** Minimum share of positive reviews, in percent. */
export const positiveOptions = [0, 70, 80, 90] as const;
export const reviewCountOptions = [0, 100, 1_000, 10_000] as const;
export const STEAM_GAMES_PAGE_SIZE = 25;

const slug = z
  .string()
  .regex(/^[a-z0-9_]{1,64}$/)
  .optional()
  .catch(undefined);

function fromOptions(options: readonly number[]) {
  return z.coerce
    .number()
    .refine((value) => options.includes(value))
    .catch(options[0] ?? 0);
}

const text = (max: number) =>
  z
    .string()
    .transform((value) => value.trim().slice(0, max))
    .optional()
    .catch(undefined)
    .transform((value) => value ?? "");

const labelFilterSchema = z
  .string()
  .regex(/^[a-z_]{1,32}:[a-z0-9_]{1,64}$/)
  .optional()
  .catch(undefined);

const queryShape = z.object({
  country: steamCountrySchema.catch("id"),
  q: text(80),
  tag: text(80),
  genre: slug,
  mechanic: slug,
  /** Any taxonomy label as `type:slug`, e.g. a theme opened from the Mechanics page. */
  label: labelFilterSchema,
  released: z.enum(releasedValues).catch("any"),
  minPositive: fromOptions(positiveOptions),
  minReviews: fromOptions(reviewCountOptions),
  price: z.enum(priceFilterValues).catch("all"),
  chart: z.enum(chartFilterValues).catch("any"),
  sort: z.enum(steamGameSortValues).catch("players"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type SteamGamesQuery = z.infer<typeof queryShape>;

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Unknown values fall back to "no filter", so a stale or hand-edited link still renders. */
export function parseSteamGamesQuery(params: RawSearchParams): SteamGamesQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return queryShape.parse({
    country: first(params.country),
    q: first(params.q),
    tag: first(params.tag),
    genre: first(params.genre) || undefined,
    mechanic: first(params.mechanic) || undefined,
    label: first(params.label) || undefined,
    released: first(params.released),
    minPositive: first(params.minPositive),
    minReviews: first(params.minReviews),
    price: first(params.price),
    chart: first(params.chart),
    sort: first(params.sort),
    page: first(params.page),
  });
}

/** Shareable URL. Defaults are omitted and any filter change returns to page 1. */
export function steamGamesHref(current: SteamGamesQuery, change: Partial<SteamGamesQuery> = {}): string {
  const next: SteamGamesQuery = { ...current, ...(change.page === undefined ? { page: 1 } : {}), ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.q) query.set("q", next.q);
  if (next.tag) query.set("tag", next.tag);
  if (next.genre) query.set("genre", next.genre);
  if (next.mechanic) query.set("mechanic", next.mechanic);
  if (next.label) query.set("label", next.label);
  if (next.released !== "any") query.set("released", next.released);
  if (next.minPositive !== 0) query.set("minPositive", String(next.minPositive));
  if (next.minReviews !== 0) query.set("minReviews", String(next.minReviews));
  if (next.price !== "all") query.set("price", next.price);
  if (next.chart !== "any") query.set("chart", next.chart);
  if (next.sort !== "players") query.set("sort", next.sort);
  if (next.page !== 1) query.set("page", String(next.page));
  const textValue = query.toString();
  return textValue ? `/steam/games?${textValue}` : "/steam/games";
}

/** The filters that narrow the result, excluding country, sort, and page. */
export const clearedSteamGameFilters: Partial<SteamGamesQuery> = {
  q: "",
  tag: "",
  genre: undefined,
  mechanic: undefined,
  label: undefined,
  released: "any",
  minPositive: 0,
  minReviews: 0,
  price: "all",
  chart: "any",
};
