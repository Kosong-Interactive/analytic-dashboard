import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SNAPSHOT_HEARTBEAT_MS,
  decideSnapshotWrite,
  type SnapshotObservation,
} from "./snapshot-policy";

const start = new Date("2026-09-29T00:00:00.000Z");

function observation(
  overrides: Partial<SnapshotObservation> = {},
): SnapshotObservation {
  return {
    capturedAt: start,
    rating: 4.78,
    ratingCount: 1000,
    reviewCount: 100,
    minInstalls: 100_000,
    maxInstalls: 500_000,
    price: 0,
    currency: "USD",
    version: "1.0.0",
    ...overrides,
  };
}

function later(milliseconds: number): Date {
  return new Date(start.getTime() + milliseconds);
}

describe("decideSnapshotWrite", () => {
  it("writes the first observation", () => {
    assert.equal(decideSnapshotWrite(null, observation()), "first");
  });

  it("skips an unchanged observation inside the heartbeat window", () => {
    const incoming = observation({ capturedAt: later(60_000) });
    assert.equal(decideSnapshotWrite(observation(), incoming), "unchanged");
  });

  it("treats provider precision beyond the stored scale as unchanged", () => {
    const incoming = observation({
      capturedAt: later(60_000),
      rating: 4.778066,
    });
    assert.equal(decideSnapshotWrite(observation(), incoming), "unchanged");
  });

  it("writes when a tracked value changes", () => {
    const incoming = observation({ capturedAt: later(60_000), reviewCount: 101 });
    assert.equal(decideSnapshotWrite(observation(), incoming), "changed");
  });

  it("distinguishes a missing value from zero", () => {
    const latest = observation({ reviewCount: 0 });
    const incoming = observation({ capturedAt: later(60_000), reviewCount: null });
    assert.equal(decideSnapshotWrite(latest, incoming), "changed");
  });

  it("detects an install range change", () => {
    const incoming = observation({
      capturedAt: later(60_000),
      maxInstalls: 1_000_000,
    });
    assert.equal(decideSnapshotWrite(observation(), incoming), "changed");
  });

  it("writes one heartbeat per day when nothing changed", () => {
    const incoming = observation({ capturedAt: later(SNAPSHOT_HEARTBEAT_MS) });
    assert.equal(decideSnapshotWrite(observation(), incoming), "heartbeat");
  });

  it("ignores an observation that is not newer than the latest", () => {
    assert.equal(
      decideSnapshotWrite(observation(), observation({ reviewCount: 500 })),
      "stale",
    );
  });
});
