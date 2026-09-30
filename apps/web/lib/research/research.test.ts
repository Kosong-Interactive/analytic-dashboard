import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOpportunitiesView,
  type ResearchRunInput,
  type StoredOpportunityInput,
  type StoredOpportunityPreviewInput,
} from "./view-model";
import { opportunityDecisionSchema } from "./decision-input";
import {
  buildOpportunityDetailView,
  type StoredOpportunityDecisionInput,
  type StoredOpportunityDetailInput,
} from "./detail-view-model";
import { storedStudioProfileSchema, studioProfileSchema } from "./studio-profile";
import { buildResearchBriefView } from "./research-brief-view";

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

function preview(overrides: Partial<StoredOpportunityPreviewInput> = {}): StoredOpportunityPreviewInput {
  return { ...stored("preview"), score: null, reason: "Demand history is not measurable yet", ...overrides };
}

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

  it("shows one real unscored cohort as a preview without marking research ready", () => {
    const view = buildOpportunitiesView({
      opportunities: [],
      preview: preview(),
      runs: [run({ opportunitiesScored: 0, historyDays: 0.9 })],
      limit: 5,
    });
    assert.equal(view.state.kind, "awaiting_scores");
    assert.equal(view.preview?.title, "Puzzle + Matching");
    assert.equal(view.preview?.reason, "Demand history is not measurable yet");
    assert.equal(view.preview?.browseHref, "/games?genre=puzzle&mechanic=matching&platform=google_play");
  });

  it("does not show a preview alongside scored opportunities or when its evidence is malformed", () => {
    const ready = buildOpportunitiesView({ opportunities: [stored("ready")], preview: preview(), runs: [run()], limit: 5 });
    assert.equal(ready.preview, null);

    const malformed = buildOpportunitiesView({
      opportunities: [],
      preview: preview({ dimensions: [] }),
      runs: [run({ opportunitiesScored: 0 })],
      limit: 5,
    });
    assert.equal(malformed.preview, null);
  });
});

function detail(overrides: Partial<StoredOpportunityDetailInput> = {}): StoredOpportunityDetailInput {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
    store: "google_play",
    country: "id",
    asOf,
    formulaVersion: "opportunity_score_v1",
    taxonomyVersion: "taxonomy-v1",
    windowDays: 7,
    trackedGames: 100,
    historyDays: 5,
    freshness: "fresh",
    opportunityKey: "genre:puzzle+core_mechanic:matching",
    dimensions: [
      { type: "genre", slug: "puzzle", displayName: "Puzzle" },
      { type: "core_mechanic", slug: "matching", displayName: "Matching" },
    ],
    memberCount: 12,
    score: 72.4,
    reason: null,
    weightCoverage: 0.8,
    confidence: 0.65,
    confidenceBand: "medium",
    insightType: "build_opportunity",
    components: [
      { component: "demandMomentum", raw: 61, normalized: 0.8, weight: 0.3, contribution: 30 },
      { component: "studioFit", raw: null, normalized: null, weight: 0.1, contribution: null },
    ],
    facts: {
      scoredMembers: 9,
      medianTrendScore: 61,
      newEntrants: 3,
      newEntrantsWithMomentum: 2,
      catalogueShare: 0.12,
      topThreeRatingShare: 0.45,
      medianRating: 4.3,
      otherStorePercentile: 0.7,
    },
    comparables: [
      { id: "game-1", title: "Match Town", trendScore: 80, rating: 4.5, ratingCount: 1000, releaseDate: "2026-09-01T00:00:00.000Z" },
    ],
    positives: ["Demand is rising"],
    counterSignals: ["Competition exists"],
    caveats: ["Sampled catalogue only"],
    ...overrides,
  };
}

const decision: StoredOpportunityDecisionInput = {
  id: "decision-1",
  status: "shortlisted",
  note: "Validate with a paper prototype",
  owner: "Design team",
  actor: "team@example.com",
  createdAt: new Date("2026-10-11T02:00:00Z"),
};

describe("buildOpportunityDetailView", () => {
  it("builds a full evidence view and keeps the newest decision current", () => {
    const view = buildOpportunityDetailView(detail(), [decision]);
    assert.equal(view?.title, "Puzzle + Matching");
    assert.equal(view?.components[0]?.label, "Demand momentum");
    assert.equal(view?.comparables[0]?.releaseDate?.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(view?.currentDecision?.status, "shortlisted");
  });

  it("supports an unscored candidate without converting missing evidence to zero", () => {
    const view = buildOpportunityDetailView(
      detail({ score: null, reason: "demand is not measurable yet", components: [{ component: "demandMomentum", raw: null, normalized: null, weight: 0.3, contribution: null }] }),
      [],
    );
    assert.equal(view?.score, null);
    assert.equal(view?.components[0]?.normalized, null);
    assert.equal(view?.pendingReason, "demand is not measurable yet");
  });

  it("rejects malformed stored evidence", () => {
    assert.equal(buildOpportunityDetailView(detail({ facts: {} }), []), null);
  });
});

describe("opportunityDecisionSchema", () => {
  it("trims optional text and validates the three decision states", () => {
    const parsed = opportunityDecisionSchema.parse({
      opportunityId: "00000000-0000-4000-8000-000000000001",
      status: "prototype",
      note: "  Test a vertical slice  ",
      owner: "  Core team  ",
    });
    assert.deepEqual(parsed, {
      opportunityId: "00000000-0000-4000-8000-000000000001",
      status: "prototype",
      note: "Test a vertical slice",
      owner: "Core team",
    });
  });

  it("rejects invalid ids and decision states", () => {
    assert.equal(opportunityDecisionSchema.safeParse({ opportunityId: "bad", status: "maybe", note: "", owner: "" }).success, false);
  });
});

const studioProfile = {
  teamSize: "6",
  targetDurationMonths: "9",
  supportedPlatforms: ["google_play"],
  inputMethods: ["touch"],
  capability2d: "strong",
  capability3d: "basic",
  onlineBackendCapability: "none",
  contentProductionCapability: "strong",
  liveOpsCapability: "basic",
  monetizationCapabilities: ["ads", "in_app_purchases"],
  preferredLabels: ["genre:puzzle"],
  avoidedLabels: ["theme:horror"],
};

describe("studioProfileSchema", () => {
  it("coerces numeric form fields and keeps explicit team constraints", () => {
    const parsed = studioProfileSchema.parse(studioProfile);
    assert.equal(parsed.teamSize, 6);
    assert.equal(parsed.targetDurationMonths, 9);
    assert.deepEqual(parsed.preferredLabels, ["genre:puzzle"]);
  });

  it("rejects a direction selected as both preferred and avoided", () => {
    const parsed = studioProfileSchema.safeParse({
      ...studioProfile,
      avoidedLabels: ["genre:puzzle"],
    });
    assert.equal(parsed.success, false);
  });

  it("validates stored version metadata without dropping overlap validation", () => {
    const parsed = storedStudioProfileSchema.safeParse({
      ...studioProfile,
      id: "00000000-0000-4000-8000-000000000001",
      version: 1,
      createdBy: "team@example.com",
      createdAt: new Date("2026-09-30T00:00:00Z"),
    });
    assert.equal(parsed.success, true);
  });
});

describe("buildResearchBriefView", () => {
  const storedBrief = {
    id: "brief-1",
    promptVersion: "research-brief-v1",
    model: "fake-model",
    createdAt: new Date("2026-09-30T00:00:00Z"),
    evidence: [
      { id: "market.score", label: "Market Opportunity", value: "78 of 100" },
      { id: "research.confidence", label: "Research Confidence", value: "65%" },
      { id: "risk.1", label: "Counter-signal", value: "Competition exists" },
    ],
    brief: {
      summary: { text: "Validate this signal.", evidenceIds: ["market.score"] },
      opportunitySignals: [{ text: "The score is promising.", evidenceIds: ["market.score"] }],
      counterSignals: [{ text: "Competition exists.", evidenceIds: ["risk.1"] }],
      validationQuestions: [
        { question: "Is the signal durable?", why: "Confidence is not high.", evidenceIds: ["research.confidence"] },
        { question: "Can the concept differentiate?", why: "Competition exists.", evidenceIds: ["risk.1"] },
      ],
    },
  };

  it("shows a stored brief only when every citation resolves", () => {
    assert.equal(buildResearchBriefView(storedBrief)?.summary.text, "Validate this signal.");
    assert.equal(
      buildResearchBriefView({ ...storedBrief, brief: { ...storedBrief.brief, summary: { text: "Bad", evidenceIds: ["revenue.estimate"] } } }),
      null,
    );
  });
});
