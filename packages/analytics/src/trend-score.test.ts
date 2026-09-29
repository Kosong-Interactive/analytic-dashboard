import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeRawComponents,
  scoreCohort,
  TREND_COMPONENTS,
  TREND_SCORE_V1,
  type RawComponents,
} from "./trend-score.js";
import type { Observation } from "./velocity.js";

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n));
const series = (...values: Array<number | null>): Observation[] =>
  values.map((value, index) => ({ capturedAt: day(index * 4), value }));

function raw(overrides: Partial<RawComponents>): RawComponents {
  return {
    rankGain7d: null,
    reviewVelocity7d: null,
    ratingCountVelocity7d: null,
    countryBreadthGrowth: null,
    discoveryRecency: null,
    ratingMomentum: null,
    ...overrides,
  };
}

describe("trend_score_v1 weights", () => {
  it("sum to one", () => {
    const total = TREND_COMPONENTS.reduce(
      (sum, name) => sum + TREND_SCORE_V1.weights[name],
      0,
    );
    assert.ok(Math.abs(total - 1) < 1e-9);
  });
});

describe("computeRawComponents", () => {
  const base = {
    rankObservations: series(20, 10),
    reviewCountObservations: series(100, 180),
    ratingCountObservations: series(1000, 1400),
    ratingObservations: series(4.0, 4.2),
    countryBreadth: { current: 2, previous: 1 },
    firstSeenAt: day(0),
    asOf: day(15),
  };

  it("derives each component from observations", () => {
    const result = computeRawComponents(base);

    assert.equal(result.rankGain7d, 10);
    assert.equal(result.reviewVelocity7d, 20);
    assert.equal(result.ratingCountVelocity7d, 100);
    assert.equal(result.countryBreadthGrowth, 1);
    assert.equal(result.discoveryRecency, 0.5);
    assert.ok(Math.abs((result.ratingMomentum ?? 0) - 0.2) < 1e-9);
  });

  it("leaves unmeasurable components null instead of zero", () => {
    const result = computeRawComponents({
      ...base,
      rankObservations: [],
      countryBreadth: null,
      reviewCountObservations: series(100, null),
    });

    assert.equal(result.rankGain7d, null);
    assert.equal(result.countryBreadthGrowth, null);
    assert.equal(result.reviewVelocity7d, null);
  });

  it("gives no recency credit beyond the horizon", () => {
    const result = computeRawComponents({ ...base, asOf: day(90) });
    assert.equal(result.discoveryRecency, 0);
  });
});

describe("scoreCohort", () => {
  const fullMember = (rank: number) => ({
    rankGain7d: rank,
    reviewVelocity7d: rank,
    ratingCountVelocity7d: rank,
    countryBreadthGrowth: rank,
    discoveryRecency: 1,
    ratingMomentum: rank,
  });

  it("orders members and lets contributions add up to the score", () => {
    const results = scoreCohort([
      { id: "low", raw: raw(fullMember(1)) },
      { id: "mid", raw: raw(fullMember(2)) },
      { id: "high", raw: raw(fullMember(3)) },
    ]);
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));

    assert.equal(byId.high?.score, 100 * 0.9 + 10);
    assert.equal(byId.low?.score, 10);
    assert.equal(byId.high?.formulaVersion, "trend_score_v1");
    for (const result of results) {
      const sum = result.components.reduce((s, c) => s + (c.contribution ?? 0), 0);
      assert.ok(Math.abs(sum - (result.score ?? 0)) < 1e-9);
    }
  });

  it("rescales over measurable components and reports coverage", () => {
    const only = (value: number) =>
      raw({ reviewVelocity7d: value, ratingCountVelocity7d: value, discoveryRecency: 1 });
    const results = scoreCohort([
      { id: "a", raw: only(1) },
      { id: "b", raw: only(2) },
      { id: "c", raw: only(3) },
    ]);
    const top = results[2];

    assert.ok(top);
    assert.ok(Math.abs(top.weightCoverage - 0.5) < 1e-9);
    // (0.25 + 0.15 + 0.10 * 1) / 0.5 of the way to 100.
    assert.ok(Math.abs((top.score ?? 0) - 100) < 1e-9);
    assert.equal(
      top.components.find((c) => c.component === "rankGain7d")?.contribution,
      null,
    );
  });

  it("gives no score when too little weight is measurable", () => {
    const results = scoreCohort([
      { id: "a", raw: raw({ discoveryRecency: 1 }) },
      { id: "b", raw: raw({ discoveryRecency: 0.5 }) },
      { id: "c", raw: raw({ discoveryRecency: 0.2 }) },
    ]);

    for (const result of results) {
      assert.equal(result.score, null);
      assert.match(result.reason ?? "", /measurable/);
    }
  });

  it("does not normalize a cohort smaller than the minimum", () => {
    const results = scoreCohort([
      { id: "a", raw: raw(fullMember(1)) },
      { id: "b", raw: raw(fullMember(2)) },
    ]);

    // Only recency (weight 0.10) remains measurable, below the coverage floor.
    assert.deepEqual(results.map((r) => r.score), [null, null]);
  });

  it("is deterministic regardless of member order", () => {
    const members = [1, 2, 3, 4].map((n) => ({ id: `g${n}`, raw: raw(fullMember(n)) }));
    const forward = scoreCohort(members);
    const backward = scoreCohort([...members].reverse());

    for (const result of forward) {
      assert.equal(backward.find((r) => r.id === result.id)?.score, result.score);
    }
  });
});
