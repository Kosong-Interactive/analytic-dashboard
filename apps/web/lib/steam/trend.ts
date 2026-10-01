import {
  scoreSteamTrending,
  steamTrendTier,
  type SteamTrendCandidate,
  type SteamTrendScore,
  type SteamTrendTier,
} from "@analytic-dashboard/analytics";
import type { SteamGameListRow, SteamHistoryReading } from "@analytic-dashboard/db";

export interface SteamTrendRow {
  game: SteamGameListRow;
  score: SteamTrendScore;
  /** `null` while the score is withheld. */
  tier: SteamTrendTier | null;
}

export interface SteamTrendList {
  /** Scored games, best first. */
  rows: SteamTrendRow[];
  tracked: number;
  scoredCount: number;
  /** Average share of the score weight that was measurable across scored games, 0–1; null when none. */
  averageCoverage: number | null;
}

/** Steam Trend Score for the tracked cohort. Pure: the same inputs always give the same ranking. */
export function buildSteamTrendList(input: {
  games: readonly SteamGameListRow[];
  history: ReadonlyMap<string, readonly SteamHistoryReading[]>;
  asOf: Date;
}): SteamTrendList {
  const { games, history, asOf } = input;
  const candidates = games.map(
    (game): SteamTrendCandidate => ({
      id: game.steamAppId,
      firstSeenAt: game.firstSeenAt,
      charts: {
        most_played: game.charts.most_played,
        top_sellers: game.charts.top_sellers,
      },
      snapshots: history.get(game.steamAppId) ?? [],
    }),
  );
  const scores = scoreSteamTrending(candidates, asOf);
  const byId = new Map(games.map((game) => [game.steamAppId, game]));

  const rows = scores.flatMap((score): SteamTrendRow[] => {
    const game = byId.get(score.id);
    return game && score.score !== null ? [{ game, score, tier: steamTrendTier(score.score) }] : [];
  });
  rows.sort(
    (a, b) =>
      (b.score.score ?? 0) - (a.score.score ?? 0) ||
      (b.game.snapshot?.currentPlayers ?? 0) - (a.game.snapshot?.currentPlayers ?? 0) ||
      a.game.title.localeCompare(b.game.title),
  );

  return {
    rows,
    tracked: games.length,
    scoredCount: rows.length,
    averageCoverage: rows.length === 0 ? null : rows.reduce((sum, row) => sum + row.score.weightCoverage, 0) / rows.length,
  };
}

export const steamComponentLabels = {
  rankGain: "Chart rank gain",
  playerMomentum7d: "Player growth (7d)",
  reviewVelocity7d: "Reviews per day (7d)",
  chartBreadth: "Chart breadth",
  discoveryRecency: "Newly discovered",
  sentimentMomentum7d: "Review sentiment change (7d)",
} as const;

export const steamTierLabels: Record<SteamTrendTier, string> = {
  exploding: "Exploding",
  trending: "Trending",
  growing: "Growing",
  low: "Low",
};
