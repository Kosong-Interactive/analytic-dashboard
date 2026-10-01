import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateMarketGames, type MarketCandidate, type MarketScoreLike } from "./market-aggregate.js";

interface Candidate extends MarketCandidate {
  id: string;
  title: string;
}

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n));
const candidate = (id: string, country: string, externalId: string, firstSeen = 5, store = "google_play"): Candidate => ({
  id,
  title: `Game ${externalId}`,
  store,
  externalId,
  country,
  firstSeenAt: day(firstSeen),
});
const score = (id: string, value: number | null): MarketScoreLike => ({ id, score: value });
const priority = ["us", "jp", "kr"];
const run = (storefronts: Parameters<typeof aggregateMarketGames<Candidate, MarketScoreLike>>[0]["storefronts"]) =>
  aggregateMarketGames({ storefronts, priority, idOf: (c) => c.id });

describe("aggregateMarketGames", () => {
  const us = { country: "us", candidates: [candidate("us-a", "us", "a", 5), candidate("us-b", "us", "b")], scores: [score("us-a", 80), score("us-b", 10)] };
  const jp = { country: "jp", candidates: [candidate("jp-a", "jp", "a", 2), candidate("jp-c", "jp", "c")], scores: [score("jp-a", 40), score("jp-c", 70)] };
  const kr = { country: "kr", candidates: [candidate("kr-a", "kr", "a", 9)], scores: [score("kr-a", 60)] };

  it("counts a game once per platform and lists every storefront that tracks it", () => {
    const { games } = run([us, jp, kr]);
    assert.equal(games.length, 3);
    const a = games.find((g) => g.candidate.externalId === "a");
    assert.deepEqual(a?.countriesObserved, ["us", "jp", "kr"]);
  });

  it("shows the listing of the median-scoring storefront, not an average or a sum", () => {
    const a = run([us, jp, kr]).games.find((g) => g.candidate.externalId === "a");
    // Scores 80 (us), 40 (jp), 60 (kr): the median is 60, from Korea.
    assert.equal(a?.shownCountry, "kr");
    assert.equal(a?.score?.score, 60);
    assert.equal(a?.candidate.id, "kr-a");
    assert.equal(a?.scoredCountries, 3);
  });

  it("uses the lower median for an even number of scored storefronts", () => {
    const a = run([us, jp]).games.find((g) => g.candidate.externalId === "a");
    assert.equal(a?.score?.score, 40);
    assert.equal(a?.shownCountry, "jp");
  });

  it("leaves unscored storefronts out of the median instead of counting zero", () => {
    const quiet = { country: "kr", candidates: [candidate("kr-a", "kr", "a")], scores: [score("kr-a", null)] };
    const a = run([us, quiet]).games.find((g) => g.candidate.externalId === "a");
    assert.equal(a?.score?.score, 80);
    assert.equal(a?.scoredCountries, 1);
    assert.equal(a?.countriesObserved.length, 2);
  });

  it("falls back to the first storefront in priority order when nothing is scored", () => {
    const only = { country: "jp", candidates: [candidate("jp-z", "jp", "z")], scores: [] };
    const also = { country: "us", candidates: [candidate("us-z", "us", "z")], scores: [score("us-z", null)] };
    const z = run([only, also]).games[0];
    assert.equal(z?.shownCountry, "us");
    assert.equal(z?.score?.score ?? null, null);
    assert.equal(z?.scoredCountries, 0);
  });

  it("treats the earliest sighting in any storefront as when the game was first observed", () => {
    const a = run([us, jp, kr]).games.find((g) => g.candidate.externalId === "a");
    assert.deepEqual(a?.candidate.firstSeenAt, day(2));
  });

  it("keeps the same external id on different platforms as different games", () => {
    const apple = { country: "us", candidates: [candidate("us-apple", "us", "a", 5, "app_store")], scores: [] };
    const google = { country: "us", candidates: [candidate("us-google", "us", "a", 5, "google_play")], scores: [] };
    assert.equal(run([apple, google]).games.length, 2);
  });

  it("reports coverage as the collected storefronts out of those the market combines", () => {
    const empty = { country: "kr", candidates: [], scores: [] };
    const { coverage } = run([us, jp, empty]);
    assert.deepEqual(coverage.collected, ["us", "jp"]);
    assert.equal(coverage.total, 3);
  });

  it("returns no games and zero coverage for an empty market", () => {
    const { games, coverage } = run([]);
    assert.equal(games.length, 0);
    assert.deepEqual(coverage.collected, []);
  });
});
