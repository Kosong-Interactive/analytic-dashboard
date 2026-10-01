import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleSearchRequest, type SearchHttpDependencies } from "./http";
import { buildSearchGroups, labelHref, matchPages, searchResponseSchema, type CatalogResultInput } from "./results";

const result: CatalogResultInput = {
  games: [
    { storeAppId: "11111111-1111-4111-8111-111111111111", title: "Merge Town", developerName: null, store: "google_play", country: "us", iconUrl: null },
  ],
  developers: [{ developerName: "Merge Studio", listings: 1 }],
  labels: [
    { type: "genre", slug: "puzzle", displayName: "Puzzle" },
    { type: "core_mechanic", slug: "merging", displayName: "Merging" },
    { type: "monetization_clue", slug: "ads", displayName: "Ads" },
  ],
};

function deps(overrides: Partial<SearchHttpDependencies> = {}) {
  const logged: string[] = [];
  const searched: string[] = [];
  const value: SearchHttpDependencies = {
    isSignedIn: async () => true,
    search: async (text) => (searched.push(text), result),
    logFailure: (name) => logged.push(name),
    ...overrides,
  };
  return { value, logged, searched };
}

describe("buildSearchGroups", () => {
  it("groups results with links to existing pages and drops label types without a page", () => {
    const groups = buildSearchGroups("merg", result);
    assert.deepEqual(groups.map((g) => g.kind), ["game", "developer", "label"]);
    assert.equal(groups[0]?.items[0]?.href, "/games/11111111-1111-4111-8111-111111111111");
    assert.equal(groups[0]?.items[0]?.detail, "Unknown developer · Google Play · United States");
    assert.equal(groups[1]?.items[0]?.href, "/games?q=Merge%20Studio");
    assert.deepEqual(groups[2]?.items.map((i) => i.href), ["/games?genre=puzzle", "/games?mechanic=merging"]);
    assert.ok(searchResponseSchema.safeParse({ query: "merg", groups }).success);
  });

  it("matches pages by title or keyword", () => {
    assert.deepEqual(matchPages("trend").map((p) => p.href), ["/trending"]);
    assert.deepEqual(matchPages("   "), []);
  });

  it("links every label type to a page", () => {
    assert.equal(labelHref("subgenre", "merge"), "/genres?type=subgenre");
    assert.equal(labelHref("theme", "fantasy"), "/mechanics?type=theme");
  });
});

describe("handleSearchRequest", () => {
  it("answers 401 before reading anything when signed out", async () => {
    const { value, searched } = deps({ isSignedIn: async () => false });
    const response = await handleSearchRequest(new URLSearchParams("q=merge"), value);
    assert.equal(response.status, 401);
    assert.deepEqual(searched, []);
  });

  it("answers 400 for a missing, too short, or too long query", async () => {
    for (const q of ["", "a", "x".repeat(81)]) {
      const response = await handleSearchRequest(new URLSearchParams({ q }), deps().value);
      assert.equal(response.status, 400);
    }
  });

  it("trims the query and returns grouped results", async () => {
    const { value, searched } = deps();
    const response = await handleSearchRequest(new URLSearchParams({ q: "  merge " }), value);
    assert.equal(response.status, 200);
    assert.deepEqual(searched, ["merge"]);
    assert.equal(response.status === 200 ? response.body.query : null, "merge");
  });

  it("answers 500 with a safe message and logs only the error name", async () => {
    const { value, logged } = deps({
      search: async () => {
        throw new TypeError("connection to db.internal:5432 failed");
      },
    });
    const response = await handleSearchRequest(new URLSearchParams("q=merge"), value);
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(response.body), /db\.internal/);
    assert.deepEqual(logged, ["TypeError"]);
  });
});
