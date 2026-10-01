import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SteamGameListRow, SteamLabelMembershipRow } from "@analytic-dashboard/db";

import { buildSteamGamesList } from "./games-list";
import { clearedSteamGameFilters, parseSteamGamesQuery, steamGamesHref } from "./games-query";

const asOf = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

function game(id: string, overrides: Partial<SteamGameListRow> & { players?: number | null; positive?: number | null; negative?: number | null } = {}): SteamGameListRow {
  const { players = 100, positive = 90, negative = 10, ...rest } = overrides;
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
    snapshot: {
      capturedAt: daysAgo(0.1),
      reviewPositive: positive,
      reviewNegative: negative,
      reviewTotal: positive === null || negative === null ? null : positive + negative,
      reviewsCapturedAt: null,
      currentPlayers: players,
      playersCapturedAt: null,
    },
    prices: {},
    charts: { most_played: null, top_sellers: null },
    ...rest,
  };
}

const price = (country: string, currency: string, finalPrice: number) => ({
  country, currency, initialPrice: finalPrice, finalPrice, discountPercent: 0, capturedAt: daysAgo(0.1),
});

const label = (steamAppId: string, type: "genre" | "core_mechanic", slug: string): SteamLabelMembershipRow => ({
  steamAppId, type, slug, displayName: slug, confidence: 0.75, source: "rule",
});

const games = [
  game("a", { players: 5000, tags: ["Roguelike"], prices: { id: price("id", "IDR", 150000), us: price("us", "USD", 14.99) }, charts: { most_played: { rank: 3, lastWeekRank: 5 }, top_sellers: null } }),
  game("b", { players: 200, positive: 50, negative: 50, isFree: true, releaseDate: daysAgo(10), charts: { most_played: null, top_sellers: { rank: 1, lastWeekRank: null } } }),
  game("c", { players: null, positive: null, negative: null, releaseDate: null }),
];
const membership = [label("a", "genre", "rpg"), label("b", "genre", "action"), label("a", "core_mechanic", "deckbuilding")];
const build = (params: Record<string, string>) =>
  buildSteamGamesList({ games, membership, query: parseSteamGamesQuery(params), asOf });
const ids = (params: Record<string, string>) => build(params).rows.map((r) => r.steamAppId);

describe("parseSteamGamesQuery", () => {
  it("defaults to no filters, most players first", () => {
    const query = parseSteamGamesQuery({});
    assert.equal(query.sort, "players");
    assert.equal(query.country, "id");
    assert.equal(query.price, "all");
    assert.equal(query.chart, "any");
    assert.equal(query.page, 1);
  });

  it("falls back on unknown values and rejects unsafe slugs", () => {
    const query = parseSteamGamesQuery({ sort: "x", minPositive: "55", price: "cheap", chart: "x", genre: "Bad Slug!", page: "-1" });
    assert.equal(query.sort, "players");
    assert.equal(query.minPositive, 0);
    assert.equal(query.price, "all");
    assert.equal(query.chart, "any");
    assert.equal(query.genre, undefined);
    assert.equal(query.page, 1);
  });

  it("builds short links that reset the page", () => {
    const query = { ...parseSteamGamesQuery({ genre: "rpg", country: "us" }), page: 3 };
    assert.equal(steamGamesHref(query, { sort: "name" }), "/steam/games?country=us&genre=rpg&sort=name");
    assert.equal(steamGamesHref(query, { page: 4 }), "/steam/games?country=us&genre=rpg&page=4");
    assert.equal(steamGamesHref(query, clearedSteamGameFilters), "/steam/games?country=us");
  });
});

describe("buildSteamGamesList", () => {
  it("sorts by players with missing values last", () => {
    assert.deepEqual(ids({}), ["a", "b", "c"]);
  });

  it("filters by label, tag, and text", () => {
    assert.deepEqual(ids({ genre: "rpg" }), ["a"]);
    assert.deepEqual(ids({ mechanic: "deckbuilding" }), ["a"]);
    assert.deepEqual(ids({ tag: "Roguelike" }), ["a"]);
    assert.deepEqual(ids({ q: "game b" }), ["b"]);
  });

  it("filters by any taxonomy label and ignores an invalid one", () => {
    const withTheme = [...membership, { steamAppId: "b", type: "theme", slug: "horror", displayName: "Horror", confidence: 0.75, source: "rule" } as const];
    const list = buildSteamGamesList({ games, membership: withTheme, query: parseSteamGamesQuery({ label: "theme:horror" }), asOf });
    assert.deepEqual(list.rows.map((r) => r.steamAppId), ["b"]);
    assert.equal(parseSteamGamesQuery({ label: "Bad Label" }).label, undefined);
  });

  it("never lets a missing value match a threshold filter", () => {
    assert.deepEqual(ids({ minPositive: "80" }), ["a"]);
    assert.deepEqual(ids({ minReviews: "100" }), ["a", "b"]);
    assert.deepEqual(ids({ released: "30" }), ["b"]);
    assert.deepEqual(ids({ released: "unknown" }), ["c"]);
  });

  it("uses the selected country's price and keeps unknown out of Gratis and Berbayar", () => {
    assert.deepEqual(ids({ price: "free" }), ["b"]);
    assert.deepEqual(ids({ price: "paid" }), ["a"]);
    const idRow = build({ country: "id" }).rows.find((r) => r.steamAppId === "a");
    const usRow = build({ country: "us" }).rows.find((r) => r.steamAppId === "a");
    assert.equal(idRow?.price, 150000);
    assert.equal(idRow?.currency, "IDR");
    assert.equal(usRow?.price, 14.99);
    assert.equal(build({}).rows.find((r) => r.steamAppId === "c")?.price, null);
  });

  it("filters by chart and orders by best rank", () => {
    assert.deepEqual(ids({ chart: "most_played" }), ["a"]);
    assert.deepEqual(ids({ chart: "top_sellers" }), ["b"]);
    assert.deepEqual(ids({ sort: "chart" }), ["b", "a", "c"]);
  });

  it("counts option values and paginates", () => {
    const list = build({});
    assert.equal(list.tracked, 3);
    assert.equal(list.pageCount, 1);
    assert.deepEqual(list.options.genres.map((o) => o.value).sort(), ["action", "rpg"]);
    assert.deepEqual(list.options.tags, [{ value: "Roguelike", label: "Roguelike", count: 1 }]);
  });
});
