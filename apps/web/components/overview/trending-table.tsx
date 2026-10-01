import { countryLabels, platformLabels } from "@/lib/overview/filters";
import type { OverviewFilters } from "@/lib/overview/filters";
import type { OverviewData } from "@/lib/overview/view-model";

import { GameTable } from "../games/game-table";
import { EmptyState, Panel } from "./panel";

function historyNote(historyDays: number | null): string {
  if (historyDays === null) return "No observations have been collected for this selection yet.";
  return `Collected history so far: ${historyDays.toFixed(1)} days. Scores need at least half of the 7-day window (3.5 days) and three comparable games.`;
}

export function TrendingTable({
  data,
  filters,
}: {
  data: OverviewData;
  filters: OverviewFilters;
}) {
  const { trending, kpis } = data;
  const description = `Ranked by Trend Score · ${countryLabels[filters.country]} · ${platformLabels[filters.platform]} · last 7 days · scored within each store`;

  return (
    <Panel title="Trending Games" description={description}>
      {trending.length === 0 ? (
        <EmptyState title="No games scored yet">{historyNote(data.historyDays)}</EmptyState>
      ) : (
        <GameTable
          rows={trending}
          caption={`Top ${trending.length} of ${kpis.scoredCount} scored games by Trend Score`}
        />
      )}
      <p className="border-t border-line-soft px-4 py-3 text-sm text-dim">
        {kpis.scoredCount > 0
          ? `Showing ${trending.length} of ${kpis.scoredCount} scored games (${kpis.tracked - kpis.scoredCount} tracked games lack enough history to score).`
          : `${kpis.tracked} tracked games, none scored yet.`}
      </p>
    </Panel>
  );
}
