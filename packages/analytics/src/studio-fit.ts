export const STUDIO_FIT_V1 = {
  version: "studio_fit_v1",
  weights: { platformSupport: 0.4, directionAlignment: 0.6 },
  minCoverage: 0.5,
  priority: { marketOpportunity: 0.65, studioFit: 0.35 },
} as const;

export interface StudioProfileInput {
  version: number;
  supportedPlatforms: readonly string[];
  preferredLabels: readonly string[];
  avoidedLabels: readonly string[];
}

export interface StudioFitOpportunityInput {
  store: string;
  dimensions: ReadonlyArray<{ type: string; slug: string; displayName: string }>;
  marketScore: number | null;
}

export interface StudioFitComponent {
  key: "platformSupport" | "directionAlignment";
  value: number | null;
  weight: number;
  contribution: number | null;
  evidence: string;
}

export interface StudioFitResult {
  formulaVersion: string;
  profileVersion: number;
  score: number | null;
  reason: string | null;
  coverage: number;
  components: StudioFitComponent[];
  positives: string[];
  gaps: string[];
  caveats: string[];
  recommendationPriority: number | null;
}

/**
 * Scores only explicit profile matches. Production capabilities are not inferred from taxonomy
 * labels, so an unconfigured direction remains missing rather than becoming neutral or zero.
 */
export function scoreStudioFit(
  profile: StudioProfileInput,
  opportunity: StudioFitOpportunityInput,
): StudioFitResult {
  const platformValue = profile.supportedPlatforms.includes(opportunity.store) ? 1 : 0;
  const preferred = new Set(profile.preferredLabels);
  const avoided = new Set(profile.avoidedLabels);
  const explicit = opportunity.dimensions.flatMap((dimension) => {
    const key = `${dimension.type}:${dimension.slug}`;
    if (avoided.has(key)) return [{ dimension, value: 0 }];
    if (preferred.has(key)) return [{ dimension, value: 1 }];
    return [];
  });
  const directionValue = explicit.length === 0
    ? null
    : explicit.reduce((sum, item) => sum + item.value, 0) / explicit.length;

  const values = { platformSupport: platformValue, directionAlignment: directionValue };
  const availableWeight = (Object.keys(values) as Array<keyof typeof values>)
    .reduce((sum, key) => sum + (values[key] === null ? 0 : STUDIO_FIT_V1.weights[key]), 0);
  const coverage = availableWeight;
  const reason = coverage < STUDIO_FIT_V1.minCoverage
    ? "studio fit needs at least one explicit preferred or avoided direction"
    : null;
  const scorable = reason === null;

  const components: StudioFitComponent[] = [
    {
      key: "platformSupport",
      value: platformValue,
      weight: STUDIO_FIT_V1.weights.platformSupport,
      contribution: scorable ? (100 * platformValue * STUDIO_FIT_V1.weights.platformSupport) / availableWeight : null,
      evidence: platformValue === 1 ? "The studio profile supports this platform" : "This platform is not supported by the studio profile",
    },
    {
      key: "directionAlignment",
      value: directionValue,
      weight: STUDIO_FIT_V1.weights.directionAlignment,
      contribution: scorable && directionValue !== null
        ? (100 * directionValue * STUDIO_FIT_V1.weights.directionAlignment) / availableWeight
        : null,
      evidence: explicit.length === 0
        ? "No opportunity dimension has an explicit preference or avoidance"
        : `${explicit.filter((item) => item.value === 1).length} preferred and ${explicit.filter((item) => item.value === 0).length} avoided dimensions match`,
    },
  ];
  const score = scorable ? components.reduce((sum, component) => sum + (component.contribution ?? 0), 0) : null;
  const recommendationPriority = opportunity.marketScore === null || score === null
    ? null
    : opportunity.marketScore * STUDIO_FIT_V1.priority.marketOpportunity + score * STUDIO_FIT_V1.priority.studioFit;

  const positives: string[] = [];
  const gaps: string[] = [];
  if (platformValue === 1) positives.push("Target platform is supported by the studio profile");
  else gaps.push("Target platform is not supported by the studio profile");
  for (const item of explicit) {
    const line = `${item.dimension.displayName} is explicitly ${item.value === 1 ? "preferred" : "avoided"}`;
    (item.value === 1 ? positives : gaps).push(line);
  }

  return {
    formulaVersion: STUDIO_FIT_V1.version,
    profileVersion: profile.version,
    score,
    reason,
    coverage,
    components,
    positives,
    gaps,
    caveats: [
      "Team size, schedule, art, backend, content, live-ops, input, and monetization capabilities are profile context only until an opportunity has explicit requirement evidence",
      "Recommendation Priority is a planning aid, not a forecast of profitability or commercial success",
    ],
    recommendationPriority,
  };
}
