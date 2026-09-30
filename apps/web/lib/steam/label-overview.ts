import type { SteamLabelGame, SteamLabelMembershipRow } from "@analytic-dashboard/db";

import { positiveRatio } from "./format";

const TOP_GAMES = 3;

export type SteamLabelSort = "games" | "players" | "rating";

export interface SteamLabelTopGame {
  externalId: string;
  title: string;
  currentPlayers: number | null;
}

export interface SteamLabelStats {
  type: string;
  slug: string;
  displayName: string;
  games: number;
  /** Share of all tracked Steam games, 0–1. */
  share: number;
  /** Sum of current players over members that report a count; null when none do (never zero). */
  currentPlayers: number | null;
  /** Mean positive-review share of members that report reviews; null when none do. */
  averagePositive: number | null;
  onMostPlayed: number;
  topGames: SteamLabelTopGame[];
}

export interface SteamLabelOverview {
  tracked: number;
  labelled: number;
  labels: SteamLabelStats[];
}

function descNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

const sorters: Record<SteamLabelSort, (a: SteamLabelStats, b: SteamLabelStats) => number> = {
  games: (a, b) => b.games - a.games,
  players: (a, b) => descNullsLast(a.currentPlayers, b.currentPlayers),
  rating: (a, b) => descNullsLast(a.averagePositive, b.averagePositive),
};

/** Roll-up of Steam games by label. Pure: the same inputs always give the same table. */
export function buildSteamLabelOverview(input: {
  games: readonly SteamLabelGame[];
  membership: readonly SteamLabelMembershipRow[];
  sort: SteamLabelSort;
}): SteamLabelOverview {
  const byId = new Map(input.games.map((game) => [game.steamAppId, game]));
  const groups = new Map<string, { row: SteamLabelMembershipRow; members: SteamLabelGame[] }>();
  const labelled = new Set<string>();

  for (const row of input.membership) {
    const game = byId.get(row.steamAppId);
    if (!game) continue;
    labelled.add(game.steamAppId);
    const key = `${row.type}:${row.slug}`;
    const group = groups.get(key) ?? { row, members: [] };
    group.members.push(game);
    groups.set(key, group);
  }

  const tracked = input.games.length;
  const labels = [...groups.values()].map(({ row, members }): SteamLabelStats => {
    const players = members.flatMap((game) => (game.snapshot?.currentPlayers != null ? [game.snapshot.currentPlayers] : []));
    const ratios = members.flatMap((game) => {
      const ratio = positiveRatio(game.snapshot);
      return ratio === null ? [] : [ratio];
    });
    return {
      type: row.type,
      slug: row.slug,
      displayName: row.displayName,
      games: members.length,
      share: tracked === 0 ? 0 : members.length / tracked,
      currentPlayers: players.length === 0 ? null : players.reduce((sum, value) => sum + value, 0),
      averagePositive: ratios.length === 0 ? null : ratios.reduce((sum, value) => sum + value, 0) / ratios.length,
      onMostPlayed: members.filter((game) => game.mostPlayedRank !== null).length,
      topGames: [...members]
        .sort((a, b) => descNullsLast(a.snapshot?.currentPlayers ?? null, b.snapshot?.currentPlayers ?? null))
        .slice(0, TOP_GAMES)
        .map((game) => ({
          externalId: game.externalId,
          title: game.title,
          currentPlayers: game.snapshot?.currentPlayers ?? null,
        })),
    };
  });

  labels.sort((a, b) => sorters[input.sort](a, b) || b.games - a.games || a.displayName.localeCompare(b.displayName));
  return { tracked, labelled: labelled.size, labels };
}
