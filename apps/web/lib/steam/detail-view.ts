import type { SteamGameDetail } from "@analytic-dashboard/db";

import { formatCount } from "../format/format";
import { formatUpfrontPrice } from "../format/price";
import type { SeriesPoint } from "../games/view-model";
import { formatRatio, positiveRatio, rankChange } from "./format";
import { steamChartLabels } from "./query";

export interface SteamDetailSeries {
  players: SeriesPoint[];
  /** Share of positive reviews in percent, 0–100. */
  positive: SeriesPoint[];
  reviews: SeriesPoint[];
  mostPlayedRank: SeriesPoint[];
  topSellersRank: SeriesPoint[];
}

const point = (at: Date, value: number): SeriesPoint => ({ at: at.toISOString(), value });

/** Missing readings are skipped, never drawn as zero. */
export function buildSteamSeries(game: Pick<SteamGameDetail, "snapshots" | "ranks">): SteamDetailSeries {
  const rank = (chart: string) =>
    game.ranks.filter((row) => row.chart === chart).map((row) => point(row.capturedAt, row.rank));
  return {
    players: game.snapshots.flatMap((row) =>
      row.currentPlayers === null ? [] : [point(row.playersCapturedAt ?? row.capturedAt, row.currentPlayers)],
    ),
    positive: game.snapshots.flatMap((row) => {
      const ratio = positiveRatio(row);
      return ratio === null ? [] : [point(row.reviewsCapturedAt ?? row.capturedAt, ratio * 100)];
    }),
    reviews: game.snapshots.flatMap((row) =>
      row.reviewTotal === null ? [] : [point(row.reviewsCapturedAt ?? row.capturedAt, row.reviewTotal)],
    ),
    mostPlayedRank: rank("most_played"),
    topSellersRank: rank("top_sellers"),
  };
}

export interface SteamMetric {
  label: string;
  value: string;
  note: string;
}

/** The newest reading of each chart the game appears in. */
function latestPositions(game: Pick<SteamGameDetail, "ranks">) {
  const latest = new Map<string, SteamGameDetail["ranks"][number]>();
  for (const row of game.ranks) {
    const current = latest.get(row.chart);
    if (!current || row.capturedAt > current.capturedAt) latest.set(row.chart, row);
  }
  return latest;
}

export function buildSteamMetrics(
  game: Pick<SteamGameDetail, "snapshot" | "ranks" | "prices" | "isFree">,
  country: "id" | "us",
): SteamMetric[] {
  const { snapshot } = game;
  const positions = [...latestPositions(game).values()].sort((a, b) => a.rank - b.rank);
  const best = positions[0];
  const move = best ? rankChange(best.rank, best.lastWeekRank) : null;
  const price = game.prices[country];

  return [
    {
      label: "Players now",
      value: formatCount(snapshot?.currentPlayers ?? null),
      note: snapshot?.currentPlayers == null ? "not reported" : "concurrent · Steam Global",
    },
    {
      label: "Positive reviews",
      value: formatRatio(positiveRatio(snapshot)),
      note: positiveRatio(snapshot) === null ? "not reported" : "share of all reviews · Steam Global",
    },
    {
      label: "Reviews",
      value: formatCount(snapshot?.reviewTotal ?? null),
      note: snapshot?.reviewTotal == null ? "not reported" : "positive + negative · Steam Global",
    },
    {
      label: "Chart rank",
      value: best ? `#${best.rank}` : "—",
      note: best ? `${steamChartLabels[best.chart as keyof typeof steamChartLabels] ?? best.chart} · Global` : "not in a tracked chart",
    },
    {
      label: "Rank vs last week",
      value: move === null ? "—" : move > 0 ? `+${move}` : move < 0 ? `−${Math.abs(move)}` : "0",
      note: move === null ? "Steam gave no last-week rank" : "positions; positive means rising",
    },
    {
      label: `Price · ${country === "id" ? "Indonesia" : "Global (US)"}`,
      value: formatUpfrontPrice(game.isFree ? 0 : (price?.finalPrice ?? null), price?.currency ?? null),
      note: game.isFree ? "free to play" : price ? "upfront price" : "not reported",
    },
  ];
}
