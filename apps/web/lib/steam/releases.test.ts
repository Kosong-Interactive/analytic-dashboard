import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SteamGameListRow } from "@analytic-dashboard/db";

import { buildRankMovers } from "./rank-movers";
import { buildSteamReleasesList, parseSteamReleasesQuery, steamReleasesHref } from "./releases";

const asOf = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

function game(id: string, overrides: Partial<SteamGameListRow> = {}): SteamGameListRow {
  return {
    steamAppId: id,
    externalId: `${id}0`,
    title: `Game ${id}`,
    headerImageUrl: null,
    isFree: false,
    releaseState: "released",
    releaseDate: daysAgo(400),
    tags: [],
    firstSeenAt: daysAgo(5),
    snapshot: null,
    prices: {},
    charts: { most_played: null, top_sellers: null },
    ...overrides,
  };
}

describe("parseSteamReleasesQuery", () => {
  it("uses defaults and falls back on unknown values", () => {
    const query = parseSteamReleasesQuery({});
    assert.deepEqual(query, { country: "id", days: 30, sort: "newest", page: 1 });
    assert.equal(parseSteamReleasesQuery({ days: "5", sort: "x" }).days, 30);
    assert.equal(steamReleasesHref(query, { days: 7 }), "/steam/new-releases?days=7");
    assert.equal(steamReleasesHref(query), "/steam/new-releases");
  });
});

describe("buildSteamReleasesList", () => {
  const games = [
    game("a", { releaseDate: daysAgo(3) }),
    game("b", { releaseDate: daysAgo(20) }),
    game("c", { releaseDate: daysAgo(-10) }),
    game("d", { releaseDate: null }),
    game("e", { releaseDate: daysAgo(200) }),
  ];
  const ids = (params: Record<string, string>) =>
    buildSteamReleasesList({ games, membership: [], query: parseSteamReleasesQuery(params), asOf }).rows.map((r) => r.steamAppId);

  it("uses the release date window and excludes future and missing dates", () => {
    assert.deepEqual(ids({ days: "7" }), ["a"]);
    assert.deepEqual(ids({}), ["a", "b"]);
    assert.deepEqual(ids({ days: "90" }), ["a", "b"]);
  });

  it("counts games that can never appear because they have no release date", () => {
    const list = buildSteamReleasesList({ games, membership: [], query: parseSteamReleasesQuery({}), asOf });
    assert.equal(list.withoutReleaseDate, 1);
    assert.equal(list.tracked, 5);
    assert.equal(list.total, 2);
  });
});

describe("buildRankMovers", () => {
  const games = [
    game("up", { charts: { most_played: { rank: 2, lastWeekRank: 10 }, top_sellers: null } }),
    game("down", { charts: { most_played: { rank: 9, lastWeekRank: 3 }, top_sellers: null } }),
    game("same", { charts: { most_played: { rank: 4, lastWeekRank: 4 }, top_sellers: null } }),
    game("nolast", { charts: { most_played: { rank: 1, lastWeekRank: null }, top_sellers: null } }),
    game("other", { charts: { most_played: null, top_sellers: { rank: 1, lastWeekRank: 5 } } }),
  ];

  it("separates risers and fallers and leaves games without a last-week rank out", () => {
    const movers = buildRankMovers(games, "most_played");
    assert.deepEqual(movers.risers.map((m) => [m.title, m.change]), [["Game up", 8]]);
    assert.deepEqual(movers.fallers.map((m) => [m.title, m.change]), [["Game down", -6]]);
    assert.equal(movers.inChart, 4);
    assert.equal(movers.measured, 3);
    assert.equal(movers.unchanged, 1);
  });

  it("looks only at the requested chart", () => {
    const movers = buildRankMovers(games, "top_sellers");
    assert.deepEqual(movers.risers.map((m) => m.title), ["Game other"]);
    assert.equal(movers.fallers.length, 0);
  });
});
