import { notFound } from "next/navigation";

import { HistoryPanels } from "@/components/game-detail/history-panels";
import { GameHeader } from "@/components/game-detail/game-header";
import { MetricCards } from "@/components/game-detail/metric-cards";
import { ObservationsTable } from "@/components/game-detail/observations-table";
import { ScorePanel } from "@/components/game-detail/score-panel";
import { LabelsPanel } from "@/components/game-detail/labels-panel";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getGameDetail } from "@/lib/games/get-game";
import { overviewHref, type OverviewFilters } from "@/lib/overview/filters";

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
  const view = await getGameDetail(id);
  if (!view) notFound();

  const country = view.listing.country === "us" ? "us" : "id";
  const filters: OverviewFilters = { country, platform: view.listing.store };

  return (
    <AppShell filters={filters} active="games" buildHref={(change) => overviewHref(filters, change)}>
      <GameHeader view={view} />
      <MetricCards view={view} />
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
      <LabelsPanel labels={view.labels} />
    </AppShell>
  );
}
