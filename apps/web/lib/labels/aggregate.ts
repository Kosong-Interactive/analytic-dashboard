import type { TrendingScore } from "@analytic-dashboard/analytics";

import type { OverviewCandidate } from "../overview/view-model";

const DAY_MS = 86_400_000;
const TOP_GAMES = 3;

export interface MembershipRow {
  storeAppId: string;
  type: string;
  slug: string;
  displayName: string;
  confidence: number;
  source: "rule" | "ai" | "manual";
}

export interface LabelTopGame {
  id: string;
  title: string;
  iconUrl: string | null;
  score: number | null;
}

export interface LabelStats {
  type: string;
  slug: string;
  displayName: string;
  games: number;
  /** Share of all tracked games in the selection, 0–1. */
  share: number;
  newlyDiscovered7d: number;
  /** Mean of members that report a rating; `null` when none do. */
  averageRating: number | null;
  scoredGames: number;
  /** Mean Trend Score of scored members; the label's momentum. `null` until members are scored. */
  momentum: number | null;
  /** Share of members labelled by a person rather than rules or AI. */
  manualShare: number;
  topGames: LabelTopGame[];
}

export interface LabelOverview {
  tracked: number;
  /** Tracked games carrying at least one label of the requested types. */
  labelled: number;
  labels: LabelStats[];
}

export type LabelSort = "games" | "momentum" | "new" | "rating";

function descNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

const sorters: Record<LabelSort, (a: LabelStats, b: LabelStats) => number> = {
  games: (a, b) => b.games - a.games,
  momentum: (a, b) => descNullsLast(a.momentum, b.momentum),
  new: (a, b) => b.newlyDiscovered7d - a.newlyDiscovered7d,
  rating: (a, b) => descNullsLast(a.averageRating, b.averageRating),
};

/** Per-label roll-up of the games in one storefront selection. Pure, so it is unit-tested. */
export function buildLabelOverview(input: {
  candidates: readonly OverviewCandidate[];
  scores: readonly TrendingScore[];
  membership: readonly MembershipRow[];
  sort: LabelSort;
  asOf: Date;
}): LabelOverview {
  const { candidates, scores, membership, sort, asOf } = input;
  const candidateById = new Map(candidates.map((c) => [c.storeAppId, c]));
  const scoreById = new Map(scores.map((s) => [s.id, s.score]));

  const groups = new Map<string, { row: MembershipRow; members: Map<string, MembershipRow> }>();
  for (const row of membership) {
    if (!candidateById.has(row.storeAppId)) continue;
    const key = `${row.type}:${row.slug}`;
    const group = groups.get(key) ?? { row, members: new Map() };
    group.members.set(row.storeAppId, row);
    groups.set(key, group);
  }

  const labels = [...groups.values()].map(({ row, members }): LabelStats => {
    const games = [...members.keys()].flatMap((id) => {
      const candidate = candidateById.get(id);
      return candidate ? [candidate] : [];
    });
    const ratings = games.flatMap((game) => {
      const rating = latestRating(game);
      return rating === null ? [] : [rating];
    });
    const memberScores = games.flatMap((game) => {
      const score = scoreById.get(game.storeAppId);
      return score === null || score === undefined ? [] : [score];
    });
    const manual = [...members.values()].filter((m) => m.source === "manual").length;

    return {
      type: row.type,
      slug: row.slug,
      displayName: row.displayName,
      games: games.length,
      share: candidates.length === 0 ? 0 : games.length / candidates.length,
      newlyDiscovered7d: games.filter((g) => asOf.getTime() - g.firstSeenAt.getTime() <= 7 * DAY_MS).length,
      averageRating: ratings.length === 0 ? null : ratings.reduce((a, b) => a + b, 0) / ratings.length,
      scoredGames: memberScores.length,
      momentum: memberScores.length === 0 ? null : memberScores.reduce((a, b) => a + b, 0) / memberScores.length,
      manualShare: members.size === 0 ? 0 : manual / members.size,
      topGames: [...games]
        .sort(
          (a, b) =>
            descNullsLast(scoreById.get(a.storeAppId) ?? null, scoreById.get(b.storeAppId) ?? null) ||
            descNullsLast(latestRatingCount(a), latestRatingCount(b)) ||
            a.title.localeCompare(b.title),
        )
        .slice(0, TOP_GAMES)
        .map((game) => ({
          id: game.storeAppId,
          title: game.title,
          iconUrl: game.iconUrl,
          score: scoreById.get(game.storeAppId) ?? null,
        })),
    };
  });

  labels.sort((a, b) => sorters[sort](a, b) || b.games - a.games || a.displayName.localeCompare(b.displayName));

  return {
    tracked: candidates.length,
    labelled: new Set(membership.filter((m) => candidateById.has(m.storeAppId)).map((m) => m.storeAppId)).size,
    labels,
  };
}

function latest(candidate: OverviewCandidate) {
  return [...candidate.snapshots].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
}

function latestRating(candidate: OverviewCandidate): number | null {
  return latest(candidate)?.rating ?? null;
}

function latestRatingCount(candidate: OverviewCandidate): number | null {
  return latest(candidate)?.ratingCount ?? null;
}
