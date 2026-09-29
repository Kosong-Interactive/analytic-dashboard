import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreTrending, type TrendingCandidate } from "./trending.js";

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n));
const asOf = day(14);

function candidate(
  id: string,
  growth: number,
  overrides: Partial<TrendingCandidate> = {},
): TrendingCandidate {
  return {
    storeAppId: id,
    store: "google_play",
    country: "us",
    storeCategory: "GAME_PUZZLE",
    firstSeenAt: day(0),
    snapshots: [
      { capturedAt: day(0), rating: 4, ratingCount: 1000, reviewCount: 100 },
      {
        capturedAt: day(14),
        rating: 4,
        ratingCount: 1000 + growth * 10,
        reviewCount: 100 + growth,
      },
    ],
    ranks: [
      { chartType: "TOP_FREE", capturedAt: day(0), rank: 30 },
      { chartType: "TOP_FREE", capturedAt: day(14), rank: 30 - growth },
      { chartType: "GROSSING", capturedAt: day(14), rank: 1 },
    ],
    countryBreadth: { current: 1, previous: 1 },
    ...overrides,
  };
}

describe("scoreTrending", () => {
  it("ranks faster-growing games higher within a cohort", () => {
    const scores = scoreTrending(
      [candidate("slow", 1), candidate("mid", 5), candidate("fast", 10)],
      { asOf, rankChartType: "TOP_FREE" },
    );
    const byId = new Map(scores.map((s) => [s.id, s]));

    assert.ok((byId.get("fast")?.score ?? 0) > (byId.get("mid")?.score ?? 1));
    assert.ok((byId.get("mid")?.score ?? 0) > (byId.get("slow")?.score ?? 1));
    assert.equal(byId.get("fast")?.cohort, "google_play:us");
    assert.equal(byId.get("fast")?.cohortSize, 3);
    assert.deepEqual(byId.get("fast")?.latestObservationAt, day(14));
  });

  it("ignores other charts when measuring rank gain", () => {
    const scores = scoreTrending(
      [candidate("a", 1), candidate("b", 5), candidate("c", 10)],
      { asOf, rankChartType: "TOP_FREE" },
    );

    const rank = scores[2]?.components.find((c) => c.component === "rankGain7d");
    assert.equal(rank?.raw, 10);
  });

  it("does not count a brand-new listing as country growth", () => {
    const scores = scoreTrending(
      [
        candidate("a", 1, { countryBreadth: { current: 1, previous: 0 } }),
        candidate("b", 5),
        candidate("c", 10),
      ],
      { asOf, rankChartType: "TOP_FREE" },
    );

    const breadth = scores[0]?.components.find(
      (c) => c.component === "countryBreadthGrowth",
    );
    assert.equal(breadth?.raw, null);
  });

  it("separates cohorts by store and country, and optionally category", () => {
    const games = [
      candidate("us1", 1),
      candidate("us2", 5),
      candidate("us3", 10),
      candidate("id1", 1, { country: "id" }),
      candidate("other", 3, { storeCategory: "GAME_ACTION" }),
    ];

    const byCountry = scoreTrending(games, { asOf, rankChartType: "TOP_FREE" });
    assert.deepEqual(
      [...new Set(byCountry.map((s) => `${s.cohort}=${s.cohortSize}`))].sort(),
      ["google_play:id=1", "google_play:us=4"],
    );

    const byCategory = scoreTrending(games, {
      asOf,
      rankChartType: "TOP_FREE",
      cohortBy: "store_country_category",
    });
    assert.ok(byCategory.some((s) => s.cohort === "google_play:us:GAME_ACTION"));
  });

  it("gives no score to a game without history", () => {
    const [only] = scoreTrending(
      [candidate("new", 0, { snapshots: [], ranks: [] })],
      { asOf, rankChartType: "TOP_FREE" },
    );

    assert.equal(only?.score, null);
    assert.equal(only?.latestObservationAt, null);
  });
});
