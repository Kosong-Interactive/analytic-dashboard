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

  it("keeps the discovery sample small and versioned", () => {
    const seeds = loadDiscoverySeeds();

    assert.equal(seeds.version, "mvp-v1");
    assert.ok(seeds.limit <= 25);
    assert.ok(seeds.appleSearchTerms.length > 0);
  });
});
