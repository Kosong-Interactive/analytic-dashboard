const DAY_MS = 86_400_000;

export const OPPORTUNITY_HISTORY_VERSION = "opportunity_history_v1";

export type OpportunityHistoryConfidenceBand = "low" | "medium" | "high";

export interface OpportunityHistoryPoint {
  id: string;
  asOf: Date;
  score: number | null;
  confidence: number;
  confidenceBand: OpportunityHistoryConfidenceBand;
  insightType: string | null;
  comparableIds: readonly string[];
  counterSignals: readonly string[];
}

export interface OpportunityHistoryConfig {
  version: string;
  windows: readonly [30, 90];
  readyCoverageRatio: number;
  durableScoreThreshold: number;
  materialScoreDelta: number;
  accelerationWindowDays: number;
  materialAccelerationDelta: number;
}

export const OPPORTUNITY_HISTORY_V1: OpportunityHistoryConfig = {
  version: OPPORTUNITY_HISTORY_VERSION,
  windows: [30, 90],
  readyCoverageRatio: 0.8,
  durableScoreThreshold: 60,
  materialScoreDelta: 10,
  accelerationWindowDays: 7,
  materialAccelerationDelta: 3,
};

export interface OpportunityDurabilityWindow {
  windowDays: 30 | 90;
  status: "ready" | "collecting" | "unavailable";
  observedDays: number;
  daysUntilReady: number;
  sampleCount: number;
  averageScore: number | null;
  scoreChange: number | null;
  durableShare: number | null;
}

export interface OpportunityAcceleration {
  status: "ready" | "collecting" | "unavailable";
  direction: "accelerating" | "steady" | "decelerating" | null;
  value: number | null;
  recentChange: number | null;
  previousChange: number | null;
  requiredHistoryDays: number;
}

export interface OpportunityMaterialChange {
  key: string;
  severity: "high" | "medium";
  kind:
    | "score_available"
    | "score_unavailable"
    | "score_change"
    | "confidence_change"
    | "insight_change"
    | "counter_signal_added"
    | "comparables_changed";
  title: string;
  detail: string;
  asOf: Date;
}

export interface OpportunityHistoryAnalysis {
  version: string;
  points: OpportunityHistoryPoint[];
  windows: OpportunityDurabilityWindow[];
  acceleration: OpportunityAcceleration;
  alerts: OpportunityMaterialChange[];
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scored(points: readonly OpportunityHistoryPoint[]): Array<OpportunityHistoryPoint & { score: number }> {
  return points.filter((point): point is OpportunityHistoryPoint & { score: number } => point.score !== null);
}

function durabilityWindow(
  points: readonly OpportunityHistoryPoint[],
  current: OpportunityHistoryPoint,
  windowDays: 30 | 90,
  config: OpportunityHistoryConfig,
): OpportunityDurabilityWindow {
  const cutoff = current.asOf.getTime() - windowDays * DAY_MS;
  const withinWindow = points.filter((point) => point.asOf.getTime() >= cutoff);
  const measured = scored(withinWindow);
  const oldest = points[0];
  const observedDays = oldest
    ? Math.min(windowDays, Math.max(0, (current.asOf.getTime() - oldest.asOf.getTime()) / DAY_MS))
    : 0;
  const requiredDays = windowDays * config.readyCoverageRatio;
  const daysUntilReady = Math.max(0, Math.ceil(requiredDays - observedDays));

  if (measured.length === 0) {
    return {
      windowDays,
      status: observedDays < requiredDays ? "collecting" : "unavailable",
      observedDays: round(observedDays),
      daysUntilReady,
      sampleCount: measured.length,
      averageScore: null,
      scoreChange: null,
      durableShare: null,
    };
  }

  if (current.score === null) {
    return {
      windowDays,
      status: "unavailable",
      observedDays: round(observedDays),
      daysUntilReady,
      sampleCount: measured.length,
      averageScore: round(measured.reduce((sum, point) => sum + point.score, 0) / measured.length),
      scoreChange: null,
      durableShare: round(measured.filter((point) => point.score >= config.durableScoreThreshold).length / measured.length, 3),
    };
  }

  const earliest = measured[0];
  const averageScore = measured.reduce((sum, point) => sum + point.score, 0) / measured.length;
  const durable = measured.filter((point) => point.score >= config.durableScoreThreshold).length;

  return {
    windowDays,
    status: observedDays >= requiredDays && measured.length >= 2 ? "ready" : "collecting",
    observedDays: round(observedDays),
    daysUntilReady,
    sampleCount: measured.length,
    averageScore: round(averageScore),
    scoreChange: earliest ? round(current.score - earliest.score) : null,
    durableShare: round(durable / measured.length, 3),
  };
}

function pointAtOrBefore(
  points: readonly (OpportunityHistoryPoint & { score: number })[],
  timestamp: number,
): (OpportunityHistoryPoint & { score: number }) | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point && point.asOf.getTime() <= timestamp) return point;
  }
  return null;
}

function acceleration(
  points: readonly OpportunityHistoryPoint[],
  current: OpportunityHistoryPoint,
  config: OpportunityHistoryConfig,
): OpportunityAcceleration {
  const measured = scored(points);
  if (measured.length === 0) {
    return {
      status: points.length > 0 ? "collecting" : "unavailable",
      direction: null,
      value: null,
      recentChange: null,
      previousChange: null,
      requiredHistoryDays: config.accelerationWindowDays * 2,
    };
  }
  if (current.score === null) {
    return {
      status: "unavailable",
      direction: null,
      value: null,
      recentChange: null,
      previousChange: null,
      requiredHistoryDays: config.accelerationWindowDays * 2,
    };
  }

  const windowMs = config.accelerationWindowDays * DAY_MS;
  const recentBaseline = pointAtOrBefore(measured, current.asOf.getTime() - windowMs);
  const previousBaseline = pointAtOrBefore(measured, current.asOf.getTime() - windowMs * 2);
  if (!recentBaseline || !previousBaseline) {
    return {
      status: "collecting",
      direction: null,
      value: null,
      recentChange: null,
      previousChange: null,
      requiredHistoryDays: config.accelerationWindowDays * 2,
    };
  }

  const recentChange = current.score - recentBaseline.score;
  const previousChange = recentBaseline.score - previousBaseline.score;
  const value = recentChange - previousChange;
  let direction: OpportunityAcceleration["direction"] = "steady";
  if (value >= config.materialAccelerationDelta) direction = "accelerating";
  else if (value <= -config.materialAccelerationDelta) direction = "decelerating";

  return {
    status: "ready",
    direction,
    value: round(value),
    recentChange: round(recentChange),
    previousChange: round(previousChange),
    requiredHistoryDays: config.accelerationWindowDays * 2,
  };
}

function materialChanges(
  previous: OpportunityHistoryPoint | undefined,
  current: OpportunityHistoryPoint,
  config: OpportunityHistoryConfig,
): OpportunityMaterialChange[] {
  if (!previous) return [];
  const alerts: OpportunityMaterialChange[] = [];
  const add = (alert: Omit<OpportunityMaterialChange, "asOf">) => alerts.push({ ...alert, asOf: current.asOf });

  if (previous.score === null && current.score !== null) {
    add({ key: "score-available", severity: "high", kind: "score_available", title: "Opportunity became measurable", detail: `Opportunity Score is now ${Math.round(current.score)}.` });
  } else if (previous.score !== null && current.score === null) {
    add({ key: "score-unavailable", severity: "high", kind: "score_unavailable", title: "Opportunity is no longer measurable", detail: "The latest run could not produce an Opportunity Score; missing evidence was not converted to zero." });
  } else if (previous.score !== null && current.score !== null) {
    const delta = current.score - previous.score;
    if (Math.abs(delta) >= config.materialScoreDelta) {
      add({
        key: "score-change",
        severity: Math.abs(delta) >= config.materialScoreDelta * 2 ? "high" : "medium",
        kind: "score_change",
        title: delta > 0 ? "Opportunity Score rose materially" : "Opportunity Score fell materially",
        detail: `${delta > 0 ? "+" : ""}${round(delta)} points since the previous research run.`,
      });
    }
  }

  if (previous.confidenceBand !== current.confidenceBand) {
    add({ key: "confidence-change", severity: "medium", kind: "confidence_change", title: "Research Confidence band changed", detail: `${previous.confidenceBand} to ${current.confidenceBand} (${Math.round(current.confidence * 100)}%).` });
  }
  if (previous.insightType !== current.insightType) {
    add({ key: "insight-change", severity: "medium", kind: "insight_change", title: "Research interpretation changed", detail: `${previous.insightType ?? "pending"} to ${current.insightType ?? "pending"}.` });
  }

  // Evidence sentences contain live values. Compare their structure so a one-point numeric move
  // does not look like a brand-new risk category.
  const signalFingerprint = (signal: string) => signal.toLowerCase().replace(/\d+(?:\.\d+)?%?/g, "#").replace(/\s+/g, " ").trim();
  const previousCounterSignals = new Set(previous.counterSignals.map(signalFingerprint));
  const addedCounterSignals = current.counterSignals.filter((signal) => !previousCounterSignals.has(signalFingerprint(signal)));
  if (addedCounterSignals.length > 0) {
    add({ key: "counter-signal-added", severity: "medium", kind: "counter_signal_added", title: "New counter-signal observed", detail: addedCounterSignals.slice(0, 2).join(" ") });
  }

  const previousComparableIds = new Set(previous.comparableIds.slice(0, 3));
  const currentComparableIds = new Set(current.comparableIds.slice(0, 3));
  const changedComparables = [...currentComparableIds].filter((id) => !previousComparableIds.has(id)).length
    + [...previousComparableIds].filter((id) => !currentComparableIds.has(id)).length;
  if (changedComparables >= 2) {
    add({ key: "comparables-changed", severity: "medium", kind: "comparables_changed", title: "Leading comparable games changed", detail: "The top comparable set differs materially from the previous run." });
  }

  return alerts;
}

/**
 * Deterministic history over immutable opportunity snapshots. Points must represent the same
 * storefront, market, opportunity key, formula, and taxonomy version before they reach here.
 */
export function analyzeOpportunityHistory(
  input: readonly OpportunityHistoryPoint[],
  config: OpportunityHistoryConfig = OPPORTUNITY_HISTORY_V1,
): OpportunityHistoryAnalysis {
  const points = [...input]
    .filter((point) => Number.isFinite(point.confidence))
    .sort((left, right) => left.asOf.getTime() - right.asOf.getTime());
  const current = points.at(-1);
  if (!current) {
    return {
      version: config.version,
      points: [],
      windows: config.windows.map((windowDays) => ({ windowDays, status: "unavailable", observedDays: 0, daysUntilReady: Math.ceil(windowDays * config.readyCoverageRatio), sampleCount: 0, averageScore: null, scoreChange: null, durableShare: null })),
      acceleration: { status: "unavailable", direction: null, value: null, recentChange: null, previousChange: null, requiredHistoryDays: config.accelerationWindowDays * 2 },
      alerts: [],
    };
  }

  return {
    version: config.version,
    points,
    windows: config.windows.map((windowDays) => durabilityWindow(points, current, windowDays, config)),
    acceleration: acceleration(points, current, config),
    alerts: materialChanges(points.at(-2), current, config),
  };
}
