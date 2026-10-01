import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { marketCountries } from "@analytic-dashboard/shared";

import { loadDiscoverySeeds, loadEnabledCountries } from "./config.js";

describe("discovery configuration", () => {
  it("enables Indonesia, the SEA storefronts, and the World storefronts with a locale each", () => {
    const { countries } = loadEnabledCountries();

    assert.deepEqual(
      Object.keys(countries).sort(),
      [...marketCountries.id, ...marketCountries.sea, ...marketCountries.world].sort(),
    );
    assert.equal(countries.id?.locale, "id_ID");
    assert.equal(countries.us?.locale, "en_US");
    // New storefronts are read in English, which the keyword rules and the taxonomy are written for.
    for (const code of [...marketCountries.sea, ...marketCountries.world]) {
      assert.match(countries[code]?.locale ?? "", /^en_[A-Z]{2}$/, code);
    }
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
