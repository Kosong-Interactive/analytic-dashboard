import { countryCodeSchema } from "@analytic-dashboard/shared";
import { z } from "zod";

export const steamChartValues = ["most_played", "top_sellers"] as const;

export const steamChartLabels = {
  most_played: "Most Played",
  top_sellers: "Top Sellers",
} as const;

const steamQuerySchema = z.object({
  country: countryCodeSchema.catch("id"),
  chart: z.enum(steamChartValues).catch("most_played"),
});

/** `country` only chooses the regional price shown; Steam charts themselves are global. */
export type SteamQuery = z.infer<typeof steamQuerySchema>;

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Unknown or repeated values fall back to defaults, so a bad shared link still renders. */
export function parseSteamQuery(params: RawSearchParams): SteamQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return steamQuerySchema.parse({ country: first(params.country), chart: first(params.chart) });
}

export function steamHref(current: SteamQuery, change: Partial<SteamQuery> = {}, path = "/steam"): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.chart !== "most_played") query.set("chart", next.chart);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
