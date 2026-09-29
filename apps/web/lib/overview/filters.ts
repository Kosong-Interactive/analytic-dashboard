import { countryCodeSchema, type CountryCode } from "@analytic-dashboard/shared";
import { z } from "zod";

export const platformValues = ["all", "google_play", "app_store"] as const;

const overviewFiltersSchema = z.object({
  country: countryCodeSchema.catch("id"),
  platform: z.enum(platformValues).catch("all"),
});

export type OverviewFilters = z.infer<typeof overviewFiltersSchema>;
export type Platform = OverviewFilters["platform"];

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Unknown or repeated values fall back to defaults, so a bad shared link still renders. */
export function parseOverviewFilters(params: RawSearchParams): OverviewFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return overviewFiltersSchema.parse({
    country: first(params.country),
    platform: first(params.platform),
  });
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

export const countryLabels: Record<CountryCode, string> = {
  id: "Indonesia",
  us: "United States",
};

export const platformLabels: Record<Platform, string> = {
  all: "All",
  google_play: "Google Play",
  app_store: "App Store",
};
