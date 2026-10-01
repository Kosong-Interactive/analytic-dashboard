import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TrendingScore } from "@analytic-dashboard/analytics";
import type { GameHistory } from "@analytic-dashboard/db";

import { buildGameDetail, formatInstallRange } from "./view-model";

const asOf = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

function snapshot(d: number, overrides: Partial<GameHistory["snapshots"][number]> = {}) {
  return {
    capturedAt: daysAgo(d),
    rating: 4.5,
    ratingCount: 1000,
    reviewCount: null,
    minInstalls: 100_000,
    maxInstalls: 500_000,
    price: 0,
    currency: "USD",
    version: "1.0",
    ...overrides,
  };
}

function history(overrides: Partial<GameHistory> = {}): GameHistory {
  return {
    listing: {
      storeAppId: "s1",
      appId: "a1",
      store: "google_play",
      externalId: "com.example",
      country: "id",
      locale: "id_ID",
      title: "Example",
      description: null,
      developerName: "Dev",
      storeCategory: "GAME_PUZZLE",
      releaseDate: null,
      currentVersion: "1.1",
      iconUrl: null,
      storeUrl: "https://example.com",
      firstSeenAt: daysAgo(10),
      lastSeenAt: daysAgo(0),
    },
    snapshots: [snapshot(10), snapshot(5, { ratingCount: 1500, rating: null }), snapshot(1, { ratingCount: 1800 })],
    ranks: [
      { chartType: "TOP_FREE", category: "GAME", capturedAt: daysAgo(10), rank: 20 },
      { chartType: "GROSSING", category: "GAME", capturedAt: daysAgo(5), rank: 3 },
      { chartType: "TOP_FREE", category: "GAME", capturedAt: daysAgo(1), rank: 12 },
    ],
    siblings: [],
    ...overrides,
  };
}

const score: TrendingScore = {
  id: "s1",
  formulaVersion: "trend_score_v1",
  score: 72,
  weightCoverage: 0.7,
  components: [{ component: "rankGain7d", raw: 8, normalized: 0.9, weight: 0.3, contribution: 38 }],
  reason: null,
  cohort: "google_play:id",
  cohortSize: 12,
  latestObservationAt: daysAgo(1),
};

describe("buildGameDetail", () => {
  it("builds series per measure and keeps only the selected chart for rank", () => {
    const view = buildGameDetail({ history: history(), score, rankChartType: "TOP_FREE", asOf });

    assert.deepEqual(view.series.ratingCount.map((p) => p.value), [1000, 1500, 1800]);
    // The missing rating is skipped, not drawn as zero.
    assert.deepEqual(view.series.rating.map((p) => p.value), [4.5, 4.5]);
    assert.deepEqual(view.series.rank.map((p) => p.value), [20, 12]);
    assert.equal(view.latest.rank?.rank, 12);
    assert.equal(view.score.tier, "trending");
    assert.ok(Math.abs((view.historyDays ?? 0) - 10) < 1e-9);
  });

  it("lists observations newest first with install ranges", () => {
    const view = buildGameDetail({ history: history(), score, rankChartType: "TOP_FREE", asOf });

    assert.deepEqual(view.observations[0]?.capturedAt, daysAgo(1));
    assert.equal(view.observations[0]?.installs, "100K–500K");
  });

  it("explains a missing score and missing history", () => {
    const view = buildGameDetail({
      history: history({ snapshots: [], ranks: [] }),
      score: undefined,
      rankChartType: "TOP_FREE",
      asOf,
    });

    assert.equal(view.score.value, null);
    assert.equal(view.score.tier, null);
    assert.ok(view.score.note);
    assert.equal(view.series.rankChartType, null);
    assert.equal(view.historyDays, null);
    assert.equal(view.latest.rating, null);
  });
});

describe("buildGameDetail price", () => {
  it("reports the latest price with its snapshot time and the changes in between", () => {
    const view = buildGameDetail({
      history: history({
        snapshots: [
          snapshot(10, { price: 4.99, currency: "USD" }),
          snapshot(6, { price: 4.99, currency: "USD" }),
          snapshot(3, { price: 2.99, currency: "USD" }),
          snapshot(1, { price: 2.99, currency: "USD" }),
        ],
      }),
      score,
      rankChartType: "TOP_FREE",
      asOf,
    });

    assert.equal(view.price.current?.price, 2.99);
    assert.equal(view.price.current?.currency, "USD");
    assert.deepEqual(view.price.current?.capturedAt, daysAgo(1));
    assert.deepEqual(view.price.changes, [{ at: daysAgo(3), from: 4.99, to: 2.99, currency: "USD" }]);
  });

  it("keeps an unknown price null instead of free, and has no change from it", () => {
    const view = buildGameDetail({
      history: history({ snapshots: [snapshot(5, { price: 4.99, currency: "USD" }), snapshot(1, { price: null, currency: null })] }),
      score,
      rankChartType: "TOP_FREE",
      asOf,
    });
    assert.equal(view.price.current?.price, null);
    assert.deepEqual(view.price.changes, []);
  });

  it("has no current price without observations", () => {
    const view = buildGameDetail({ history: history({ snapshots: [] }), score: undefined, rankChartType: "TOP_FREE", asOf });
    assert.equal(view.price.current, null);
  });
});

describe("formatInstallRange", () => {
  it("never shows an exact download number", () => {
    assert.equal(formatInstallRange(100_000, 500_000), "100K–500K");
    assert.equal(formatInstallRange(1_000_000, null), "1M+");
    assert.equal(formatInstallRange(1_500_000, 1_500_000), "1.5M+");
    assert.equal(formatInstallRange(null, 500), null);
  });
});
