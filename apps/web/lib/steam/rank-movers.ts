import type { SteamChartName, SteamGameListRow } from "@analytic-dashboard/db";

export interface RankMover {
  steamAppId: string;
  externalId: string;
  title: string;
  rank: number;
  lastWeekRank: number;
  /** Places gained since last week; positive means the game moved up the chart. */
  change: number;
}

export interface RankMovers {
  risers: RankMover[];
  fallers: RankMover[];
  /** Games in the chart. */
  inChart: number;
  /** Games in the chart that Steam gave a last-week rank for. */
  measured: number;
  unchanged: number;
}

const LIMIT = 10;

/**
 * Chart movement against Steam's own last-week rank. This is a rank change, not a Trend Score. A
 * game without a last-week rank is left out rather than treated as a new entry or a zero move.
 */
export function buildRankMovers(games: readonly SteamGameListRow[], chart: SteamChartName): RankMovers {
  const inChart = games.flatMap((game) => {
    const position = game.charts[chart];
    return position ? [{ game, position }] : [];
  });
  const measured: RankMover[] = inChart.flatMap(({ game, position }) =>
    position.lastWeekRank === null
      ? []
      : [
          {
            steamAppId: game.steamAppId,
            externalId: game.externalId,
            title: game.title,
            rank: position.rank,
            lastWeekRank: position.lastWeekRank,
            change: position.lastWeekRank - position.rank,
          },
        ],
  );
  const byTitle = (a: RankMover, b: RankMover) => a.title.localeCompare(b.title);
  return {
    risers: measured.filter((m) => m.change > 0).sort((a, b) => b.change - a.change || byTitle(a, b)).slice(0, LIMIT),
    fallers: measured.filter((m) => m.change < 0).sort((a, b) => a.change - b.change || byTitle(a, b)).slice(0, LIMIT),
    inChart: inChart.length,
    measured: measured.length,
    unchanged: measured.filter((m) => m.change === 0).length,
  };
}
