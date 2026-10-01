import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTrendingQuery, trendingHref } from "./query";

describe("parseTrendingQuery", () => {
  it("uses defaults for an empty query", () => {
    assert.deepEqual(parseTrendingQuery({}), {
      country: "id",
      platform: "all",
      market: "id",
      sort: "score",
      minRating: 0,
      minScore: 0,
      price: "all",
      includeUnscored: false,
      page: 1,
    });
  });

  it("accepts the price filter and falls back on unknown values", () => {
    assert.equal(parseTrendingQuery({ price: "free" }).price, "free");
    assert.equal(parseTrendingQuery({ price: "paid" }).price, "paid");
    assert.equal(parseTrendingQuery({ price: "cheap" }).price, "all");
    assert.equal(trendingHref(parseTrendingQuery({}), { price: "paid" }), "/trending?price=paid");
  });

  it("accepts valid values", () => {
    const query = parseTrendingQuery({
      country: "us",
      sort: "newest",
      minRating: "4.5",
      minScore: "61",
      includeUnscored: "1",
      page: "3",
    });
    assert.equal(query.sort, "newest");
    assert.equal(query.minRating, 4.5);
    assert.equal(query.minScore, 61);
    assert.equal(query.includeUnscored, true);
    assert.equal(query.page, 3);
  });

  it("falls back on unlisted or malformed values", () => {
    const query = parseTrendingQuery({
      sort: "hack",
      minRating: "4.2",
      minScore: "abc",
      includeUnscored: "yes",
      page: "-5",
    });
    assert.equal(query.sort, "score");
    assert.equal(query.minRating, 0);
    assert.equal(query.minScore, 0);
    assert.equal(query.includeUnscored, false);
    assert.equal(query.page, 1);
  });
});

describe("trendingHref", () => {
  const base = parseTrendingQuery({});

  it("omits defaults", () => {
    assert.equal(trendingHref(base, {}), "/trending");
  });

  it("resets to page 1 when a filter changes but keeps an explicit page", () => {
    const onPage3 = { ...base, page: 3 };
    assert.equal(trendingHref(onPage3, { sort: "newest" }), "/trending?sort=newest");
    assert.equal(trendingHref(onPage3, { page: 4 }), "/trending?page=4");
  });
});
