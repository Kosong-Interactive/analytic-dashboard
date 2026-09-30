import { notFound } from "next/navigation";

import { HistoryPanels } from "@/components/game-detail/history-panels";
import { GameHeader } from "@/components/game-detail/game-header";
import { MetricCards } from "@/components/game-detail/metric-cards";
import { PricePanel } from "@/components/game-detail/price-panel";
import { ObservationsTable } from "@/components/game-detail/observations-table";
import { ScorePanel } from "@/components/game-detail/score-panel";
import { LabelsPanel } from "@/components/game-detail/labels-panel";
import { AppShell } from "@/components/shell/app-shell";
import { WatchButton } from "@/components/watchlist/watch-button";
import { requireUser } from "@/lib/auth/session";
import { gameIdSchema, getGameDetail } from "@/lib/games/get-game";
import { listTaxonomyOptions } from "@/lib/labels/manual-labels";
import { resolveListingLabels } from "@/lib/labels/resolve";
import { overviewHref, type OverviewFilters } from "@/lib/overview/filters";
import { getWatchlistStatus } from "@/lib/watchlist/get-watchlist";

interface GamePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: GamePageProps) {
  const { id } = await params;
  const view = await getGameDetail(id);
  return { title: `${view?.listing.title ?? "Game"} · Game Analytic` };
}

export default async function GamePage({ params }: GamePageProps) {
  const { id } = await params;
  await requireUser(`/games/${id}`);
  const [view, taxonomy, watchStatus] = await Promise.all([
    getGameDetail(id),
    listTaxonomyOptions(),
    gameIdSchema.safeParse(id).success ? getWatchlistStatus(id) : null,
  ]);
  if (!view) notFound();

  const country = view.listing.country === "us" ? "us" : "id";
  const filters: OverviewFilters = { country, platform: view.listing.store };

  return (
    <AppShell filters={filters} active="games" buildHref={(change) => overviewHref(filters, change)}>
      <GameHeader view={view} actions={<WatchButton storeAppId={view.listing.storeAppId} status={watchStatus} />} />
      <MetricCards view={view} />
      <PricePanel view={view} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <HistoryPanels view={view} />
        </div>
        <div className="xl:col-span-5">
          <ScorePanel view={view} />
        </div>
        <div className="xl:col-span-7">
          <ObservationsTable view={view} />
        </div>
      </div>
      <LabelsPanel
        storeAppId={view.listing.storeAppId}
        labels={resolveListingLabels(view.labels)}
        options={taxonomy}
      />
    </AppShell>
  );
}
