import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeSteamRawComponents,
  scoreSteamTrending,
  steamTrendTier,
  STEAM_TREND_SCORE_V1,
  type SteamTrendCandidate,
} from "./steam-trend-score.js";

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n));
const asOf = day(14);

function candidate(id: string, overrides: Partial<SteamTrendCandidate> = {}): SteamTrendCandidate {
  return {
    id,
    firstSeenAt: day(0),
    charts: { most_played: { rank: 10, lastWeekRank: 10 }, top_sellers: null },
    snapshots: [],
    ...overrides,
  };
}

const snap = (d: number, players: number | null, total: number | null, positive: number | null = total === null ? null : Math.round(total * 0.9)) => ({
  capturedAt: day(d),
  currentPlayers: players,
  reviewTotal: total,
  reviewPositive: positive,
});

describe("computeSteamRawComponents", () => {
  it("uses the best rank movement across charts and leaves it null without a last-week rank", () => {
    const both = computeSteamRawComponents(
      candidate("a", { charts: { most_played: { rank: 5, lastWeekRank: 9 }, top_sellers: { rank: 20, lastWeekRank: 50 } } }),
      asOf,
    );
    assert.equal(both.rankGain, 30);
    const none = computeSteamRawComponents(
      candidate("b", { charts: { most_played: { rank: 5, lastWeekRank: null }, top_sellers: null } }),
      asOf,
    );
    assert.equal(none.rankGain, null);
  });

  it("measures player momentum as a relative change and review velocity per day", () => {
    const raw = computeSteamRawComponents(
      candidate("a", { snapshots: [snap(0, 1000, 500), snap(14, 3000, 1900)] }),
      asOf,
    );
    assert.equal(raw.playerMomentum7d, 2);
    assert.equal(raw.reviewVelocity7d, 100);
  });

  it("keeps history components null when there is too little history, never zero", () => {
    const raw = computeSteamRawComponents(candidate("a", { snapshots: [snap(13, 100, 50), snap(14, 120, 60)] }), asOf);
    assert.equal(raw.playerMomentum7d, null);
    assert.equal(raw.reviewVelocity7d, null);
    assert.equal(raw.sentimentMomentum7d, null);
  });

  it("scores chart breadth as a share of tracked charts, including zero when in neither", () => {
    assert.equal(
      computeSteamRawComponents(candidate("a", { charts: { most_played: { rank: 1, lastWeekRank: 1 }, top_sellers: { rank: 2, lastWeekRank: 2 } } }), asOf).chartBreadth,
      1,
    );
    assert.equal(
      computeSteamRawComponents(candidate("b", { charts: { most_played: null, top_sellers: null } }), asOf).chartBreadth,
      0,
    );
  });

  it("does not turn a missing player count into a zero base", () => {
    const raw = computeSteamRawComponents(candidate("a", { snapshots: [snap(0, 0, 10), snap(14, 500, 20)] }), asOf);
    assert.equal(raw.playerMomentum7d, null);
  });
});

describe("scoreSteamTrending", () => {
  const gainers = ["a", "b", "c", "d"].map((id, index) =>
    candidate(id, { charts: { most_played: { rank: 10, lastWeekRank: 10 + index * 10 }, top_sellers: null } }),
  );

  it("scores from rank gain alone on the first collection, with partial coverage", () => {
    const scores = scoreSteamTrending(gainers, asOf);
    const byId = new Map(scores.map((s) => [s.id, s]));
    assert.ok((byId.get("d")?.score ?? 0) > (byId.get("a")?.score ?? 0));
    assert.equal(byId.get("a")?.formulaVersion, "steam_trend_v1");
    // rank gain 0.30 + chart breadth 0.10 + discovery recency 0.10 of a total of 1.0
    assert.ok(Math.abs((byId.get("a")?.weightCoverage ?? 0) - 0.5) < 1e-9);
    assert.equal(byId.get("a")?.cohortSize, 4);
  });

  it("withholds the score when too little weight is measurable", () => {
    const sparse = ["a", "b", "c"].map((id) =>
      candidate(id, { charts: { most_played: null, top_sellers: null }, firstSeenAt: day(-60) }),
    );
    const [first] = scoreSteamTrending(sparse, asOf);
    assert.equal(first?.score, null);
    assert.match(first?.reason ?? "", /measurable/);
  });

  it("makes contributions sum to the score and keeps scores within 0–100", () => {
    for (const result of scoreSteamTrending(gainers, asOf)) {
      const sum = result.components.reduce((n, c) => n + (c.contribution ?? 0), 0);
      assert.ok(Math.abs(sum - (result.score ?? 0)) < 1e-9);
      assert.ok((result.score ?? 0) >= 0 && (result.score ?? 0) <= 100);
    }
  });

  it("gives no percentile score for a component when the cohort is too small", () => {
    const [only] = scoreSteamTrending([candidate("a")], asOf);
    assert.equal(only?.components.find((c) => c.component === "rankGain")?.normalized, null);
  });

  it("declares weights that sum to one and fixed display bands", () => {
    assert.ok(Math.abs(Object.values(STEAM_TREND_SCORE_V1.weights).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.equal(steamTrendTier(81), "exploding");
    assert.equal(steamTrendTier(61), "trending");
    assert.equal(steamTrendTier(31), "growing");
    assert.equal(steamTrendTier(30.9), "low");
  });
});
