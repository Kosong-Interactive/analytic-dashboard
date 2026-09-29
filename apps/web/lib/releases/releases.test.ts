import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OverviewCandidate } from "../overview/view-model";
import { buildReleasesList } from "./list";
import { parseReleasesQuery, releasesHref } from "./query";

const asOf = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

function candidate(id: string, releaseDate: Date | null, ratingCount = 100): OverviewCandidate {
  return {
    storeAppId: id,
    store: "google_play",
    country: "id",
    title: `Game ${id}`,
    developerName: null,
    storeCategory: null,
    iconUrl: null,
    storeUrl: "https://example.com",
    releaseDate,
    firstSeenAt: daysAgo(1),
    snapshots: [{ capturedAt: daysAgo(0.1), rating: 4, ratingCount }],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
  };
}

describe("parseReleasesQuery", () => {
  it("defaults to 30 days, newest first", () => {
    const query = parseReleasesQuery({});
    assert.equal(query.days, 30);
    assert.equal(query.sort, "newest");
    assert.equal(query.page, 1);
  });

  it("falls back on an unlisted window or sort", () => {
    const query = parseReleasesQuery({ days: "365", sort: "x", page: "0" });
    assert.equal(query.days, 30);
    assert.equal(query.sort, "newest");
    assert.equal(query.page, 1);
  });

  it("builds short, shareable links that reset the page", () => {
    const query = { ...parseReleasesQuery({ days: "7" }), page: 2 };
    assert.equal(releasesHref(query, { sort: "most_rated" }), "/new-releases?days=7&sort=most_rated");
    assert.equal(releasesHref(query, { days: 30 }), "/new-releases");
  });
});

describe("buildReleasesList", () => {
  const candidates = [
    candidate("recent", daysAgo(2), 50),
    candidate("older", daysAgo(20), 900),
    candidate("outside", daysAgo(60)),
    candidate("future", new Date(asOf.getTime() + 86_400_000)),
    candidate("undated", null),
  ];

  it("keeps only store release dates inside the window, never discovery time", () => {
    const list = buildReleasesList({ candidates, scores: [], query: parseReleasesQuery({}), asOf });
    assert.deepEqual(list.rows.map((r) => r.id), ["recent", "older"]);
    assert.equal(list.withoutReleaseDate, 1);
    assert.equal(list.tracked, 5);
  });

  it("narrows with a shorter window and sorts by another key", () => {
    const week = buildReleasesList({ candidates, scores: [], query: parseReleasesQuery({ days: "7" }), asOf });
    assert.deepEqual(week.rows.map((r) => r.id), ["recent"]);

    const byRatings = buildReleasesList({
      candidates,
      scores: [],
      query: parseReleasesQuery({ sort: "most_rated" }),
      asOf,
    });
    assert.deepEqual(byRatings.rows.map((r) => r.id), ["older", "recent"]);
  });

  it("returns an empty first page when nothing was released", () => {
    const list = buildReleasesList({ candidates: [candidate("x", null)], scores: [], query: parseReleasesQuery({}), asOf });
    assert.equal(list.total, 0);
    assert.equal(list.page, 1);
    assert.equal(list.pageCount, 1);
  });
});
