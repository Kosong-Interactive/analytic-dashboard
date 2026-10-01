import type { PlatformLabelSignal, PlatformOpportunityMode, SignalConfidence } from "@analytic-dashboard/analytics";

import {
  buildPlatformComparison,
  COMPARED_PLATFORMS,
  compareTypeValues,
  type ComparedPlatform,
  type CompareType,
  type PlatformComparisonRow,
  type PlatformDataset,
} from "./platform-compare";

/** Modes worth surfacing as a research direction; "only" and "no clear signal" stay on the comparison page. */
export const OPPORTUNITY_MODES: readonly PlatformOpportunityMode[] = ["confirmed_cross_platform", "steam_to_mobile", "mobile_to_steam"];

const MODE_PRIORITY: Partial<Record<PlatformOpportunityMode, number>> = {
  confirmed_cross_platform: 3,
  steam_to_mobile: 2,
  mobile_to_steam: 2,
};
const CONFIDENCE_RANK: Record<SignalConfidence, number> = { high: 3, medium: 2, low: 1 };
/** Fewer tracked games than this on the strong side is called out as a small cohort. */
const SMALL_COHORT = 6;

export interface SteamOpportunityCard {
  key: string;
  type: CompareType;
  slug: string;
  displayName: string;
  mode: PlatformOpportunityMode;
  confidence: SignalConfidence;
  measured: number;
  total: number;
  reasons: string[];
  /** Risks and counter-signals, including what could not be measured. */
  caveats: string[];
  platforms: PlatformComparisonRow["platforms"];
}

export interface SteamOpportunityList {
  cards: SteamOpportunityCard[];
  /** Candidate labels that reached an opportunity mode, before the display limit. */
  candidates: number;
  /** Labels assessed across all types. */
  assessed: number;
  /** Platforms that could be loaded. */
  available: ComparedPlatform[];
  /** Whether any mobile platform had a measurable momentum for any label. */
  mobileMeasured: boolean;
}

function strongSideMembers(row: PlatformComparisonRow): number {
  const steam = row.platforms.steam?.members ?? 0;
  const mobile = Math.max(0, ...(["google_play", "app_store"] as const).map((p) => row.platforms[p]?.members ?? 0));
  return row.opportunity.mode === "mobile_to_steam" ? mobile : row.opportunity.mode === "steam_to_mobile" ? steam : Math.min(steam, mobile);
}

function caveatsFor(row: PlatformComparisonRow, available: readonly ComparedPlatform[]): string[] {
  const caveats: string[] = [];
  const { opportunity } = row;
  if (opportunity.measured < opportunity.total) {
    caveats.push(`Only ${opportunity.measured} of ${opportunity.total} platforms could be measured; the rest is missing, not negative.`);
  }
  if (opportunity.mode === "steam_to_mobile" && opportunity.mobileStrength === null) {
    caveats.push("Mobile momentum is not measurable yet, so this is a one-sided signal from Steam.");
  }
  if (opportunity.mode === "mobile_to_steam" && opportunity.desktopStrength === null) {
    caveats.push("Steam momentum is not measurable yet, so this is a one-sided signal from mobile.");
  }
  const members = strongSideMembers(row);
  if (members < SMALL_COHORT) caveats.push(`Small cohort: only ${members} tracked games on the strong side.`);
  const missing = COMPARED_PLATFORMS.filter((platform) => !available.includes(platform));
  if (missing.length > 0) caveats.push(`${missing.join(", ")} could not be loaded.`);
  caveats.push("Tracked games are a sample from charts and seeds, not the full catalogue.");
  return caveats;
}

/**
 * Cross-platform research directions drawn from labels of every type. Ranked by mode, then
 * confidence, then the strength of the strong side, then how many games back it. Each card carries
 * its caveats; nothing here is a recommendation or a prediction.
 */
export function selectOpportunities(input: {
  datasets: Record<ComparedPlatform, PlatformDataset>;
  asOf: Date;
  limit?: number;
}): SteamOpportunityList {
  const { datasets, asOf, limit = 5 } = input;
  const available = COMPARED_PLATFORMS.filter((platform) => datasets[platform].available);
  const rows = compareTypeValues.flatMap((type) =>
    buildPlatformComparison({ datasets, type, sort: "coverage", asOf }).rows,
  );

  const candidates = rows.filter((row) => OPPORTUNITY_MODES.includes(row.opportunity.mode));
  const strength = (row: PlatformComparisonRow) =>
    Math.max(row.opportunity.desktopStrength ?? 0, row.opportunity.mobileStrength ?? 0);
  candidates.sort(
    (a, b) =>
      (MODE_PRIORITY[b.opportunity.mode] ?? 0) - (MODE_PRIORITY[a.opportunity.mode] ?? 0) ||
      CONFIDENCE_RANK[b.opportunity.confidence] - CONFIDENCE_RANK[a.opportunity.confidence] ||
      strength(b) - strength(a) ||
      strongSideMembers(b) - strongSideMembers(a) ||
      a.displayName.localeCompare(b.displayName),
  );

  return {
    cards: candidates.slice(0, limit).map((row) => ({
      key: row.key,
      type: row.type,
      slug: row.slug,
      displayName: row.displayName,
      mode: row.opportunity.mode,
      confidence: row.opportunity.confidence,
      measured: row.opportunity.measured,
      total: row.opportunity.total,
      reasons: row.opportunity.reasons,
      caveats: caveatsFor(row, available),
      platforms: row.platforms,
    })),
    candidates: candidates.length,
    assessed: rows.length,
    available: [...available],
    mobileMeasured: rows.some((row) => row.opportunity.mobileStrength !== null),
  };
}

export interface EvidenceGame {
  id: string;
  title: string;
  href: string;
  score: number | null;
}

export interface PlatformEvidence {
  platform: ComparedPlatform;
  available: boolean;
  signal: PlatformLabelSignal | undefined;
  /** Highest-scored games first; unscored games last. */
  games: EvidenceGame[];
}

export interface LabelEvidence {
  row: PlatformComparisonRow;
  caveats: string[];
  platforms: PlatformEvidence[];
}

const EVIDENCE_GAMES = 5;

/** The full picture behind one label: per-platform signals and the comparable games that carry it. */
export function buildLabelEvidence(input: {
  datasets: Record<ComparedPlatform, PlatformDataset>;
  type: CompareType;
  slug: string;
  asOf: Date;
}): LabelEvidence | null {
  const { datasets, type, slug, asOf } = input;
  const available = COMPARED_PLATFORMS.filter((platform) => datasets[platform].available);
  const row = buildPlatformComparison({ datasets, type, sort: "coverage", asOf }).rows.find((candidate) => candidate.slug === slug);
  if (!row) return null;

  const platforms = COMPARED_PLATFORMS.map((platform): PlatformEvidence => {
    const dataset = datasets[platform];
    const scoreById = new Map(dataset.games.map((game) => [game.id, game.score]));
    const members = dataset.membership.filter((member) => member.type === type && member.slug === slug);
    const games = [...new Set(members.map((member) => member.gameId))].flatMap((id): EvidenceGame[] => {
      const detail = dataset.details?.get(id);
      return detail ? [{ id, title: detail.title, href: detail.href, score: scoreById.get(id) ?? null }] : [];
    });
    games.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.title.localeCompare(b.title));
    return { platform, available: dataset.available, signal: row.platforms[platform], games: games.slice(0, EVIDENCE_GAMES) };
  });

  return { row, caveats: caveatsFor(row, available), platforms };
}
