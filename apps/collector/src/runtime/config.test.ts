import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadDiscoverySeeds, loadEnabledCountries } from "./config.js";

describe("discovery configuration", () => {
  it("enables exactly the MVP storefronts with a locale each", () => {
    const { countries } = loadEnabledCountries();

    assert.deepEqual(Object.keys(countries).sort(), ["id", "us"]);
    assert.equal(countries.id?.locale, "id_ID");
    assert.equal(countries.us?.locale, "en_US");
  });

  it("loads a versioned seed file within the adapter limits", () => {
    const seeds = loadDiscoverySeeds();

    assert.equal(seeds.version, "mvp-v3");
    assert.ok(seeds.appleLimit <= 200);
    assert.ok(seeds.appleChartLimit <= 200);
    assert.ok(seeds.googleLimit <= 25);
    assert.deepEqual(seeds.appleCharts, ["TOP_FREE", "TOP_PAID", "GROSSING"]);
    assert.equal(new Set(seeds.appleSearchTerms).size, seeds.appleSearchTerms.length);
  });
});
