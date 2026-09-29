import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOpportunitiesView, type ResearchRunInput, type StoredOpportunityInput } from "./view-model";

const asOf = new Date("2026-10-10T02:00:00Z");

function stored(id: string, overrides: Partial<StoredOpportunityInput> = {}): StoredOpportunityInput {
  return {
    id,
    store: "google_play",
    country: "id",
    asOf,
    opportunityKey: "genre:puzzle+core_mechanic:matching",
    dimensions: [
      { type: "genre", slug: "puzzle", displayName: "Puzzle" },
      { type: "core_mechanic", slug: "matching", displayName: "Matching" },
    ],
    memberCount: 12,
    score: 72.4,
    weightCoverage: 0.78,
    confidence: 0.42,
    confidenceBand: "low",
    insightType: "build_opportunity",
    facts: { catalogueShare: 0.08, newEntrants: 3, newEntrantsWithMomentum: 2 },
    comparables: [
      { id: "a", title: "Match Town", trendScore: 80, ratingCount: 100 },
      { id: "b", title: "Gem Quest", trendScore: 70, ratingCount: 90 },
      { id: "c", title: "Candy Hop", trendScore: null, ratingCount: 10 },
      { id: "d", title: "Fourth", trendScore: null, ratingCount: 5 },
    ],
    positives: ["Median Trend Score 72 across 9 scored games", "2 of 3 recent releases gained momentum", "third"],
    counterSignals: ["Median rating 3.9"],
    caveats: ["Studio fit is not configured, so its weight is redistributed"],
    ...overrides,
  };
}

const run = (overrides: Partial<ResearchRunInput> = {}): ResearchRunInput => ({
  store: "google_play",
  status: "succeeded",
  asOf,
  cohortsEvaluated: 10,
  opportunitiesScored: 1,
  historyDays: 4,
  ...overrides,
});

describe("buildOpportunitiesView", () => {
  it("builds cards with a title, bounded evidence, comparables, and an explorer link", () => {
    const view = buildOpportunitiesView({ opportunities: [stored("o1")], runs: [run()], limit: 5 });
    const [card] = view.cards;
    assert.equal(view.state.kind, "ready");
    assert.equal(card?.title, "Puzzle + Matching");
    assert.equal(card?.insight, "Build Opportunity");
    assert.equal(card?.earlySignal, true);
    assert.equal(card?.whyNow.length, 2);
    assert.deepEqual(card?.comparables.map((c) => c.title), ["Match Town", "Gem Quest", "Candy Hop"]);
    assert.equal(card?.browseHref, "/games?genre=puzzle&mechanic=matching&platform=google_play");
  });

  it("has no explorer link for dimensions the explorer cannot filter", () => {
    const view = buildOpportunitiesView({
      opportunities: [stored("o1", { dimensions: [{ type: "theme", slug: "fantasy", displayName: "Fantasy" }], country: "us" })],
      runs: [run()],
      limit: 5,
    });
    assert.equal(view.cards[0]?.browseHref, null);
  });

  it("skips rows whose stored evidence does not parse instead of showing them half-empty", () => {
    const view = buildOpportunitiesView({
      opportunities: [stored("bad", { dimensions: [] }), stored("good")],
      runs: [run()],
      limit: 5,
    });
    assert.deepEqual(view.cards.map((c) => c.id), ["good"]);
    assert.equal(view.skipped, 1);
  });

  it("explains an empty panel: never run, failed, or waiting for demand history", () => {
    assert.equal(buildOpportunitiesView({ opportunities: [], runs: [], limit: 5 }).state.kind, "no_runs");
    assert.equal(buildOpportunitiesView({ opportunities: [], runs: [run({ status: "failed" })], limit: 5 }).state.kind, "failed");
    const waiting = buildOpportunitiesView({
      opportunities: [],
      runs: [run({ opportunitiesScored: 0, cohortsEvaluated: 98, historyDays: 0.9 }), run({ store: "app_store", opportunitiesScored: 0, cohortsEvaluated: 8, historyDays: 0.8 })],
      limit: 5,
    });
    assert.deepEqual(waiting.state, { kind: "awaiting_scores", cohorts: 106, historyDays: 0.8 });
  });
});
