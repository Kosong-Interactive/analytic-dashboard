import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareHref, compareMarket, parseCompareQuery } from "./compare-query";

describe("parseCompareQuery", () => {
  it("defaults to genres, coverage order, every signal", () => {
    assert.deepEqual(parseCompareQuery({}), { country: "id", type: "genre", sort: "coverage", mode: "all" });
  });

  it("accepts valid values and falls back on unknown ones", () => {
    const query = parseCompareQuery({ type: "theme", sort: "steam", mode: "steam_to_mobile", country: "us" });
    assert.deepEqual(query, { country: "us", type: "theme", sort: "steam", mode: "steam_to_mobile" });
    assert.deepEqual(parseCompareQuery({ type: "x", sort: "y", mode: "z", country: "zz" }), { country: "id", type: "genre", sort: "coverage", mode: "all" });
  });

  it("selects the mobile market from any storefront and keeps its identifying storefront", () => {
    assert.equal(parseCompareQuery({ country: "jp" }).country, "us");
    assert.equal(parseCompareQuery({ country: "th" }).country, "sg");
    assert.equal(parseCompareQuery({ country: "id" }).country, "id");
    assert.equal(compareMarket(parseCompareQuery({ country: "kr" })), "world");
    assert.equal(compareMarket(parseCompareQuery({ country: "my" })), "sea");
    assert.equal(compareHref(parseCompareQuery({ country: "gb" })), "/steam/compare?country=us");
  });

  it("builds short links and omits defaults", () => {
    const base = parseCompareQuery({});
    assert.equal(compareHref(base), "/steam/compare");
    assert.equal(compareHref(base, { mode: "conflicting", type: "theme" }), "/steam/compare?type=theme&mode=conflicting");
  });
});
