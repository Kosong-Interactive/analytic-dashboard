const DAY_MS = 86_400_000;

/** A dated metric reading. `null` means "not reported", which is never treated as zero. */
export interface Observation {
  capturedAt: Date;
  value: number | null;
}

export interface WindowedChangeOptions {
  windowDays: number;
  /** Shortest usable history as a share of the window; shorter spans would overstate the rate. */
  minSpanRatio?: number;
}

export type WindowedChange =
  | {
      status: "ok";
      delta: number;
      perDay: number;
      spanDays: number;
      from: { capturedAt: Date; value: number };
      to: { capturedAt: Date; value: number };
    }
  | { status: "insufficient_history"; reason: string };

/**
 * Change between the latest reading and the last reading at or before the window start.
 * With less history than the window, the earliest reading is used only if it covers enough of it.
 */
export function windowedChange(
  observations: readonly Observation[],
  { windowDays, minSpanRatio = 0.5 }: WindowedChangeOptions,
): WindowedChange {
  if (!(windowDays > 0)) {
    throw new RangeError("windowDays must be positive");
  }

  const readings = observations
    .flatMap((observation) =>
      observation.value === null || !Number.isFinite(observation.value)
        ? []
        : [{ capturedAt: observation.capturedAt, value: observation.value }],
    )
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  const to = readings.at(-1);
  if (!to || readings.length < 2) {
    return { status: "insufficient_history", reason: "fewer than two readings" };
  }

  const windowStart = to.capturedAt.getTime() - windowDays * DAY_MS;
  const from =
    [...readings].reverse().find((r) => r.capturedAt.getTime() <= windowStart) ??
    readings[0];
  if (!from) {
    return { status: "insufficient_history", reason: "fewer than two readings" };
  }

  const spanDays = (to.capturedAt.getTime() - from.capturedAt.getTime()) / DAY_MS;
  if (spanDays <= 0 || spanDays < windowDays * minSpanRatio) {
    return {
      status: "insufficient_history",
      reason: `history covers ${spanDays.toFixed(1)} of ${windowDays} days`,
    };
  }

  const delta = to.value - from.value;
  return { status: "ok", delta, perDay: delta / spanDays, spanDays, from, to };
}
