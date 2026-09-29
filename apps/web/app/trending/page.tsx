import { requireUser } from "@/lib/auth/session";
import { GameTable } from "@/components/games/game-table";
import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { Pagination } from "@/components/trending/pagination";
import { TrendingControls } from "@/components/trending/trending-controls";
import { countryLabels, platformLabels } from "@/lib/overview/filters";
import { loadScoredSelection } from "@/lib/scoring/load-scored";
import { buildTrendingList } from "@/lib/trending/list";
import { parseTrendingQuery, sortLabels, trendingHref } from "@/lib/trending/query";

export const metadata = { title: "Trending Games · Game Analytic" };

interface TrendingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TrendingPage({ searchParams }: TrendingPageProps) {
  await requireUser("/trending");
  const query = parseTrendingQuery(await searchParams);
  const selection = await loadScoredSelection(query);
  const list = buildTrendingList({
    candidates: selection.candidates,
    scores: selection.scores,
    query,
  });
  const emptyBecauseUnscored = list.total === 0 && list.tracked > 0 && list.scoredCount === 0;

  return (
    <AppShell
      filters={query}
      active="trending"
      buildHref={(change) => trendingHref(query, change)}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Trending Games</h1>
        <p className="text-[13px] text-dim">
          Ranked by {sortLabels[query.sort]} · {countryLabels[query.country]} ·{" "}
          {platformLabels[query.platform]} · {list.scoredCount} of {list.tracked} tracked games scored
        </p>
      </div>

      <TrendingControls query={query} />

      <Panel title="Games" description="Scored within each store · last 7 days">
        {list.rows.length === 0 ? (
          <EmptyState title={emptyBecauseUnscored ? "No games scored yet" : "No games match these filters"}>
            {emptyBecauseUnscored
              ? "Scores need about 3.5 days of collected history. Tick “Include games not scored yet” to browse the tracked games meanwhile."
              : "Loosen the rating or score filters, or clear them."}
          </EmptyState>
        ) : (
          <GameTable
            rows={list.rows}
            caption={`Games sorted by ${sortLabels[query.sort]}, page ${list.page} of ${list.pageCount}`}
          />
        )}
        <Pagination list={list} query={query} />
      </Panel>
    </AppShell>
  );
}
