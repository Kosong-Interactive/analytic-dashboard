import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPPORTUNITY_SCORE_V1,
  scoreOpportunities,
  type OpportunityGame,
  type OpportunityResult,
  type OpportunityStorefront,
} from "./opportunity.js";

const asOf = new Date("2026-10-10T00:00:00Z");
const daysAgo = (days: number) => new Date(asOf.getTime() - days * 86_400_000);

function game(
  id: string,
  labels: string[],
  overrides: Partial<Omit<OpportunityGame, "id" | "labels">> = {},
): OpportunityGame {
  return {
    id,
    title: `Game ${id}`,
    releaseDate: null,
    trendScore: null,
    rating: 4,
    ratingCount: 1000,
    inTrackedChart: false,
    labels: labels.map((label) => {
      const [type = "", slug = ""] = label.split(":");
      return { type, slug, displayName: slug, confidence: 0.9, manual: false };
    }),
    ...overrides,
  };
}

/** `count` games carrying `labels`, with the given Trend Scores in order (missing = unscored). */
function cohort(prefix: string, labels: string[], count: number, scores: Array<number | null> = []): OpportunityGame[] {
  return Array.from({ length: count }, (_, i) => game(`${prefix}${i}`, labels, { trendScore: scores[i] ?? null }));
}

function storefront(games: OpportunityGame[], overrides: Partial<OpportunityStorefront> = {}): OpportunityStorefront {
  return { store: "google_play", country: "id", games, historyDays: 7, freshness: "fresh", ...overrides };
}

const byKey = (results: OpportunityResult[]) => new Map(results.map((r) => [`${r.store}:${r.key}`, r]));

describe("scoreOpportunities cohorts", () => {
  it("evaluates single labels and label pairs with at least five members only", () => {
    const games = [
      ...cohort("p", ["genre:puzzle", "core_mechanic:matching"], 5),
      ...cohort("r", ["genre:rpg"], 4),
    ];
    const keys = scoreOpportunities([storefront(games)], { asOf }).map((r) => r.key);
    assert.deepEqual(keys, ["core_mechanic:matching", "genre:puzzle", "genre:puzzle+core_mechanic:matching"]);
  });

  it("withholds a score when demand is not measurable instead of scoring competition alone", () => {
    const games = [...cohort("a", ["genre:puzzle"], 6), ...cohort("b", ["genre:rpg"], 6), ...cohort("c", ["genre:arcade"], 6)];
    const [result] = scoreOpportunities([storefront(games)], { asOf });
    assert.equal(result?.score, null);
    assert.match(result?.reason ?? "", /demand is not measurable yet: 0 of 6 games have a Trend Score/);
    assert.equal(result?.insightType, null);
    // Measurable components are still reported, so the reader can see what exists.
    assert.notEqual(result?.components.find((c) => c.component === "competitionGap")?.normalized, null);
  });
});

describe("scoreOpportunities scoring", () => {
  const games = [
    ...cohort("hi", ["genre:puzzle"], 6, [90, 85, 80, 75, 70, 65]),
    ...cohort("mid", ["genre:rpg"], 6, [50, 45, 40, 55, 60, 35]),
    ...cohort("lo", ["genre:arcade"], 6, [10, 15, 20, 5, 25, 30]),
  ];
  const results = byKey(scoreOpportunities([storefront(games)], { asOf }));
  const puzzle = results.get("google_play:genre:puzzle");
  const arcade = results.get("google_play:genre:arcade");

  it("ranks demand by median Trend Score percentile across the storefront's cohorts", () => {
    assert.ok(puzzle && arcade && puzzle.score !== null && arcade.score !== null);
    assert.equal(puzzle.facts.medianTrendScore, 77.5);
    assert.equal(puzzle.components.find((c) => c.component === "demandMomentum")?.normalized, 1);
    assert.ok(puzzle.score > arcade.score);
  });

  it("redistributes the weight of unmeasured components and reports coverage", () => {
    assert.ok(puzzle);
    const studio = puzzle.components.find((c) => c.component === "studioFit");
    assert.equal(studio?.normalized, null);
    assert.equal(studio?.contribution, null);
    const measuredWeight = puzzle.components.filter((c) => c.normalized !== null).reduce((sum, c) => sum + c.weight, 0);
    assert.ok(Math.abs(puzzle.weightCoverage - measuredWeight) < 1e-9);
    const total = puzzle.components.reduce((sum, c) => sum + (c.contribution ?? 0), 0);
    assert.ok(Math.abs(total - (puzzle.score ?? 0)) < 1e-9);
  });

  it("keeps the formula version on every result", () => {
    assert.equal(puzzle?.formulaVersion, OPPORTUNITY_SCORE_V1.version);
  });
});

describe("scoreOpportunities evidence", () => {
  it("counts new entrants by store release date only, excluding future pre-registration dates", () => {
    const games = [
      game("n1", ["genre:puzzle"], { releaseDate: daysAgo(10), inTrackedChart: true }),
      game("n2", ["genre:puzzle"], { releaseDate: daysAgo(20), trendScore: 40 }),
      game("n3", ["genre:puzzle"], { releaseDate: daysAgo(-5) }),
      game("old", ["genre:puzzle"], { releaseDate: daysAgo(400) }),
      game("unknown", ["genre:puzzle"]),
    ];
    const [result] = scoreOpportunities([storefront(games)], { asOf });
    assert.equal(result?.facts.newEntrants, 2);
    assert.equal(result?.facts.newEntrantsWithMomentum, 2);
  });

  it("flags a cohort dominated by a few titles as Watch Carefully", () => {
    const dominated = cohort("d", ["genre:puzzle"], 6, [95, 90, 85, 80, 75, 70]).map((g, i) => ({
      ...g,
      ratingCount: i === 0 ? 1_000_000 : 10,
    }));
    const games = [...dominated, ...cohort("m", ["genre:rpg"], 6, [50, 45, 40, 55, 60, 35]), ...cohort("l", ["genre:arcade"], 6, [10, 15, 20, 5, 25, 30])];
    const result = byKey(scoreOpportunities([storefront(games)], { asOf })).get("google_play:genre:puzzle");
    assert.equal(result?.insightType, "watch_carefully");
    assert.ok(result?.counterSignals.some((line) => /dominated by a few titles/.test(line)));
  });

  it("confirms demand with the same cohort on the other store of the market", () => {
    const mk = (store: string, puzzleScores: number[]) =>
      storefront(
        [
          ...cohort(`${store}p`, ["genre:puzzle"], 6, puzzleScores),
          ...cohort(`${store}r`, ["genre:rpg"], 6, [50, 45, 40, 55, 60, 35]),
          ...cohort(`${store}a`, ["genre:arcade"], 6, [10, 15, 20, 5, 25, 30]),
        ],
        { store },
      );
    const results = byKey(scoreOpportunities([mk("google_play", [90, 85, 80, 75, 70, 65]), mk("app_store", [95, 90, 85, 80, 75, 70])], { asOf }));
    const onPlay = results.get("google_play:genre:puzzle");
    assert.equal(onPlay?.facts.otherStorePercentile, 1);
    assert.equal(onPlay?.components.find((c) => c.component === "crossStoreConfirmation")?.normalized, 1);
    assert.ok(onPlay?.positives.some((line) => /other store/.test(line)));
  });

  it("lists comparables by Trend Score, then ratings", () => {
    const games = cohort("c", ["genre:puzzle"], 7, [10, 80, null, 50, 90, null, 30]);
    const [result] = scoreOpportunities([storefront(games)], { asOf });
    assert.deepEqual(result?.comparables.map((c) => c.id), ["c4", "c1", "c3", "c6", "c0"]);
  });
});

describe("Research Confidence", () => {
  const games = [...cohort("a", ["genre:puzzle"], 20, Array(20).fill(80)), ...cohort("b", ["genre:rpg"], 6), ...cohort("c", ["genre:arcade"], 6)];

  it("is separate from the score and falls with short history and missing sources", () => {
    const full = byKey(scoreOpportunities([storefront(games)], { asOf })).get("google_play:genre:puzzle");
    const thin = byKey(scoreOpportunities([storefront(games, { historyDays: 0.5, freshness: "never" })], { asOf })).get(
      "google_play:genre:puzzle",
    );
    assert.ok(full && thin);
    assert.equal(full.confidence.factors.cohortSize, 1);
    assert.equal(thin.confidence.factors.freshness, 0);
    assert.ok(thin.confidence.value < full.confidence.value);
    assert.equal(thin.confidence.band, "low");
    assert.ok(thin.caveats.some((line) => /days of history/.test(line)));
  });

  it("gives manual confirmations full label credit", () => {
    const confirmed = games.map((g) => ({ ...g, labels: g.labels.map((l) => ({ ...l, confidence: 0.6, manual: true })) }));
    const result = byKey(scoreOpportunities([storefront(confirmed)], { asOf })).get("google_play:genre:puzzle");
    assert.equal(result?.confidence.factors.labelQuality, 1);
  });
});
