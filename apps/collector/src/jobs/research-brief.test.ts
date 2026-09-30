import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OpportunityDetailRow } from "@analytic-dashboard/db";

import { buildResearchBriefInput, runResearchBriefs, type ResearchBriefGenerator, type ResearchBriefStore } from "./research-brief.js";

const candidate = (score: number | null = 78): OpportunityDetailRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  store: "google_play",
  country: "id",
  asOf: new Date("2026-09-30T00:00:00Z"),
  formulaVersion: "opportunity_score_v1",
  taxonomyVersion: "taxonomy-v1",
  windowDays: 7,
  trackedGames: 100,
  historyDays: 7,
  freshness: "fresh",
  opportunityKey: "genre:puzzle",
  dimensions: [{ type: "genre", slug: "puzzle", displayName: "Puzzle" }],
  memberCount: 12,
  score,
  reason: score === null ? "Demand unavailable" : null,
  weightCoverage: 0.8,
  confidence: 0.65,
  confidenceBand: "medium",
  insightType: "build_opportunity",
  components: [],
  facts: { scoredMembers: 9, medianTrendScore: 60, newEntrants: 2, newEntrantsWithMomentum: 1, catalogueShare: 0.12, topThreeRatingShare: 0.4, medianRating: 4.3, otherStorePercentile: null },
  comparables: [{ title: "Puzzle One", trendScore: 80, rating: 4.5, ratingCount: 1000 }],
  positives: ["Demand is rising"],
  counterSignals: ["Competition exists"],
  caveats: ["Sampled catalogue only"],
});

const brief = {
  summary: { text: "Validate the signal.", evidenceIds: ["market.score"] },
  opportunitySignals: [{ text: "Demand is rising.", evidenceIds: ["positive.1"] }],
  counterSignals: [{ text: "Competition exists.", evidenceIds: ["risk.1"] }],
  validationQuestions: [
    { question: "Is demand durable?", why: "History is bounded.", evidenceIds: ["market.history"] },
    { question: "Can the concept differentiate?", why: "Competition exists.", evidenceIds: ["risk.1"] },
  ],
};

describe("buildResearchBriefInput", () => {
  it("builds bounded evidence for a scored opportunity and skips an unscored candidate", () => {
    const input = buildResearchBriefInput(candidate(), null);
    assert.equal(input?.title, "Puzzle");
    assert.ok(input?.evidence.some((item) => item.id === "risk.1"));
    assert.equal(buildResearchBriefInput(candidate(null), null), null);
  });
});

describe("runResearchBriefs", () => {
  it("creates one idempotent brief and stores the evidence snapshot", async () => {
    const records: Array<{ evidence: unknown[]; inputHash: string }> = [];
    const existing = new Set<string>();
    const store: ResearchBriefStore = {
      loadCandidates: async () => [candidate()],
      loadProfile: async () => null,
      loadExistingHashes: async () => existing,
      record: async (input) => {
        records.push(input);
        existing.add(`${input.opportunityId}:${input.inputHash}`);
        return true;
      },
    };
    const generator: ResearchBriefGenerator = { generate: async () => ({ model: "fake", brief, inputTokens: 100, outputTokens: 20 }) };
    const first = await runResearchBriefs(generator, store, { limit: 5 });
    const second = await runResearchBriefs(generator, store, { limit: 5 });
    assert.equal(first.created, 1);
    assert.equal(second.skippedExisting, 1);
    assert.ok(records[0]?.evidence.length);
  });
});
