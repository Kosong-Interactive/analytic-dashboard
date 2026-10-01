import {
  classifyPlatformOpportunity,
  compareLabelsAcrossPlatforms,
  computePlatformLabelSignals,
  PLATFORM_LABEL_V1,
  type PlatformGame,
  type PlatformLabelSignal,
  type PlatformOpportunity,
  type PlatformOpportunityMode,
} from "@analytic-dashboard/analytics";

export const COMPARED_PLATFORMS = ["steam", "google_play", "app_store"] as const;
export type ComparedPlatform = (typeof COMPARED_PLATFORMS)[number];

export const platformColumnLabels: Record<ComparedPlatform, string> = {
  steam: "Steam (Global)",
  google_play: "Google Play",
  app_store: "App Store",
};

export const compareTypeValues = ["genre", "subgenre", "core_mechanic", "meta_mechanic", "theme", "multiplayer_mode"] as const;
export type CompareType = (typeof compareTypeValues)[number];

export const compareTypeLabels: Record<CompareType, string> = {
  genre: "Genres",
  subgenre: "Subgenres",
  core_mechanic: "Core mechanics",
  meta_mechanic: "Meta mechanics",
  theme: "Themes",
  multiplayer_mode: "Multiplayer",
};

/** One platform's tracked games with their own trend score and their label membership. */
export interface PlatformDataset {
  games: readonly PlatformGame[];
  /** A membership row per (game, label). */
  membership: ReadonlyArray<{ gameId: string; type: string; slug: string; displayName: string }>;
  /** `false` when the platform could not be loaded, so it counts as missing rather than empty. */
  available: boolean;
  /** Title and page of each game, for evidence lists; absent when only the ranking is needed. */
  details?: ReadonlyMap<string, { title: string; href: string }>;
}

export interface PlatformComparisonRow {
  key: string;
  type: CompareType;
  slug: string;
  displayName: string;
  platforms: Partial<Record<ComparedPlatform, PlatformLabelSignal>>;
  /** Platforms whose momentum percentile could be measured for this label. */
  measured: number;
  /** Platforms that were compared and available. */
  total: number;
  /** Cross-platform situation of the label, with its evidence. */
  opportunity: PlatformOpportunity;
}

export interface PlatformComparison {
  rows: PlatformComparisonRow[];
  /** Platforms that contributed data, in display order. */
  available: ComparedPlatform[];
  formulaVersion: string;
}

export type CompareSort = "coverage" | ComparedPlatform;

export const modeLabels: Record<PlatformOpportunityMode, string> = {
  confirmed_cross_platform: "Confirmed on both",
  steam_to_mobile: "Steam → mobile",
  mobile_to_steam: "Mobile → Steam",
  conflicting: "Conflicting signals",
  steam_only: "Steam only",
  mobile_only: "Mobile only",
  insufficient: "No clear signal",
};

/** Short explanation shown with the mode, so a label is never just a tag. */
export const modeHints: Record<PlatformOpportunityMode, string> = {
  confirmed_cross_platform: "Strong momentum on Steam and on mobile",
  steam_to_mobile: "Strong on Steam, thinly represented on mobile: a possible adaptation to mobile",
  mobile_to_steam: "Strong on mobile, thinly represented on Steam: a possible adaptation to Steam",
  conflicting: "Strong on one side and weak on the other: possibly platform-specific",
  steam_only: "Tracked games exist on Steam only",
  mobile_only: "Tracked games exist on mobile only",
  insufficient: "Not enough measured evidence yet",
};

function descNullsLast(a: number | null | undefined, b: number | null | undefined): number {
  const x = a ?? null;
  const y = b ?? null;
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return y - x;
}

/**
 * Lines up each label's per-platform momentum percentile. Percentiles are computed inside each
 * platform first, so the three scores are never put on one scale; a platform with no data is
 * left out of the coverage count rather than treated as weak.
 */
export function buildPlatformComparison(input: {
  datasets: Record<ComparedPlatform, PlatformDataset>;
  type: CompareType;
  sort: CompareSort;
  asOf: Date;
  /** Keep only labels in this mode; `all` keeps every label. */
  mode?: "all" | PlatformOpportunityMode;
}): PlatformComparison {
  const { datasets, type, sort, asOf, mode = "all" } = input;
  const available = COMPARED_PLATFORMS.filter((platform) => datasets[platform].available);
  const displayNames = new Map<string, string>();

  const signals = available.flatMap((platform) => {
    const dataset = datasets[platform];
    const labelsByGame = new Map<string, string[]>();
    for (const row of dataset.membership) {
      if (row.type !== type) continue;
      const key = `${row.type}:${row.slug}`;
      displayNames.set(key, row.displayName);
      const keys = labelsByGame.get(row.gameId) ?? [];
      keys.push(key);
      labelsByGame.set(row.gameId, keys);
    }
    return computePlatformLabelSignals({ platform, games: dataset.games, labelsByGame }, asOf, PLATFORM_LABEL_V1);
  });

  const allRows = compareLabelsAcrossPlatforms(signals, available).map((comparison): PlatformComparisonRow => {
    const [labelType = type, slug = ""] = comparison.key.split(":");
    return {
      opportunity: classifyPlatformOpportunity(comparison, available),
      key: comparison.key,
      type: labelType as CompareType,
      slug,
      displayName: displayNames.get(comparison.key) ?? slug,
      platforms: comparison.platforms,
      measured: comparison.measured,
      total: comparison.total,
    };
  });

  const rows = mode === "all" ? allRows : allRows.filter((row) => row.opportunity.mode === mode);

  if (sort !== "coverage") {
    rows.sort(
      (a, b) =>
        descNullsLast(a.platforms[sort]?.momentumPercentile, b.platforms[sort]?.momentumPercentile) ||
        b.measured - a.measured ||
        a.displayName.localeCompare(b.displayName),
    );
  }
  return { rows, available: [...available], formulaVersion: PLATFORM_LABEL_V1.version };
}
