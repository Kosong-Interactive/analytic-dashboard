import { countryNames, marketCountries, marketLabels, marketOf, type CountryCode } from "@analytic-dashboard/shared";

/**
 * SEA and World combine several storefronts, but until their aggregate view exists a page reads one
 * storefront. Say so, so the label is never mistaken for combined or worldwide data.
 */
export function MarketNotice({ country }: { country: CountryCode }) {
  const market = marketOf(country);
  if (market === "id") return null;
  const storefronts = marketCountries[market].map((code) => countryNames[code]).join(", ");
  return (
    <p
      role="note"
      className="border-b border-line bg-surface-alt px-4 py-2 text-sm leading-5 text-ink-soft sm:px-7"
    >
      <strong className="font-medium text-ink">{marketLabels[market]}</strong> will combine {marketCountries[market].length}{" "}
      storefronts ({storefronts}) once they are collected. Until then this page shows only the{" "}
      <strong className="font-medium text-ink">{countryNames[country]}</strong> store, not a combined or worldwide view;
      games and scores may be missing while the other storefronts fill in.
    </p>
  );
}
