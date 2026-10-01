import { percentileRanks } from "./normalize.js";

const DAY_MS = 86_400_000;

export interface PlatformLabelConfig {
  version: string;
  /** Scored members a label needs before its momentum counts; fewer means one title defines it. */
  minScoredMembers: number;
  /** Labels with a momentum a platform needs before percentiles are meaningful. */
  minLabelsForPercentile: number;
  /** A member first observed within this many days counts as a new entrant. */
  newEntrantDays: number;
}

export const PLATFORM_LABEL_V1: PlatformLabelConfig = {
  version: "platform_label_v1",
  minScoredMembers: 3,
  minLabelsForPercentile: 5,
  newEntrantDays: 7,
};

/** One game of one platform. `score` is that platform's own trend score, never rescaled. */
export interface PlatformGame {
  id: string;
  score: number | null;
  firstSeenAt: Date;
}

export interface PlatformLabelInput {
  /** `google_play`, `app_store`, or `steam`. Scores are only ranked inside one platform. */
  platform: string;
  games: readonly PlatformGame[];
  /** Label keys (`type:slug`) per game id. */
  labelsByGame: ReadonlyMap<string, readonly string[]>;
}

export interface PlatformLabelSignal {
  platform: string;
  /** `type:slug`. */
  key: string;
  members: number;
  /** Share of all tracked games of this platform, 0–1. */
  share: number;
  scoredMembers: number;
  /** Median trend score of scored members; `null` when too few are scored. */
  momentum: number | null;
  /** Percentile of `momentum` among this platform's labels, 0–1; `null` when not comparable. */
  momentumPercentile: number | null;
  /** Percentile of `share` among this platform's labels, 0–1; `null` when too few labels. */
  sharePercentile: number | null;
  newEntrants: number;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const low = sorted[middle - 1];
  const high = sorted[middle];
  if (high === undefined) return null;
  return sorted.length % 2 === 1 ? high : low === undefined ? high : (low + high) / 2;
}

/**
 * Per-label signals inside one platform, with percentiles computed against that platform's other
 * labels only. This is what makes platforms comparable: a Steam score and a Google Play score are
 * never put on one scale, but "top fifth of labels on Steam" and "top fifth on Google Play" can be
 * set side by side. Median momentum keeps one viral title from defining a label.
 */
export function computePlatformLabelSignals(
  input: PlatformLabelInput,
  asOf: Date,
  config: PlatformLabelConfig = PLATFORM_LABEL_V1,
): PlatformLabelSignal[] {
  const total = input.games.length;
  const membersByKey = new Map<string, PlatformGame[]>();
  const gameById = new Map(input.games.map((game) => [game.id, game]));
  for (const [gameId, keys] of input.labelsByGame) {
    const game = gameById.get(gameId);
    if (!game) continue;
    for (const key of new Set(keys)) {
      const members = membersByKey.get(key) ?? [];
      members.push(game);
      membersByKey.set(key, members);
    }
  }

  const rows = [...membersByKey].map(([key, members]) => {
    const scores = members.flatMap((member) => (member.score === null ? [] : [member.score]));
    return {
      key,
      members: members.length,
      share: total === 0 ? 0 : members.length / total,
      scoredMembers: scores.length,
      momentum: scores.length >= config.minScoredMembers ? median(scores) : null,
      newEntrants: members.filter((member) => asOf.getTime() - member.firstSeenAt.getTime() <= config.newEntrantDays * DAY_MS).length,
    };
  });

  const momentumPercentiles = percentileRanks(
    rows.map((row) => row.momentum),
    config.minLabelsForPercentile,
  );
  const sharePercentiles = percentileRanks(
    rows.map((row) => row.share),
    config.minLabelsForPercentile,
  );

  return rows.map((row, index) => ({
    platform: input.platform,
    ...row,
    momentumPercentile: momentumPercentiles[index] ?? null,
    sharePercentile: sharePercentiles[index] ?? null,
  }));
}

export interface PlatformLabelComparison {
  key: string;
  /** Signals by platform; a platform with no member of this label has no entry. */
  platforms: Record<string, PlatformLabelSignal>;
  /** Platforms with at least one member of this label. */
  present: number;
  /** Platforms whose momentum could be measured for this label. */
  measured: number;
  /** Platforms compared, so coverage reads "measured of total". */
  total: number;
}

/**
 * Lines the per-platform signals up by label. An unavailable platform is missing, not negative:
 * `measured` and `total` say how many platforms actually contributed.
 */
export function compareLabelsAcrossPlatforms(
  signals: readonly PlatformLabelSignal[],
  platforms: readonly string[],
): PlatformLabelComparison[] {
  const byKey = new Map<string, Record<string, PlatformLabelSignal>>();
  for (const signal of signals) {
    const row = byKey.get(signal.key) ?? {};
    row[signal.platform] = signal;
    byKey.set(signal.key, row);
  }
  return [...byKey]
    .map(([key, row]) => ({
      key,
      platforms: row,
      present: platforms.filter((platform) => row[platform] !== undefined).length,
      measured: platforms.filter((platform) => row[platform]?.momentumPercentile != null).length,
      total: platforms.length,
    }))
    .sort((a, b) => b.measured - a.measured || b.present - a.present || a.key.localeCompare(b.key));
}
