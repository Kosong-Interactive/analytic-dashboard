import {
  countryCodeSchema,
  countryNames,
  marketCountries,
  marketHomeCountry,
  marketLabels,
  marketOf,
  platformRegistry,
  type CountryCode,
  type Market,
} from "@analytic-dashboard/shared";
import { z } from "zod";

export const platformValues = ["all", "google_play", "app_store"] as const;

const overviewFiltersSchema = z.object({
  country: countryCodeSchema.catch("id"),
  platform: z.enum(platformValues).catch("all"),
});

export type OverviewFilters = z.infer<typeof overviewFiltersSchema> & {
  /**
   * Set by `parseOverviewFilters`. SEA and World combine several storefronts; `country` is then the
   * market's first storefront, kept for the parts that are still per storefront. Objects built
   * without a market (a game's own storefront, for example) stay a single storefront.
   */
  market?: Market;
};
export type Platform = OverviewFilters["platform"];

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Unknown or repeated values fall back to defaults, so a bad shared link still renders. */
export function parseOverviewFilters(params: RawSearchParams): OverviewFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const parsed = overviewFiltersSchema.parse({
    country: first(params.country),
    platform: first(params.platform),
  });
  // Any storefront in the URL selects its market, so old `?country=us` links open World and
  // `?country=sg` opens SEA; the URL keeps using `country` and the market is derived from it.
  const market = marketOf(parsed.country);
  return { ...parsed, country: marketHomeCountry[market], market };
}

/** What a page heading calls the selection: the market for SEA and World, the storefront otherwise. */
export function scopeLabel(filters: OverviewFilters): string {
  return filters.market && filters.market !== "id" ? marketLabels[filters.market] : countryLabels[filters.country];
}

/** Storefronts a filter reads: all of a SEA or World market, otherwise the one storefront. */
export function storefrontsOf(filters: OverviewFilters): readonly CountryCode[] {
  return filters.market && filters.market !== "id" ? marketCountries[filters.market] : [filters.country];
}

export function overviewHref(
  current: OverviewFilters,
  change: Partial<OverviewFilters>,
): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.platform !== "all") query.set("platform", next.platform);
  const text = query.toString();
  return text ? `/?${text}` : "/";
}

/**
 * Stores publish data per country, never globally. Each storefront is named for what it is; SEA and
 * World are aggregates of several storefronts and carry their own coverage notice.
 */
export const countryLabels: Record<CountryCode, string> = countryNames;

export const platformLabels: Record<Platform, string> = {
  all: "All",
  google_play: platformRegistry.google_play.label,
  app_store: platformRegistry.app_store.label,
};
