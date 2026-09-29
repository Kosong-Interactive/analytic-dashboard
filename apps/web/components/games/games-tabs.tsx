import type { OverviewFilters } from "@/lib/overview/filters";

import { SegmentedLinks } from "../shell/segmented-links";

export type GamesTab = "all" | "watchlist" | "compare";

function withFilters(path: string, filters: OverviewFilters, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
  if (filters.country !== "id") query.set("country", filters.country);
  if (filters.platform !== "all") query.set("platform", filters.platform);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/**
 * Watchlist and Compare live inside Games. The compare selection travels between the tabs,
 * so choosing games in the list and opening Compare never loses it.
 */
export function GamesTabs({
  active,
  filters,
  compareIds,
  watchlistCount,
}: {
  active: GamesTab;
  filters: OverviewFilters;
  compareIds: readonly string[];
  /** Active entries, when the page already knows it. */
  watchlistCount?: number;
}) {
  const selection = compareIds.join(",");
  return (
    <SegmentedLinks
      label="Games sections"
      items={[
        { key: "all", label: "All games", href: withFilters("/games", filters, { compare: selection }), active: active === "all" },
        {
          key: "watchlist",
          label: watchlistCount === undefined ? "Watchlist" : `Watchlist (${watchlistCount})`,
          href: withFilters("/games/watchlist", filters),
          active: active === "watchlist",
        },
        {
          key: "compare",
          label: compareIds.length > 0 ? `Compare (${compareIds.length})` : "Compare",
          href: withFilters("/games/compare", filters, { ids: selection }),
          active: active === "compare",
        },
      ]}
    />
  );
}
