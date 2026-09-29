import { percentileRanks } from "./normalize.js";

const DAY_MS = 86_400_000;

export const OPPORTUNITY_COMPONENTS = [
  "demandMomentum",
  "newEntrantPerformance",
  "competitionGap",
  "crossStoreConfirmation",
  "quality",
  "studioFit",
] as const;

export type OpportunityComponent = (typeof OPPORTUNITY_COMPONENTS)[number];

export type ConfidenceBand = "high" | "medium" | "low";

export type InsightType = "build_opportunity" | "emerging_pattern" | "proven_market" | "watch_carefully";

export interface OpportunityScoreConfig {
  version: string;
  weights: Record<OpportunityComponent, number>;
  /** Label types that form single-dimension opportunities. */
  singleTypes: readonly string[];
  /** Label type pairs that form two-dimension opportunities. */
  pairTypes: ReadonlyArray<readonly [string, string]>;
  /** Cohorts smaller than this are not evaluated, so tiny groups never look meaningful. */
  minCohortSize: number;
  /** Members with a value needed before a median means anything. */
  minMeasuredMembers: number;
  /** Cohorts with a value needed before percentiles across cohorts mean anything. */
  minComparableCohorts: number;
  /** A store release within this many days makes a game a new entrant. */
  newEntrantWindowDays: number;
  minNewEntrants: number;
  /** Trend Score from which a game counts as having momentum (trend_score_v1 "growing"). */
  momentumThreshold: number;
  minWeightCoverage: number;
  /** Top-three share of ratings from which a cohort counts as dominated by a few titles. */
  concentrationThreshold: number;
  confidence: {
    weights: { cohortSize: number; history: number; componentCoverage: number; freshness: number; labelQuality: number };
    /** Cohort size and history days at which those factors reach full credit. */
    fullCohortSize: number;
    fullHistoryDays: number;
    bands: { high: number; medium: number };
  };
  maxComparables: number;
}

/**
 * `opportunity_score_v1`. Studio fit has weight but no input yet, so its weight is redistributed
 * and the coverage says so. Demand momentum is required: without it a score would only describe
 * competition and ratings, which is not an opportunity. Change anything here as a new version.
 */
export const OPPORTUNITY_SCORE_V1: OpportunityScoreConfig = {
  version: "opportunity_score_v1",
  weights: {
    demandMomentum: 0.3,
    newEntrantPerformance: 0.2,
    competitionGap: 0.15,
    crossStoreConfirmation: 0.15,
    quality: 0.1,
    studioFit: 0.1,
  },
  singleTypes: ["genre", "subgenre", "core_mechanic", "theme"],
  pairTypes: [
    ["genre", "core_mechanic"],
    ["subgenre", "core_mechanic"],
  ],
  minCohortSize: 5,
  minMeasuredMembers: 3,
  minComparableCohorts: 3,
  newEntrantWindowDays: 90,
  minNewEntrants: 2,
  momentumThreshold: 31,
  minWeightCoverage: 0.4,
  concentrationThreshold: 0.8,
  confidence: {
    weights: { cohortSize: 0.25, history: 0.2, componentCoverage: 0.2, freshness: 0.15, labelQuality: 0.2 },
    fullCohortSize: 20,
    fullHistoryDays: 7,
    bands: { high: 0.75, medium: 0.5 },
  },
  maxComparables: 5,
};

export type SourceFreshness = "fresh" | "stale" | "failed" | "never";

/** Structural input, so this package never depends on the database package. */
export interface OpportunityGame {
  id: string;
  title: string;
  releaseDate: Date | null;
  /** Trend Score within its own storefront; `null` when not scored yet. */
  trendScore: number | null;
  rating: number | null;
  ratingCount: number | null;
  /** Seen in a tracked chart during the window. */
  inTrackedChart: boolean;
  labels: ReadonlyArray<{ type: string; slug: string; displayName: string; confidence: number; manual: boolean }>;
}

export interface OpportunityStorefront {
  store: string;
  country: string;
  games: readonly OpportunityGame[];
  /** Days of stored history in this storefront; `null` when nothing was observed. */
  historyDays: number | null;
  freshness: SourceFreshness;
}

export interface OpportunityDimension {
  type: string;
  slug: string;
  displayName: string;
}

export interface OpportunityComponentScore {
  component: OpportunityComponent;
  /** The cohort-level measure before normalization; `null` = not measurable (not zero). */
  raw: number | null;
  /** 0–1 across the storefront's cohorts. */
  normalized: number | null;
  weight: number;
  contribution: number | null;
}

export interface OpportunityComparable {
  id: string;
  title: string;
  trendScore: number | null;
  rating: number | null;
  ratingCount: number | null;
  releaseDate: Date | null;
}

export interface OpportunityResult {
  key: string;
  formulaVersion: string;
  store: string;
  country: string;
  dimensions: OpportunityDimension[];
  memberCount: number;
  /** 0–100, or `null` with a reason. */
  score: number | null;
  reason: string | null;
  weightCoverage: number;
  components: OpportunityComponentScore[];
  confidence: {
    value: number;
    band: ConfidenceBand;
    factors: Record<keyof OpportunityScoreConfig["confidence"]["weights"], number>;
  };
  insightType: InsightType | null;
  /** Cohort facts behind the components, for evidence and display. */
  facts: {
    scoredMembers: number;
    medianTrendScore: number | null;
    newEntrants: number;
    newEntrantsWithMomentum: number;
    catalogueShare: number;
    topThreeRatingShare: number | null;
    medianRating: number | null;
    otherStorePercentile: number | null;
  };
  comparables: OpportunityComparable[];
  positives: string[];
  counterSignals: string[];
  caveats: string[];
}

interface Cohort {
  key: string;
  dimensions: OpportunityDimension[];
  members: OpportunityGame[];
}

interface CohortMeasures {
  cohort: Cohort;
  scoredMembers: number;
  medianTrendScore: number | null;
  newEntrants: number;
  newEntrantsWithMomentum: number;
  newEntrantShare: number | null;
  catalogueShare: number;
  topThreeRatingShare: number | null;
  medianRating: number | null;
}

/**
 * Scores every sufficiently large label cohort of each storefront. Components are normalized
 * across the cohorts of the same storefront, so platforms and markets are never compared on raw
 * values. Cross-store confirmation compares the same cohort's demand percentile on another store
 * of the same market.
 */
export function scoreOpportunities(
  storefronts: readonly OpportunityStorefront[],
  { asOf, config = OPPORTUNITY_SCORE_V1 }: { asOf: Date; config?: OpportunityScoreConfig },
): OpportunityResult[] {
  const measured = storefronts.map((storefront) => ({
    storefront,
    measures: buildCohorts(storefront, config).map((cohort) => measureCohort(cohort, storefront, asOf, config)),
  }));

  const demandPercentiles = new Map<string, Map<string, number | null>>();
  for (const { storefront, measures } of measured) {
    const ranks = percentileRanks(measures.map((m) => m.medianTrendScore), config.minComparableCohorts);
    demandPercentiles.set(
      storefrontKey(storefront),
      new Map(measures.map((m, index) => [m.cohort.key, ranks[index] ?? null])),
    );
  }

  return measured.flatMap(({ storefront, measures }) => {
    const pct = (values: (number | null)[]) => percentileRanks(values, config.minComparableCohorts);
    const demand = pct(measures.map((m) => m.medianTrendScore));
    const newEntrant = pct(measures.map((m) => m.newEntrantShare));
    const catalogue = pct(measures.map((m) => m.catalogueShare));
    const concentration = pct(measures.map((m) => m.topThreeRatingShare));
    const quality = pct(measures.map((m) => m.medianRating));
    const others = storefronts.filter((other) => other.country === storefront.country && other.store !== storefront.store);

    return measures.map((m, index): OpportunityResult => {
      const gapParts = [catalogue[index], concentration[index]].flatMap((value) => (value == null ? [] : [1 - value]));
      const otherStorePercentile = bestOtherPercentile(m.cohort.key, others, demandPercentiles);
      const normalized: Record<OpportunityComponent, number | null> = {
        demandMomentum: demand[index] ?? null,
        newEntrantPerformance: newEntrant[index] ?? null,
        competitionGap: gapParts.length === 0 ? null : gapParts.reduce((a, b) => a + b, 0) / gapParts.length,
        crossStoreConfirmation: otherStorePercentile,
        quality: quality[index] ?? null,
        studioFit: null,
      };
      const raw: Record<OpportunityComponent, number | null> = {
        demandMomentum: m.medianTrendScore,
        newEntrantPerformance: m.newEntrantShare,
        competitionGap: m.topThreeRatingShare,
        crossStoreConfirmation: otherStorePercentile,
        quality: m.medianRating,
        studioFit: null,
      };
      return finish(m, storefront, raw, normalized, otherStorePercentile, config);
    });
  });
}

function storefrontKey(storefront: { store: string; country: string }): string {
  return `${storefront.store}:${storefront.country}`;
}

function bestOtherPercentile(
  key: string,
  others: readonly OpportunityStorefront[],
  demandPercentiles: Map<string, Map<string, number | null>>,
): number | null {
  const values = others.flatMap((other) => {
    const value = demandPercentiles.get(storefrontKey(other))?.get(key);
    return value == null ? [] : [value];
  });
  return values.length === 0 ? null : Math.max(...values);
}

function buildCohorts(storefront: OpportunityStorefront, config: OpportunityScoreConfig): Cohort[] {
  const cohorts = new Map<string, Cohort>();
  const add = (dimensions: OpportunityDimension[], game: OpportunityGame) => {
    const key = dimensions.map((d) => `${d.type}:${d.slug}`).join("+");
    const cohort = cohorts.get(key) ?? { key, dimensions, members: [] };
    cohort.members.push(game);
    cohorts.set(key, cohort);
  };

  for (const game of storefront.games) {
    const byType = new Map<string, OpportunityDimension[]>();
    for (const label of game.labels) {
      const list = byType.get(label.type) ?? [];
      if (!list.some((d) => d.slug === label.slug)) list.push({ type: label.type, slug: label.slug, displayName: label.displayName });
      byType.set(label.type, list);
    }
    for (const type of config.singleTypes) for (const dimension of byType.get(type) ?? []) add([dimension], game);
    for (const [first, second] of config.pairTypes) {
      for (const a of byType.get(first) ?? []) for (const b of byType.get(second) ?? []) add([a, b], game);
    }
  }

  return [...cohorts.values()]
    .filter((cohort) => cohort.members.length >= config.minCohortSize)
    .sort((a, b) => a.key.localeCompare(b.key));
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

function measureCohort(
  cohort: Cohort,
  storefront: OpportunityStorefront,
  asOf: Date,
  config: OpportunityScoreConfig,
): CohortMeasures {
  const scores = cohort.members.flatMap((g) => (g.trendScore === null ? [] : [g.trendScore]));
  const ratings = cohort.members.flatMap((g) => (g.rating === null ? [] : [g.rating]));
  const rated = cohort.members.flatMap((g) => (g.ratingCount === null ? [] : [g.ratingCount]));
  const windowStart = asOf.getTime() - config.newEntrantWindowDays * DAY_MS;
  // Store release dates only; discovery time is never used as a release.
  const entrants = cohort.members.filter((g) => {
    const time = g.releaseDate?.getTime();
    return time !== undefined && time >= windowStart && time <= asOf.getTime();
  });
  const withMomentum = entrants.filter(
    (g) => g.inTrackedChart || (g.trendScore !== null && g.trendScore >= config.momentumThreshold),
  ).length;
  const totalRatings = rated.reduce((a, b) => a + b, 0);
  const topThree = [...rated].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);

  return {
    cohort,
    scoredMembers: scores.length,
    medianTrendScore: scores.length >= config.minMeasuredMembers ? median(scores) : null,
    newEntrants: entrants.length,
    newEntrantsWithMomentum: withMomentum,
    newEntrantShare: entrants.length >= config.minNewEntrants ? withMomentum / entrants.length : null,
    catalogueShare: storefront.games.length === 0 ? 0 : cohort.members.length / storefront.games.length,
    topThreeRatingShare: rated.length >= config.minMeasuredMembers && totalRatings > 0 ? topThree / totalRatings : null,
    medianRating: ratings.length >= config.minMeasuredMembers ? median(ratings) : null,
  };
}

const freshnessCredit: Record<SourceFreshness, number> = { fresh: 1, stale: 0.5, failed: 0, never: 0 };

function finish(
  m: CohortMeasures,
  storefront: OpportunityStorefront,
  raw: Record<OpportunityComponent, number | null>,
  normalized: Record<OpportunityComponent, number | null>,
  otherStorePercentile: number | null,
  config: OpportunityScoreConfig,
): OpportunityResult {
  const totalWeight = OPPORTUNITY_COMPONENTS.reduce((sum, c) => sum + config.weights[c], 0);
  const availableWeight = OPPORTUNITY_COMPONENTS.reduce(
    (sum, c) => sum + (normalized[c] === null ? 0 : config.weights[c]),
    0,
  );
  const weightCoverage = availableWeight / totalWeight;

  let reason: string | null = null;
  if (normalized.demandMomentum === null) {
    reason =
      m.scoredMembers < config.minMeasuredMembers
        ? `demand is not measurable yet: ${m.scoredMembers} of ${m.cohort.members.length} games have a Trend Score`
        : "demand is not measurable yet: too few comparable cohorts have scored games";
  } else if (weightCoverage < config.minWeightCoverage) {
    reason = `only ${Math.round(weightCoverage * 100)}% of the score weight is measurable`;
  }
  const scorable = reason === null;

  const components = OPPORTUNITY_COMPONENTS.map((component): OpportunityComponentScore => {
    const value = normalized[component];
    const weight = config.weights[component];
    return {
      component,
      raw: raw[component],
      normalized: value,
      weight,
      contribution: scorable && value !== null ? (100 * weight * value) / availableWeight : null,
    };
  });
  const score = scorable ? components.reduce((sum, c) => sum + (c.contribution ?? 0), 0) : null;

  const labelConfidences = m.cohort.members.map((game) => {
    const defining = m.cohort.dimensions.map((d) => game.labels.find((l) => l.type === d.type && l.slug === d.slug));
    const values = defining.map((label) => (label ? (label.manual ? 1 : label.confidence) : 0));
    return values.reduce((a, b) => a + b, 0) / values.length;
  });
  const factors = {
    cohortSize: Math.min(1, m.cohort.members.length / config.confidence.fullCohortSize),
    history: storefront.historyDays === null ? 0 : Math.min(1, storefront.historyDays / config.confidence.fullHistoryDays),
    componentCoverage: weightCoverage,
    freshness: freshnessCredit[storefront.freshness],
    labelQuality: labelConfidences.reduce((a, b) => a + b, 0) / labelConfidences.length,
  };
  const weights = config.confidence.weights;
  const confidenceValue =
    (Object.keys(factors) as Array<keyof typeof factors>).reduce((sum, key) => sum + weights[key] * factors[key], 0) /
    Object.values(weights).reduce((a, b) => a + b, 0);
  const band = confidenceBand(confidenceValue, config);

  const comparables = [...m.cohort.members]
    .sort(
      (a, b) =>
        (b.trendScore ?? -1) - (a.trendScore ?? -1) || (b.ratingCount ?? -1) - (a.ratingCount ?? -1) || a.title.localeCompare(b.title),
    )
    .slice(0, config.maxComparables)
    .map(({ id, title, trendScore, rating, ratingCount, releaseDate }) => ({ id, title, trendScore, rating, ratingCount, releaseDate }));

  const facts = {
    scoredMembers: m.scoredMembers,
    medianTrendScore: m.medianTrendScore,
    newEntrants: m.newEntrants,
    newEntrantsWithMomentum: m.newEntrantsWithMomentum,
    catalogueShare: m.catalogueShare,
    topThreeRatingShare: m.topThreeRatingShare,
    medianRating: m.medianRating,
    otherStorePercentile,
  };

  return {
    key: m.cohort.key,
    formulaVersion: config.version,
    store: storefront.store,
    country: storefront.country,
    dimensions: m.cohort.dimensions,
    memberCount: m.cohort.members.length,
    score,
    reason,
    weightCoverage,
    components,
    confidence: { value: confidenceValue, band, factors },
    insightType: score === null ? null : insightType(normalized, facts, band, m.cohort.members.length, config),
    facts,
    comparables,
    ...evidence(facts, normalized, storefront, m.cohort.members.length, config),
  };
}

function confidenceBand(value: number, config: OpportunityScoreConfig): ConfidenceBand {
  if (value >= config.confidence.bands.high) return "high";
  if (value >= config.confidence.bands.medium) return "medium";
  return "low";
}

function insightType(
  normalized: Record<OpportunityComponent, number | null>,
  facts: OpportunityResult["facts"],
  band: ConfidenceBand,
  memberCount: number,
  config: OpportunityScoreConfig,
): InsightType {
  const demand = normalized.demandMomentum ?? 0;
  const gap = normalized.competitionGap;
  if (facts.topThreeRatingShare !== null && facts.topThreeRatingShare >= config.concentrationThreshold) return "watch_carefully";
  if (demand < 0.6) return "watch_carefully";
  if (band === "low" && memberCount < 2 * config.minCohortSize) return "emerging_pattern";
  if (gap !== null && gap >= 0.5) return "build_opportunity";
  return "proven_market";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function evidence(
  facts: OpportunityResult["facts"],
  normalized: Record<OpportunityComponent, number | null>,
  storefront: OpportunityStorefront,
  memberCount: number,
  config: OpportunityScoreConfig,
): Pick<OpportunityResult, "positives" | "counterSignals" | "caveats"> {
  const positives: string[] = [];
  const counterSignals: string[] = [];
  const caveats: string[] = [];

  if (facts.medianTrendScore !== null && normalized.demandMomentum !== null) {
    const line = `Median Trend Score ${Math.round(facts.medianTrendScore)} across ${facts.scoredMembers} scored games`;
    (normalized.demandMomentum >= 0.6 ? positives : counterSignals).push(line);
  }
  if (facts.newEntrants >= config.minNewEntrants) {
    const line = `${facts.newEntrantsWithMomentum} of ${facts.newEntrants} games released in the last ${config.newEntrantWindowDays} days gained momentum or a chart position`;
    (facts.newEntrantsWithMomentum > 0 ? positives : counterSignals).push(line);
  } else {
    caveats.push(`Only ${facts.newEntrants} tracked ${facts.newEntrants === 1 ? "game was" : "games were"} released in the last ${config.newEntrantWindowDays} days`);
  }
  if (facts.topThreeRatingShare !== null) {
    const line = `Top 3 games hold ${percent(facts.topThreeRatingShare)} of the cohort's ratings`;
    if (facts.topThreeRatingShare >= config.concentrationThreshold) counterSignals.push(`${line}: dominated by a few titles`);
    else positives.push(`${line}: not dominated by one title`);
  }
  if (facts.otherStorePercentile !== null) {
    const line = `Demand on the other store of this market is at the ${Math.round(facts.otherStorePercentile * 100)}th percentile`;
    (facts.otherStorePercentile >= 0.5 ? positives : counterSignals).push(line);
  }
  if (facts.medianRating !== null && normalized.quality !== null) {
    const line = `Median rating ${facts.medianRating.toFixed(1)}`;
    (normalized.quality >= 0.5 ? positives : counterSignals).push(line);
  }

  caveats.push(`Observed competition: ${memberCount} games, ${percent(facts.catalogueShare)} of the sampled catalogue, not the whole store`);
  if (storefront.historyDays === null || storefront.historyDays < config.confidence.fullHistoryDays) {
    caveats.push(`Only ${storefront.historyDays === null ? 0 : storefront.historyDays.toFixed(1)} days of history`);
  }
  if (storefront.freshness !== "fresh") caveats.push(`Source data is ${storefront.freshness === "stale" ? "stale" : "unavailable"}`);
  caveats.push("Studio fit is not configured, so its weight is redistributed");

  return { positives, counterSignals, caveats };
}
