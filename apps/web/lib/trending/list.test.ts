import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TrendingScore } from "@analytic-dashboard/analytics";

import type { OverviewCandidate } from "../overview/view-model";
import { buildTrendingList } from "./list";
import { PAGE_SIZE, parseTrendingQuery } from "./query";

const asOf = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(asOf.getTime() - h * 3_600_000);

function candidate(id: string, overrides: Partial<OverviewCandidate> = {}): OverviewCandidate {
  return {
    storeAppId: id,
    store: "google_play",
    country: "id",
    title: `Game ${id}`,
    developerName: null,
    storeCategory: null,
    iconUrl: null,
    storeUrl: "https://example.com",
    releaseDate: null,
    firstSeenAt: hoursAgo(48),
    snapshots: [{ capturedAt: hoursAgo(1), rating: 4.2, ratingCount: 100 }],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
    ...overrides,
  };
}

function score(id: string, value: number | null, perDay: number | null = null): TrendingScore {
  return {
    id,
    formulaVersion: "trend_score_v1",
    score: value,
    weightCoverage: 0.7,
    components: [
      { component: "ratingCountVelocity7d", raw: perDay, normalized: null, weight: 0.15, contribution: null },
    ],
    reason: value === null ? "not enough history" : null,
    cohort: "google_play:id",
    cohortSize: 3,
    latestObservationAt: hoursAgo(1),
  };
}

const query = (params: Record<string, string> = {}) => parseTrendingQuery(params);

describe("buildTrendingList", () => {
  const candidates = [candidate("a"), candidate("b"), candidate("c"), candidate("d")];
  const scores = [score("a", 30, 5), score("b", 90, 1), score("c", 60, 9), score("d", null)];

  it("hides unscored games by default and sorts by score", () => {
    const list = buildTrendingList({ candidates, scores, query: query() });
    assert.deepEqual(list.rows.map((r) => r.id), ["b", "c", "a"]);
    assert.deepEqual(list.rows.map((r) => r.rank), [1, 2, 3]);
    assert.equal(list.tracked, 4);
    assert.equal(list.scoredCount, 3);
  });

  it("filters by price and never counts an unknown price as free", () => {
    const priced = [
      candidate("free", { snapshots: [{ capturedAt: hoursAgo(1), rating: 4, ratingCount: 1, price: 0, currency: "USD" }] }),
      candidate("paid", { snapshots: [{ capturedAt: hoursAgo(1), rating: 4, ratingCount: 1, price: 4.99, currency: "USD" }] }),
      candidate("unknown", { snapshots: [{ capturedAt: hoursAgo(1), rating: 4, ratingCount: 1, price: null, currency: null }] }),
    ];
    const pricedScores = [score("free", 50), score("paid", 60), score("unknown", 70)];
    const ids = (price: string) =>
      buildTrendingList({ candidates: priced, scores: pricedScores, query: query({ price }) }).rows.map((r) => r.id);
    assert.deepEqual(ids("free"), ["free"]);
    assert.deepEqual(ids("paid"), ["paid"]);
    assert.deepEqual(ids("all"), ["unknown", "paid", "free"]);
  });

  it("includes unscored games last when requested", () => {
    const list = buildTrendingList({ candidates, scores, query: query({ includeUnscored: "1" }) });
    assert.deepEqual(list.rows.map((r) => r.id), ["b", "c", "a", "d"]);
    assert.equal(list.rows.at(-1)?.score, null);
  });

  it("filters by minimum score and rating", () => {
    const byScore = buildTrendingList({ candidates, scores, query: query({ minScore: "61" }) });
    assert.deepEqual(byScore.rows.map((r) => r.id), ["b"]);

    const byRating = buildTrendingList({
      candidates: [candidate("a"), candidate("z", { snapshots: [{ capturedAt: hoursAgo(1), rating: 3.1, ratingCount: 5 }] })],
      scores: [score("a", 10), score("z", 20)],
      query: query({ minRating: "4" }),
    });
    assert.deepEqual(byRating.rows.map((r) => r.id), ["a"]);
  });

  it("sorts by another key with missing values last", () => {
    const list = buildTrendingList({
      candidates,
      scores: [score("a", 30, 5), score("b", 90, null), score("c", 60, 9), score("d", null)],
      query: query({ sort: "ratings_velocity", includeUnscored: "1" }),
    });
    assert.deepEqual(list.rows.map((r) => r.id), ["c", "a", "b", "d"]);
  });

  it("paginates and clamps an out-of-range page", () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => candidate(`g${i}`));
    const manyScores = many.map((c, i) => score(c.storeAppId, 100 - i));
    const second = buildTrendingList({ candidates: many, scores: manyScores, query: query({ page: "2" }) });
    assert.equal(second.rows.length, 5);
    assert.equal(second.rows[0]?.rank, PAGE_SIZE + 1);
    assert.equal(second.pageCount, 2);

    const clamped = buildTrendingList({ candidates: many, scores: manyScores, query: query({ page: "99" }) });
    assert.equal(clamped.page, 2);
  });

  it("returns an empty first page when nothing matches", () => {
    const list = buildTrendingList({ candidates: [], scores: [], query: query() });
    assert.equal(list.rows.length, 0);
    assert.equal(list.pageCount, 1);
    assert.equal(list.page, 1);
  });
});
