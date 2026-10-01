import type { PlatformLabelComparison, PlatformLabelSignal } from "./platform-labels.js";

export const PLATFORM_OPPORTUNITY_MODES = [
  "confirmed_cross_platform",
  "steam_to_mobile",
  "mobile_to_steam",
  "conflicting",
  "steam_only",
  "mobile_only",
  "insufficient",
] as const;

export type PlatformOpportunityMode = (typeof PLATFORM_OPPORTUNITY_MODES)[number];

export interface PlatformOpportunityConfig {
  version: string;
  /** Platform that is "desktop" in this comparison; every other compared platform is mobile. */
  desktopPlatform: string;
  /** Momentum percentile at or above which a side counts as strong. */
  strongAt: number;
  /** Percentile at or below which a side counts as weak. */
  weakAt: number;
  /** A platform is thin on a label when its share of tracked games is below this fraction of the strong side's share. */
  thinShareRatio: number;
  /** Tracked games a platform needs before the label counts as established there. */
  minMembers: number;
}

export const PLATFORM_OPPORTUNITY_V1: PlatformOpportunityConfig = {
  version: "platform_opportunity_v1",
  desktopPlatform: "steam",
  strongAt: 0.6,
  weakAt: 0.4,
  thinShareRatio: 0.5,
  minMembers: 3,
};

export type SignalConfidence = "low" | "medium" | "high";

export interface PlatformOpportunity {
  key: string;
  mode: PlatformOpportunityMode;
  /** Momentum percentile of the desktop side, or `null` when not measurable. */
  desktopStrength: number | null;
  /** Mean momentum percentile of the measured mobile stores, or `null` when none is measurable. */
  mobileStrength: number | null;
  /** Plain-language evidence for the mode, including what could not be measured. */
  reasons: string[];
  /**
   * Low with one measured platform, medium with two, high with three or more. Coverage is about how
   * many platforms contributed, so an unavailable platform lowers confidence but is never evidence against.
   */
  confidence: SignalConfidence;
  measured: number;
  total: number;
  formulaVersion: string;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Names the cross-platform situation of one label from its per-platform signals. Percentiles are
 * only ever compared as within-platform ranks, an unavailable or unmeasured platform is missing
 * (never a negative), and a mode that needs a measured side says so in `reasons` when it is absent.
 */
export function classifyPlatformOpportunity(
  comparison: PlatformLabelComparison,
  availablePlatforms: readonly string[],
  config: PlatformOpportunityConfig = PLATFORM_OPPORTUNITY_V1,
): PlatformOpportunity {
  const desktopAvailable = availablePlatforms.includes(config.desktopPlatform);
  const mobileAvailable = availablePlatforms.filter((platform) => platform !== config.desktopPlatform);
  const desktop: PlatformLabelSignal | undefined = comparison.platforms[config.desktopPlatform];
  const mobile = mobileAvailable.flatMap((platform) => {
    const signal = comparison.platforms[platform];
    return signal ? [signal] : [];
  });

  const desktopStrength = desktop?.momentumPercentile ?? null;
  const mobileStrength = mean(mobile.flatMap((signal) => (signal.momentumPercentile === null ? [] : [signal.momentumPercentile])));

  const established = (signal: PlatformLabelSignal | undefined) => signal !== undefined && signal.members >= config.minMembers;
  /**
   * No games, too few games, or a share of the platform's tracked games below a fraction of the
   * share the label has on the strong side. A small genre is not thin just because other genres are larger.
   */
  const thin = (signal: PlatformLabelSignal | undefined, strongSideShare: number) =>
    signal === undefined || signal.members < config.minMembers || signal.share < strongSideShare * config.thinShareRatio;
  const desktopShare = desktop?.share ?? 0;
  const mobileShare = Math.max(0, ...mobile.map((signal) => signal.share));

  const desktopEstablished = established(desktop);
  const mobileEstablished = mobile.some((signal) => established(signal));
  const desktopThin = desktopAvailable && thin(desktop, mobileShare);
  // Thin on mobile only counts when every mobile store that could be loaded is thin.
  const mobileThin = mobileAvailable.length > 0 && mobileAvailable.every((platform) => thin(comparison.platforms[platform], desktopShare));

  const desktopStrong = desktopStrength !== null && desktopStrength >= config.strongAt;
  const mobileStrong = mobileStrength !== null && mobileStrength >= config.strongAt;
  const desktopWeak = desktopStrength !== null && desktopStrength <= config.weakAt;
  const mobileWeak = mobileStrength !== null && mobileStrength <= config.weakAt;

  const reasons: string[] = [];
  const pct = (value: number | null) => (value === null ? "not measurable yet" : `top ${Math.max(1, Math.round((1 - value) * 100))}%`);
  reasons.push(`Steam momentum: ${desktopAvailable ? pct(desktopStrength) : "platform unavailable"}`);
  reasons.push(`Mobile momentum: ${mobileAvailable.length === 0 ? "platforms unavailable" : pct(mobileStrength)}`);

  let mode: PlatformOpportunityMode;
  if (desktopStrong && mobileStrong) {
    mode = "confirmed_cross_platform";
    reasons.push("Strong on both Steam and mobile");
  } else if ((desktopStrong && mobileWeak) || (mobileStrong && desktopWeak)) {
    mode = "conflicting";
    reasons.push("One side is strong while the other is weak, so the pattern may be platform-specific");
  } else if (desktopStrong && mobileThin) {
    mode = "steam_to_mobile";
    reasons.push("Strong on Steam but thinly represented on the tracked mobile stores");
  } else if (mobileStrong && desktopThin) {
    mode = "mobile_to_steam";
    reasons.push("Strong on mobile but thinly represented on Steam");
  } else if (desktopEstablished && !mobileEstablished) {
    mode = "steam_only";
    reasons.push("Tracked on Steam only");
  } else if (mobileEstablished && !desktopEstablished) {
    mode = "mobile_only";
    reasons.push("Tracked on mobile only");
  } else {
    mode = "insufficient";
    reasons.push(desktopEstablished || mobileEstablished ? "No clear signal on the measured platforms yet" : "Too few tracked games on any platform");
  }

  return {
    key: comparison.key,
    mode,
    desktopStrength,
    mobileStrength,
    reasons,
    confidence: comparison.measured >= 3 ? "high" : comparison.measured === 2 ? "medium" : "low",
    measured: comparison.measured,
    total: comparison.total,
    formulaVersion: config.version,
  };
}
