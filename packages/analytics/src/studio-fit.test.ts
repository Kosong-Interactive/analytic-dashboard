import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreStudioFit } from "./studio-fit.js";

const opportunity = {
  store: "google_play",
  marketScore: 80,
  dimensions: [
    { type: "genre", slug: "puzzle", displayName: "Puzzle" },
    { type: "core_mechanic", slug: "matching", displayName: "Matching" },
  ],
};

describe("scoreStudioFit", () => {
  it("keeps fit pending when only platform support is measurable", () => {
    const result = scoreStudioFit({ version: 1, supportedPlatforms: ["google_play"], preferredLabels: [], avoidedLabels: [] }, opportunity);
    assert.equal(result.score, null);
    assert.equal(result.coverage, 0.4);
    assert.equal(result.recommendationPriority, null);
  });

  it("scores explicit preferences and keeps Market Opportunity separate", () => {
    const result = scoreStudioFit(
      { version: 2, supportedPlatforms: ["google_play"], preferredLabels: ["genre:puzzle"], avoidedLabels: [] },
      opportunity,
    );
    assert.equal(result.score, 100);
    assert.equal(result.coverage, 1);
    assert.equal(result.recommendationPriority, 87);
    assert.deepEqual(result.positives, ["Target platform is supported by the studio profile", "Puzzle is explicitly preferred"]);
  });

  it("makes an avoided direction a visible gap instead of hiding it", () => {
    const result = scoreStudioFit(
      { version: 1, supportedPlatforms: ["google_play"], preferredLabels: [], avoidedLabels: ["core_mechanic:matching"] },
      opportunity,
    );
    assert.equal(result.score, 40);
    assert.ok(result.gaps.some((line) => line.includes("Matching")));
  });

  it("keeps Recommendation Priority pending without a Market Opportunity score", () => {
    const result = scoreStudioFit(
      { version: 1, supportedPlatforms: ["google_play"], preferredLabels: ["genre:puzzle"], avoidedLabels: [] },
      { ...opportunity, marketScore: null },
    );
    assert.equal(result.score, 100);
    assert.equal(result.recommendationPriority, null);
  });
});
