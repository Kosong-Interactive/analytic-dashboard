import { loadTrackedStorefronts } from "@analytic-dashboard/db";
import { countryNames, marketCountries, marketLabels } from "@analytic-dashboard/shared";

import { getDatabase } from "@/lib/database";
import type { OverviewFilters } from "@/lib/overview/filters";

/**
 * SEA and World combine several storefronts. Say how many have been collected, so the label is never
 * read as a complete or worldwide view; a storefront that has not been collected is missing, not weak.
 */
export async function MarketNotice({ filters }: { filters: OverviewFilters }) {
  const market = filters.market;
  if (!market || market === "id") return null;
  const countries = marketCountries[market];
  let collected: string[] = [];
  try {
    collected = (await loadTrackedStorefronts(getDatabase(), countries)).sort(
      (a, b) => countries.indexOf(a as (typeof countries)[number]) - countries.indexOf(b as (typeof countries)[number]),
    );
  } catch (error) {
    console.error(JSON.stringify({ event: "market_notice.failed", message: error instanceof Error ? error.message : "unknown" }));
  }
  const names = collected.map((code) => countryNames[code as keyof typeof countryNames] ?? code).join(", ");
  return (
    <p role="note" className="border-b border-line bg-surface-alt px-4 py-2 text-sm leading-5 text-ink-soft sm:px-7">
      <strong className="font-medium text-ink">{marketLabels[market]}</strong> combines {countries.length} storefronts;{" "}
      {collected.length} of {countries.length} collected so far{names ? ` (${names})` : ""}. A game seen in several
      storefronts is counted once and shown with its median storefront score; counts are never added together, and a
      storefront that is not collected yet is missing, not weak.
    </p>
  );
}
