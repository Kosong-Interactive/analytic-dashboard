import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GooglePlayCollector,
  GooglePlayCollectorError,
  type GooglePlayScraperClient,
} from "./google-play-collector.js";

const gameFixture = {
  appId: "com.example.puzzle",
  title: "Puzzle Quest",
  description: "A puzzle game.",
  developer: "Example Games",
  developerId: "example-games",
  genre: "Puzzle",
  genreId: "GAME_PUZZLE",
  released: "Jan 2, 2025",
  version: "1.2.3",
  icon: "https://example.com/icon.png",
  url: "https://play.google.com/store/apps/details?id=com.example.puzzle",
  score: 4.6,
  ratings: 12_345,
  reviews: 456,
  minInstalls: 100_000,
  maxInstalls: 188_000,
  price: 0,
  currency: "USD",
};

function createClient(
  overrides: Partial<GooglePlayScraperClient> = {},
): GooglePlayScraperClient {
  return {
    app: async () => gameFixture,
    search: async () => [gameFixture],
    list: async () => [gameFixture],
    ...overrides,
  };
}

describe("GooglePlayCollector", () => {
  it("normalizes a game search and caches successful results", async () => {
    let searches = 0;
    const collector = new GooglePlayCollector({
      client: createClient({
        search: async (input) => {
          searches += 1;
          assert.equal(input.fullDetail, true);
          assert.equal(input.lang, "en");
          return [gameFixture];
        },
      }),
      now: () => new Date("2026-09-29T10:00:00.000Z"),
      minimumRequestIntervalMs: 0,
    });
    const input = {
      term: "puzzle",
      country: "us" as const,
      locale: "en_US",
      limit: 1,
    };

    const results = await collector.searchGames(input);
    await collector.searchGames(input);

    assert.equal(searches, 1);
    assert.equal(results[0]?.store, "google_play");
    assert.equal(results[0]?.snapshot.reviewCount, 456);
    assert.equal(results[0]?.snapshot.minInstalls, 100_000);
    assert.match(results[0]?.metadataHash ?? "", /^[a-f0-9]{64}$/);
  });

  it("filters non-game entries from scraper output", async () => {
    const collector = new GooglePlayCollector({
      client: createClient({
        search: async () => [{ ...gameFixture, genreId: "PRODUCTIVITY" }],
      }),
      minimumRequestIntervalMs: 0,
    });

    assert.deepEqual(
      await collector.searchGames({
        term: "notes",
        country: "us",
        locale: "en_US",
      }),
      [],
    );
  });

  it("reports invalid and non-game entries and retries through events", async () => {
    const events = { skipped: [] as string[], retries: 0 };
    let calls = 0;
    const collector = new GooglePlayCollector({
      client: createClient({
        search: async () => {
          calls += 1;
          if (calls === 1) throw new Error("429 slow down");
          return [
            gameFixture,
            { ...gameFixture, genreId: "PRODUCTIVITY" },
            { appId: "", title: "" },
          ];
        },
      }),
      minimumRequestIntervalMs: 0,
      sleep: async () => undefined,
      events: {
        onSkipped: (reason) => events.skipped.push(reason),
        onRetry: () => {
          events.retries += 1;
        },
      },
    });

    const results = await collector.searchGames({
      term: "puzzle",
      country: "us",
      locale: "en_US",
    });

    assert.equal(results.length, 1);
    assert.deepEqual(events.skipped, ["non_game", "invalid"]);
    assert.equal(events.retries, 1);
  });

  it("retries temporary errors without leaking provider details", async () => {
    let attempts = 0;
    const collector = new GooglePlayCollector({
      client: createClient({
        app: async () => {
          attempts += 1;
          throw new Error("429 provider internals");
        },
      }),
      minimumRequestIntervalMs: 0,
      retryAttempts: 1,
      sleep: async () => undefined,
    });

    await assert.rejects(
      () =>
        collector.lookupGames({
          externalIds: ["com.example.puzzle"],
          country: "us",
          locale: "en_US",
        }),
      (error: unknown) => {
        assert.ok(error instanceof GooglePlayCollectorError);
        assert.equal(error.message.includes("provider internals"), false);
        return true;
      },
    );
    assert.equal(attempts, 2);
  });

  it("requests the selected game chart with full details", async () => {
    let collection: string | undefined;
    const collector = new GooglePlayCollector({
      client: createClient({
        list: async (input) => {
          collection = input.collection;
          assert.equal(input.category, "GAME");
          assert.equal(input.fullDetail, true);
          return [gameFixture];
        },
      }),
      minimumRequestIntervalMs: 0,
    });

    const results = await collector.discoverTopGames({
      country: "id",
      locale: "id_ID",
      collection: "TOP_FREE",
      limit: 1,
    });

    assert.equal(collection, "TOP_FREE");
    assert.equal(results[0]?.country, "id");
  });

  it("keeps provider chart positions when an entry is dropped", async () => {
    const collector = new GooglePlayCollector({
      client: createClient({
        list: async () => [
          gameFixture,
          { ...gameFixture, appId: "com.example.invalid", url: "not-a-url" },
          { ...gameFixture, appId: "com.example.third" },
        ],
      }),
      minimumRequestIntervalMs: 0,
    });

    const entries = await collector.discoverTopGameEntries({
      country: "us",
      locale: "en_US",
    });

    assert.deepEqual(
      entries.map((entry) => [entry.rank, entry.app.externalId]),
      [
        [1, "com.example.puzzle"],
        [3, "com.example.third"],
      ],
    );
  });
});
