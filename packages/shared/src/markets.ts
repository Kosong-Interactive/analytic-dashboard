import type { CountryCode } from "./store.js";

/**
 * Mobile markets. A market is a view over one or more storefronts: Indonesia is its own storefront,
 * SEA and World are aggregates of the storefronts listed below. Stores never publish worldwide
 * figures, so SEA and World always report how many of their storefronts were actually collected.
 */
export const marketValues = ["id", "sea", "world"] as const;
export type Market = (typeof marketValues)[number];

export const marketLabels: Record<Market, string> = {
  id: "Indonesia",
  sea: "SEA",
  world: "World",
};

export const marketCountries: Record<Market, readonly CountryCode[]> = {
  id: ["id"],
  // Southeast Asia without Indonesia, which keeps its own market.
  sea: ["sg", "th", "vn", "ph", "my"],
  world: ["us", "jp", "kr", "gb", "de", "br", "in"],
};

/** The storefront a market shows until its aggregate view exists (the first one listed). */
export const marketHomeCountry: Record<Market, CountryCode> = {
  id: "id",
  sea: "sg",
  world: "us",
};

export const countryNames: Record<CountryCode, string> = {
  id: "Indonesia",
  us: "United States",
  sg: "Singapore",
  th: "Thailand",
  vn: "Vietnam",
  ph: "Philippines",
  my: "Malaysia",
  jp: "Japan",
  kr: "South Korea",
  gb: "United Kingdom",
  de: "Germany",
  br: "Brazil",
  in: "India",
};

/** The market a storefront belongs to; every supported storefront belongs to exactly one. */
export function marketOf(country: CountryCode): Market {
  for (const market of marketValues) {
    if (marketCountries[market].includes(country)) return market;
  }
  throw new RangeError(`Storefront ${country} is not part of any market`);
}
