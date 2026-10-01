import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { overviewHref, parseOverviewFilters, scopeLabel, storefrontsOf } from "./filters";

describe("parseOverviewFilters", () => {
  it("defaults to Indonesia and all platforms", () => {
    assert.deepEqual(parseOverviewFilters({}), { country: "id", platform: "all", market: "id" });
  });

  it("accepts valid values", () => {
    assert.deepEqual(
      parseOverviewFilters({ country: "us", platform: "app_store" }),
      { country: "us", platform: "app_store", market: "world" },
    );
  });

  it("falls back for unknown values and takes the first repeated one", () => {
    assert.deepEqual(
      parseOverviewFilters({ country: "zz", platform: ["google_play", "app_store"] }),
      { country: "id", platform: "google_play", market: "id" },
    );
  });
});

describe("markets in the filters", () => {
  it("derives the market from any storefront in the URL and keeps the first storefront as the stand-in", () => {
    assert.deepEqual(parseOverviewFilters({ country: "jp" }), { country: "us", platform: "all", market: "world" });
    assert.deepEqual(parseOverviewFilters({ country: "th" }), { country: "sg", platform: "all", market: "sea" });
    assert.equal(parseOverviewFilters({ country: "id" }).market, "id");
  });

  it("reads every storefront of SEA and World, and one storefront otherwise", () => {
    assert.deepEqual(storefrontsOf(parseOverviewFilters({ country: "sg" })), ["sg", "th", "vn", "ph", "my"]);
    assert.equal(storefrontsOf(parseOverviewFilters({ country: "us" })).length, 7);
    assert.deepEqual(storefrontsOf(parseOverviewFilters({})), ["id"]);
    // A filter built without a market, such as a game's own storefront, stays one storefront.
    assert.deepEqual(storefrontsOf({ country: "us", platform: "all" }), ["us"]);
  });

  it("names the market for SEA and World and the storefront otherwise", () => {
    assert.equal(scopeLabel(parseOverviewFilters({ country: "us" })), "World");
    assert.equal(scopeLabel(parseOverviewFilters({ country: "sg" })), "SEA");
    assert.equal(scopeLabel(parseOverviewFilters({})), "Indonesia");
    assert.equal(scopeLabel({ country: "us", platform: "all" }), "United States");
  });

  it("round-trips through the URL: the links keep using country", () => {
    const world = parseOverviewFilters({ country: "us" });
    assert.equal(overviewHref(world, {}), "/?country=us");
    assert.equal(parseOverviewFilters({ country: "us" }).market, "world");
  });
});

describe("overviewHref", () => {
  it("omits defaults so shared links stay short", () => {
    const current = { country: "id", platform: "all" } as const;
    assert.equal(overviewHref(current, {}), "/");
    assert.equal(overviewHref(current, { country: "us" }), "/?country=us");
    assert.equal(
      overviewHref({ country: "us", platform: "app_store" }, { platform: "all" }),
      "/?country=us",
    );
  });
});
