import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateMarketOpportunities, type MarketOpportunityLike } from "./market-opportunities.js";

const priority = ["sg", "th", "vn"];

function row(country: string, score: number | null, extra: Partial<MarketOpportunityLike> = {}): MarketOpportunityLike {
  return {
    id: `${country}-${extra.opportunityKey ?? "genre:puzzle"}`,
    store: "google_play",
    country,
    opportunityKey: "genre:puzzle",
    score,
    confidence: 0.5,
    memberCount: 10,
    ...extra,
  };
}

describe("aggregateMarketOpportunities", () => {
  it("shows the storefront with the median score and counts the scored storefronts", () => {
    const [result] = aggregateMarketOpportunities([row("sg", 80), row("th", 40), row("vn", 60)], priority);
    assert.equal(result?.opportunity.country, "vn");
    assert.equal(result?.scoredStorefronts, 3);
    assert.equal(result?.evaluatedStorefronts, 3);
  });

  it("takes the lower median of an even number of scores", () => {
    const [result] = aggregateMarketOpportunities([row("sg", 80), row("th", 40)], priority);
    assert.equal(result?.opportunity.country, "th");
  });

  it("leaves unscored storefronts out of the median instead of counting zero", () => {
    const [result] = aggregateMarketOpportunities([row("sg", null), row("th", 70), row("vn", null)], priority);
    assert.equal(result?.opportunity.country, "th");
    assert.equal(result?.scoredStorefronts, 1);
    assert.equal(result?.evaluatedStorefronts, 3);
  });

  it("falls back to the storefront with the most games when nothing is scored", () => {
    const [result] = aggregateMarketOpportunities(
      [row("sg", null, { memberCount: 5 }), row("th", null, { memberCount: 30 }), row("vn", null, { memberCount: 30 })],
      priority,
    );
    assert.equal(result?.opportunity.country, "th");
    assert.equal(result?.scoredStorefronts, 0);
  });

  it("keeps a cohort that exists in only some storefronts and keeps platforms apart", () => {
    const results = aggregateMarketOpportunities(
      [row("sg", 50), row("th", 55, { store: "app_store" }), row("sg", 90, { opportunityKey: "genre:card" })],
      priority,
    );
    assert.equal(results.length, 3);
    assert.equal(results[0]?.opportunity.opportunityKey, "genre:card");
  });

  it("orders scored opportunities before unscored ones", () => {
    const results = aggregateMarketOpportunities([row("sg", null, { opportunityKey: "genre:a" }), row("sg", 10, { opportunityKey: "genre:b" })], priority);
    assert.deepEqual(results.map((r) => r.opportunity.opportunityKey), ["genre:b", "genre:a"]);
  });
});
