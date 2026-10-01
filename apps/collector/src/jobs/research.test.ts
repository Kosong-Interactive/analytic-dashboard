import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LabelMembershipRow, OpportunityRowInput, ResearchRunInput, SourceHealthRow, TrendCandidateRow } from "@analytic-dashboard/db";

import { runResearch, toStorefront, type ResearchStore } from "./research.js";

const asOf = new Date("2026-10-10T00:00:00Z");
const hoursAgo = (hours: number) => new Date(asOf.getTime() - hours * 3_600_000);

function candidate(id: string, overrides: Partial<TrendCandidateRow> = {}): TrendCandidateRow {
  return {
    storeAppId: id,
    appId: `app-${id}`,
    store: "google_play",
    externalId: id,
    country: "id",
    locale: "id_ID",
    title: `Game ${id}`,
    developerName: null,
    iconUrl: null,
    storeUrl: "https://example.com",
    storeCategory: null,
    releaseDate: null,
    firstSeenAt: hoursAgo(200),
    lastSeenAt: hoursAgo(1),
    snapshots: [
      { capturedAt: hoursAgo(48), rating: 4.1, ratingCount: 100, reviewCount: 10, minInstalls: null, maxInstalls: null, price: null, currency: null },
      { capturedAt: hoursAgo(2), rating: 4.2, ratingCount: 120, reviewCount: 12, minInstalls: null, maxInstalls: null, price: null, currency: null },
    ],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
    ...overrides,
  };
}

function label(storeAppId: string, slug: string, source: LabelMembershipRow["source"] = "ai"): LabelMembershipRow {
  return { storeAppId, type: "genre", slug, displayName: slug, confidence: 0.9, source };
}

const health: SourceHealthRow[] = [
  {
    source: "google_play",
    country: "id",
    jobType: "discovery.chart",
    latestStatus: "succeeded",
    latestStartedAt: hoursAgo(3),
    latestErrorCount: 0,
    lastCollectedAt: hoursAgo(3),
    lastCollectedDiscoveredCount: 10,
  },
];

describe("toStorefront", () => {
  it("uses the latest snapshot, recent chart presence, resolved labels, history, and freshness", () => {
    const storefront = toStorefront({
      store: "google_play",
      country: "id",
      candidates: [candidate("a", { ranks: [{ chartType: "TOP_FREE", capturedAt: hoursAgo(5), rank: 3 }] }), candidate("b")],
      membership: [label("a", "puzzle", "manual")],
      health,
      asOf,
    });
    assert.equal(storefront.freshness, "fresh");
    assert.equal(storefront.historyDays, 2);
    const [a, b] = storefront.games;
    assert.equal(a?.rating, 4.2);
    assert.equal(a?.inTrackedChart, true);
    assert.equal(b?.inTrackedChart, false);
    assert.deepEqual(a?.labels, [{ type: "genre", slug: "puzzle", displayName: "puzzle", confidence: 0.9, manual: true }]);
  });

  it("marks a store without any collector run as never collected", () => {
    const storefront = toStorefront({ store: "app_store", country: "id", candidates: [], membership: [], health, asOf });
    assert.equal(storefront.freshness, "never");
    assert.equal(storefront.historyDays, null);
  });
});

function memoryStore(overrides: Partial<ResearchStore> = {}) {
  const runs: Array<{ run: ResearchRunInput; opportunities: OpportunityRowInput[] }> = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  const ids = Array.from({ length: 6 }, (_, i) => `g${i}`);
  const store: ResearchStore = {
    loadCandidates: async (storeId) => (storeId === "google_play" ? ids.map((id) => candidate(id)) : []),
    loadMembership: async (storeId) => (storeId === "google_play" ? ids.map((id) => label(id, "puzzle")) : []),
    loadHealth: async () => health,
    record: async (input) => {
      const key = `${input.run.store}:${input.run.country}:${input.run.inputHash}`;
      if (seen.has(key)) return { created: false };
      seen.add(key);
      runs.push(input);
      return { created: true };
    },
    recordFailure: async (input) => {
      failures.push(`${input.store}:${input.country}`);
    },
    ...overrides,
  };
  return { store, runs, failures };
}

const options = { countries: ["id"], stores: ["google_play", "app_store"] as const, taxonomyVersion: "taxonomy-v1", asOf };

describe("runResearch", () => {
  it("records one run per storefront and skips an identical rerun", async () => {
    const { store, runs } = memoryStore();
    const first = await runResearch(store, { ...options, stores: [...options.stores] });
    const again = await runResearch(store, { ...options, stores: [...options.stores] });

    assert.deepEqual(first.storefronts.map((s) => `${s.store}:${s.cohortsEvaluated}:${s.created}`), ["google_play:1:true", "app_store:0:true"]);
    assert.deepEqual(again.storefronts.map((s) => s.created), [false, false]);
    assert.equal(runs.length, 2);
    // History is short and nothing is scored yet, so the cohort is kept with a reason, not a score.
    const [cohort] = runs[0]?.opportunities ?? [];
    assert.equal(cohort?.opportunityKey, "genre:puzzle");
    assert.equal(cohort?.score, null);
    assert.match(cohort?.reason ?? "", /demand is not measurable yet/);
    assert.equal(first.errorCount, 0);
  });

  it("records a failed run per store when a market cannot be loaded, and reports the error", async () => {
    const { store, failures, runs } = memoryStore({
      loadHealth: async () => {
        throw new Error("connection lost");
      },
    });
    const summary = await runResearch(store, { ...options, stores: [...options.stores] });
    assert.deepEqual(failures, ["google_play:id", "app_store:id"]);
    assert.equal(runs.length, 0);
    assert.equal(summary.errorCount, 1);
    assert.match(summary.errorSample ?? "", /id: connection lost/);
  });
});
