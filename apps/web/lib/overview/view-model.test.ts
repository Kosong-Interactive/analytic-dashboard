import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TrendingScore } from "@analytic-dashboard/analytics";

import {
  buildOverview,
  STALE_AFTER_MS,
  type OverviewCandidate,
  type OverviewSourceHealth,
} from "./view-model";

const asOf = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(asOf.getTime() - h * 3_600_000);

function candidate(id: string, overrides: Partial<OverviewCandidate> = {}): OverviewCandidate {
  return {
    storeAppId: id,
    store: "google_play",
    country: "id",
    title: `Game ${id}`,
    developerName: "Dev",
    storeCategory: "GAME_PUZZLE",
    storeUrl: `https://example.com/${id}`,
    releaseDate: null,
    firstSeenAt: hoursAgo(72),
    snapshots: [{ capturedAt: hoursAgo(1), rating: 4.5, ratingCount: 1000 }],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
    ...overrides,
  };
}

function score(id: string, value: number | null): TrendingScore {
  return {
    id,
    formulaVersion: "trend_score_v1",
    score: value,
    weightCoverage: value === null ? 0.1 : 0.7,
    components: [
      { component: "ratingCountVelocity7d", raw: 12.5, normalized: 0.9, weight: 0.15, contribution: 10 },
      { component: "rankGain7d", raw: null, normalized: null, weight: 0.3, contribution: null },
    ],
    reason: null,
    cohort: "google_play:id",
    cohortSize: 3,
    latestObservationAt: hoursAgo(1),
  };
}

const health = (overrides: Partial<OverviewSourceHealth> = {}): OverviewSourceHealth => ({
  source: "google_play",
  country: "id",
  jobType: "discovery.chart",
  latestStatus: "succeeded",
  latestErrorCount: 0,
  lastCollectedAt: hoursAgo(2),
  ...overrides,
});

describe("buildOverview", () => {
  it("ranks scored games by score and leaves unscored games out of the ranking", () => {
    const data = buildOverview({
      candidates: [candidate("a"), candidate("b"), candidate("c")],
      scores: [score("a", 40), score("b", 85), score("c", null)],
      health: [health()],
      asOf,
    });

    assert.deepEqual(data.trending.map((row) => row.id), ["b", "a"]);
    assert.equal(data.trending[0]?.tier, "exploding");
    assert.equal(data.trending[0]?.rank, 1);
    assert.equal(data.kpis.tracked, 3);
    assert.equal(data.kpis.scoredCount, 2);
    assert.equal(data.kpis.trendingCount, 1);
  });

  it("keeps missing components as null instead of zero", () => {
    const data = buildOverview({
      candidates: [candidate("a")],
      scores: [score("a", 70)],
      health: [],
      asOf,
    });

    assert.equal(data.trending[0]?.rankChange, null);
    assert.equal(data.trending[0]?.ratingCountPerDay, 12.5);
  });

  it("reports an empty ranking with the history collected so far", () => {
    const data = buildOverview({
      candidates: [candidate("a", { snapshots: [{ capturedAt: hoursAgo(30), rating: 4, ratingCount: 10 }] })],
      scores: [score("a", null)],
      health: [],
      asOf,
    });

    assert.equal(data.trending.length, 0);
    assert.ok(Math.abs((data.historyDays ?? 0) - 1.25) < 1e-9);
  });

  it("counts newly discovered games within 24 hours and lists the newest first", () => {
    const data = buildOverview({
      candidates: [
        candidate("old"),
        candidate("new", { firstSeenAt: hoursAgo(3) }),
        candidate("newer", { firstSeenAt: hoursAgo(1) }),
      ],
      scores: [],
      health: [],
      asOf,
    });

    assert.equal(data.kpis.newlyDiscovered24h, 2);
    assert.deepEqual(data.discovered.map((row) => row.id), ["newer", "new", "old"]);
  });

  it("classifies source freshness", () => {
    const stale = new Date(asOf.getTime() - STALE_AFTER_MS - 60_000);
    const data = buildOverview({
      candidates: [],
      scores: [],
      health: [
        health(),
        health({ jobType: "b", lastCollectedAt: stale }),
        health({ jobType: "c", latestStatus: "failed" }),
        health({ jobType: "d", lastCollectedAt: null, latestStatus: "running" }),
      ],
      asOf,
    });

    assert.deepEqual(data.sources.map((s) => s.state), ["fresh", "stale", "failed", "never"]);
    assert.deepEqual(data.kpis.lastCollectedAt, hoursAgo(2));
  });
});
