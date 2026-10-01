import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AppleSearchApiError,
  AppleSearchCollector,
} from "./apple-search-collector.js";

const appleFixture = {
  resultCount: 2,
  results: [
    {
      wrapperType: "software",
      kind: "software",
      trackId: 1324604053,
      trackName: "Jigsaw Puzzles",
      bundleId: "com.example.puzzles",
      sellerName: "Example Games Ltd",
      artistId: 12345,
      primaryGenreName: "Games",
      genres: ["Games", "Puzzle"],
      genreIds: ["6014", "7012"],
      releaseDate: "2018-06-26T02:13:14Z",
      currentVersionReleaseDate: "2026-08-28T08:56:41Z",
      version: "4.9.0",
      averageUserRating: 4.7,
      userRatingCount: 1_107_716,
      price: 0,
      currency: "USD",
      formattedPrice: "Free",
      artworkUrl512: "https://example.com/icon.png",
      trackViewUrl: "https://apps.apple.com/us/app/example/id1324604053",
      description: "A relaxing puzzle game.",
    },
    {
      wrapperType: "software",
      kind: "software",
      trackId: 987654321,
      trackName: "Puzzle Notes",
      sellerName: "Example Productivity Ltd",
      primaryGenreName: "Productivity",
      genres: ["Productivity"],
      trackViewUrl: "https://apps.apple.com/us/app/example/id987654321",
    },
  ],
};

describe("AppleSearchCollector", () => {
  it("builds a scoped search and normalizes only games", async () => {
    let requestedUrl: URL | undefined;
    const collector = new AppleSearchCollector({
      minimumRequestIntervalMs: 0,
      fetchImplementation: async (input) => {
        requestedUrl = new URL(input.toString());
        return Response.json(appleFixture);
      },
      now: () => new Date("2026-09-29T10:00:00.000Z"),
    });

    const results = await collector.searchGames({
      term: "puzzle",
      country: "us",
      locale: "en_US",
      limit: 25,
    });

    assert.equal(requestedUrl?.pathname, "/search");
    assert.equal(requestedUrl?.searchParams.get("entity"), "software");
    assert.equal(requestedUrl?.searchParams.get("country"), "us");
    assert.equal(requestedUrl?.searchParams.get("limit"), "25");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.externalId, "1324604053");
    assert.equal(results[0]?.snapshot.reviewCount, null);
    assert.equal(results[0]?.snapshot.ratingCount, 1_107_716);
    assert.match(results[0]?.metadataHash ?? "", /^[a-f0-9]{64}$/);
  });

  it("reports skipped non-game results", async () => {
    const skipped: string[] = [];
    const collector = new AppleSearchCollector({
      minimumRequestIntervalMs: 0,
      fetchImplementation: async () => Response.json(appleFixture),
      events: { onSkipped: (reason) => skipped.push(reason) },
    });

    await collector.searchGames({ term: "puzzle", country: "us", locale: "en_US" });

    assert.deepEqual(skipped, ["non_game"]);
  });

  it("spaces consecutive requests to respect Apple's rate limit", async () => {
    const waits: number[] = [];
    const collector = new AppleSearchCollector({
      fetchImplementation: async () => Response.json(appleFixture),
      now: () => new Date("2026-09-29T10:00:00.000Z"),
      minimumRequestIntervalMs: 3_000,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    await collector.searchGames({ term: "puzzle", country: "us", locale: "en_US" });
    await collector.searchGames({ term: "idle", country: "us", locale: "en_US" });

    assert.deepEqual(waits, [3_000]);
  });

  it("uses ID lookup for known apps", async () => {
    let requestedUrl: URL | undefined;
    const collector = new AppleSearchCollector({
      minimumRequestIntervalMs: 0,
      fetchImplementation: async (input) => {
        requestedUrl = new URL(input.toString());
        return Response.json({ resultCount: 1, results: [appleFixture.results[0]] });
      },
    });

    await collector.lookupGames({
      externalIds: ["1324604053"],
      country: "id",
      locale: "id_ID",
    });

    assert.equal(requestedUrl?.pathname, "/lookup");
    assert.equal(requestedUrl?.searchParams.get("id"), "1324604053");
  });

  it("rejects malformed provider payloads", async () => {
    const collector = new AppleSearchCollector({
      minimumRequestIntervalMs: 0,
      fetchImplementation: async () =>
        Response.json({ resultCount: 1, results: [{ trackId: "invalid" }] }),
    });

    await assert.rejects(
      () =>
        collector.searchGames({
          term: "puzzle",
          country: "us",
          locale: "en_US",
        }),
      AppleSearchApiError,
    );
  });

  it("reports HTTP status without exposing response bodies", async () => {
    const collector = new AppleSearchCollector({
      minimumRequestIntervalMs: 0,
      fetchImplementation: async () =>
        new Response("provider details", { status: 429 }),
    });

    await assert.rejects(
      () =>
        collector.searchGames({
          term: "puzzle",
          country: "us",
          locale: "en_US",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppleSearchApiError);
        assert.equal(error.status, 429);
        assert.equal(error.message.includes("provider details"), false);
        return true;
      },
    );
  });
  describe("discoverTopGameEntries", () => {
    const feed = (ids: string[]) => ({
      feed: { entry: ids.map((id) => ({ id: { label: `https://apps.apple.com/id/app/x/id${id}`, attributes: { "im:id": id } } })) },
    });
    const result = (trackId: number, name: string) => ({
      ...appleFixture.results[0],
      trackId,
      trackName: name,
      trackViewUrl: `https://apps.apple.com/id/app/x/id${trackId}`,
    });

    function collectorFor(feedBody: unknown, lookupResults: unknown[], urls: URL[] = []) {
      return new AppleSearchCollector({
        minimumRequestIntervalMs: 0,
        now: () => new Date("2026-09-30T10:00:00.000Z"),
        fetchImplementation: async (input) => {
          const url = new URL(input.toString());
          urls.push(url);
          if (url.pathname.includes("/rss/")) return Response.json(feedBody);
          return Response.json({ resultCount: lookupResults.length, results: lookupResults });
        },
      });
    }

    it("requests the Games feed of the storefront and ranks games in feed order", async () => {
      const urls: URL[] = [];
      const collector = collectorFor(feed(["30", "10", "20"]), [result(10, "Ten"), result(20, "Twenty"), result(30, "Thirty")], urls);

      const entries = await collector.discoverTopGameEntries({ country: "id", locale: "id_ID", collection: "TOP_PAID", limit: 3 });

      assert.equal(urls[0]?.pathname, "/id/rss/toppaidapplications/limit=3/genre=6014/json");
      assert.equal(urls[1]?.pathname, "/lookup");
      assert.equal(urls[1]?.searchParams.get("id"), "30,10,20");
      assert.deepEqual(entries.map((e) => [e.rank, e.app.externalId]), [[1, "30"], [2, "10"], [3, "20"]]);
      assert.equal(entries[0]?.app.country, "id");
    });

    it("keeps ranks stable when the lookup misses a game, and skips non-games", async () => {
      const nonGame = { ...result(20, "Notes"), primaryGenreName: "Productivity", genres: ["Productivity"], genreIds: ["6007"] };
      const collector = collectorFor(feed(["10", "20", "30", "40"]), [result(10, "Ten"), nonGame, result(40, "Forty")]);

      const entries = await collector.discoverTopGameEntries({ country: "us", locale: "en_US" });

      assert.deepEqual(entries.map((e) => [e.rank, e.app.externalId]), [[1, "10"], [4, "40"]]);
    });

    it("accepts a single-entry feed and an empty feed without calling lookup", async () => {
      const urls: URL[] = [];
      const single = collectorFor({ feed: { entry: { id: { attributes: { "im:id": "10" } } } } }, [result(10, "Ten")], urls);
      assert.equal((await single.discoverTopGameEntries({ country: "us", locale: "en_US" })).length, 1);

      const emptyUrls: URL[] = [];
      const empty = collectorFor({ feed: {} }, [], emptyUrls);
      assert.deepEqual(await empty.discoverTopGameEntries({ country: "us", locale: "en_US" }), []);
      assert.equal(emptyUrls.length, 1);
    });

    it("rejects a malformed feed and reports HTTP status without the body", async () => {
      const malformed = collectorFor({ feed: { entry: [{ id: { attributes: { "im:id": "abc" } } }] } }, []);
      await assert.rejects(() => malformed.discoverTopGameEntries({ country: "us", locale: "en_US" }), AppleSearchApiError);

      const limited = new AppleSearchCollector({
        minimumRequestIntervalMs: 0,
        fetchImplementation: async () => new Response("provider details", { status: 503 }),
      });
      await assert.rejects(
        () => limited.discoverTopGameEntries({ country: "us", locale: "en_US" }),
        (error: unknown) => {
          assert.ok(error instanceof AppleSearchApiError);
          assert.equal(error.status, 503);
          assert.equal(error.message.includes("provider details"), false);
          return true;
        },
      );
    });
  });
});
