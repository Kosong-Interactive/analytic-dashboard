export const SNAPSHOT_HEARTBEAT_MS = 24 * 60 * 60 * 1000;

export interface TrackedSnapshotValues {
  rating: number | null;
  ratingCount: number | null;
  reviewCount: number | null;
  minInstalls: number | null;
  maxInstalls: number | null;
  price: number | null;
  currency: string | null;
  version: string | null;
}

export interface SnapshotObservation extends TrackedSnapshotValues {
  capturedAt: Date;
}

export type SnapshotDecision =
  | "first"
  | "changed"
  | "heartbeat"
  | "unchanged"
  | "stale";

/**
 * Rating and price are stored as numeric(_, 2). Comparing and writing the same
 * rounded value keeps an unchanged listing from looking changed on every run.
 */
export function roundToStoredScale(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

export function toTrackedValues(
  observation: TrackedSnapshotValues,
): TrackedSnapshotValues {
  return {
    rating: roundToStoredScale(observation.rating),
    ratingCount: observation.ratingCount,
    reviewCount: observation.reviewCount,
    minInstalls: observation.minInstalls,
    maxInstalls: observation.maxInstalls,
    price: roundToStoredScale(observation.price),
    currency: observation.currency,
    version: observation.version,
  };
}

const trackedKeys = [
  "rating",
  "ratingCount",
  "reviewCount",
  "minInstalls",
  "maxInstalls",
  "price",
  "currency",
  "version",
] as const satisfies ReadonlyArray<keyof TrackedSnapshotValues>;

/** A missing value (`null`) is a different observation from zero. */
export function decideSnapshotWrite(
  latest: SnapshotObservation | null,
  incoming: SnapshotObservation,
  heartbeatMs: number = SNAPSHOT_HEARTBEAT_MS,
): SnapshotDecision {
  if (latest === null) {
    return "first";
  }

  const elapsedMs = incoming.capturedAt.getTime() - latest.capturedAt.getTime();
  if (elapsedMs <= 0) {
    return "stale";
  }

  const previous = toTrackedValues(latest);
  const next = toTrackedValues(incoming);
  if (trackedKeys.some((key) => previous[key] !== next[key])) {
    return "changed";
  }

  return elapsedMs >= heartbeatMs ? "heartbeat" : "unchanged";
}
