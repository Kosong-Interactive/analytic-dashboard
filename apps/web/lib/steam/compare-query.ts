import { countryCodeSchema } from "@analytic-dashboard/shared";
import { z } from "zod";

import { PLATFORM_OPPORTUNITY_MODES, type PlatformOpportunityMode } from "@analytic-dashboard/analytics";

import { COMPARED_PLATFORMS, compareTypeValues, type CompareSort, type CompareType } from "./platform-compare";

const sortValues = ["coverage", ...COMPARED_PLATFORMS] as const;

export const compareSortLabels: Record<CompareSort, string> = {
  coverage: "Most platforms measured",
  steam: "Steam momentum",
  google_play: "Google Play momentum",
  app_store: "App Store momentum",
};
export const compareSortValues = sortValues;

export const compareModeValues = ["all", ...PLATFORM_OPPORTUNITY_MODES] as const;
export type CompareModeFilter = "all" | PlatformOpportunityMode;

const queryShape = z.object({
  country: countryCodeSchema.catch("id"),
  type: z.enum(compareTypeValues).catch("genre"),
  sort: z.enum(sortValues).catch("coverage"),
  mode: z.enum(compareModeValues).catch("all"),
});

export type CompareQuery = z.infer<typeof queryShape>;

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseCompareQuery(params: RawSearchParams): CompareQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return queryShape.parse({ country: first(params.country), type: first(params.type), sort: first(params.sort), mode: first(params.mode) });
}

export function compareHref(current: CompareQuery, change: Partial<CompareQuery> = {}): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.type !== "genre") query.set("type", next.type satisfies CompareType);
  if (next.sort !== "coverage") query.set("sort", next.sort);
  if (next.mode !== "all") query.set("mode", next.mode);
  const text = query.toString();
  return text ? `/steam/compare?${text}` : "/steam/compare";
}
