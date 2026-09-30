import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { steamListingSchema, steamObservationSchema } from "@analytic-dashboard/shared";

import { SteamApiError, SteamCollector } from "./steam-collector.js";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

const API_KEY = "test-key-never-logged";
const now = () => new Date("2026-09-30T08:00:00.000Z");

/** Routes by Web API method and records every request, so tests can assert on what was sent. */
function fakeFetch(routes: Record<string, unknown | Array<unknown | number | Error>>) {
  const calls: URL[] = [];
  const queues = new Map(Object.entries(routes).map(([method, value]) => [method, Array.isArray(value) ? [...value] : [value]]));
  const implementation = (async (input: string | URL | Request) => {
    const url = new URL(input.toString());
    calls.push(url);
    const method = url.pathname.split("/")[2] ?? "";
    const queue = queues.get(method);
    if (!queue || queue.length === 0) throw new Error(`No fixture for ${method}`);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    if (typeof next === "number") return new Response("{}", { status: next });
    return Response.json(next);
  }) as typeof fetch;
  return { implementation, calls };
}

function collector(fetchImplementation: typeof fetch, extra: Partial<ConstructorParameters<typeof SteamCollector>[0]> = {}) {
  return new SteamCollector({
    apiKey: API_KEY,
    fetchImplementation,
    now,
    sleep: async () => undefined,
    minimumRequestIntervalMs: 0,
    ...extra,
  });
}

const listingRoutes = (items: unknown) => ({
  GetTagList: fixture("tag-list"),
  GetStoreCategories: fixture("categories"),
  GetItems: items,
});

describe("SteamCollector charts", () => {
  it("normalizes the most-played chart and treats a zero last-week rank as new", async () => {
    const { implementation, calls } = fakeFetch({ GetMostPlayedGames: fixture("most-played") });
    const entries = await collector(implementation).getMostPlayed();

    assert.deepEqual(entries[0], { chart: "most_played", rank: 1, externalId: "730", lastWeekRank: 1 });
    assert.equal(entries[2]?.lastWeekRank, null);
    assert.equal(calls[0]?.searchParams.get("key"), API_KEY);
  });

  it("requests the global top sellers chart", async () => {
    const { implementation, calls } = fakeFetch({ GetWeeklyTopSellers: fixture("top-sellers") });
    const entries = await collector(implementation).getTopSellers({ limit: 2 });

    assert.deepEqual(entries.map((e) => [e.rank, e.externalId, e.lastWeekRank]), [[1, "4080220", null], [2, "1867240", 5]]);
    const input = JSON.parse(calls[0]?.searchParams.get("input_json") ?? "{}");
    assert.equal(input.country_code, "");
    assert.equal(input.page_count, 2);
  });
});

describe("SteamCollector listings", () => {
  it("normalizes store items into the shared listing contract with a regional price", async () => {
    const { implementation } = fakeFetch(listingRoutes(fixture("items-id")));
    const result = await collector(implementation).getListings({ externalIds: ["730", "1245620", "999999999"], country: "id" });

    assert.deepEqual(result.missing, ["999999999"]);
    const [cs2, elden] = result.listings;
    for (const listing of result.listings) steamListingSchema.parse(listing);

    assert.equal(cs2?.title, "Counter-Strike 2");
    assert.deepEqual(cs2?.developerNames, ["Valve"]);
    // The unknown tag id is dropped instead of becoming an empty or made-up name.
    assert.deepEqual(cs2?.tags, ["FPS", "Multiplayer", "Action"]);
    // Official genres are not in these responses; tags are not promoted to genres.
    assert.deepEqual(cs2?.genres, []);
    assert.deepEqual(cs2?.supportedOperatingSystems, { windows: true, macos: false, linux: true });
    assert.equal(cs2?.isFree, true);
    assert.equal(cs2?.releaseState, "released");
    assert.equal(cs2?.releaseDate, "2012-08-21T17:00:00.000Z");
    assert.equal(cs2?.headerImageUrl, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg?t=1789251637");
    assert.equal(cs2?.market, "global");

    assert.deepEqual(elden?.categories, ["Single-player", "Multi-player", "Steam Achievements", "Full controller support"]);

    // Free games have no purchase option, so they have no price rather than a zero price.
    assert.equal(result.prices.has("730"), false);
    assert.deepEqual(result.prices.get("1245620"), {
      source: "steam_store",
      capturedAt: "2026-09-30T08:00:00.000Z",
      country: "id",
      currency: "IDR",
      initialPrice: 599_000,
      finalPrice: 599_000,
      discountPercent: 0,
    });
  });

  it("keeps discounts, early access, and upcoming states, and skips a price in an unexpected currency", async () => {
    const { implementation } = fakeFetch(listingRoutes(fixture("items-us-discount")));
    const result = await collector(implementation).getListings({ externalIds: ["1888930", "1867240", "4000001"], country: "us" });

    assert.deepEqual(result.listings.map((l) => l.releaseState), ["released", "early_access", "upcoming"]);
    assert.equal(result.listings[2]?.releaseDate, null);
    assert.equal(result.listings[2]?.description, null);
    const discounted = result.prices.get("1888930");
    assert.equal(discounted?.initialPrice, 59.99);
    assert.equal(discounted?.finalPrice, 29.99);
    assert.equal(discounted?.discountPercent, 50);
    assert.equal(result.prices.has("1867240"), false);
  });

  it("splits large requests into batches of 50 and loads the tag and category names once", async () => {
    const { implementation, calls } = fakeFetch(listingRoutes({ response: { store_items: [] } }));
    const ids = Array.from({ length: 120 }, (_, i) => String(i + 1));
    const result = await collector(implementation).getListings({ externalIds: ids, country: "us" });

    const methods = calls.map((url) => url.pathname.split("/")[2]);
    assert.equal(methods.filter((m) => m === "GetItems").length, 3);
    assert.equal(methods.filter((m) => m === "GetTagList").length, 1);
    assert.equal(result.missing.length, 120);
  });

  it("rejects invalid app ids before calling Steam", async () => {
    const { implementation, calls } = fakeFetch({});
    await assert.rejects(() => collector(implementation).getListings({ externalIds: ["abc"], country: "us" }));
    assert.equal(calls.length, 0);
  });
});

describe("SteamCollector reviews and players", () => {
  it("keeps exact lifetime review totals, never the review text, and sends no key", async () => {
    const { implementation, calls } = fakeFetch({ GetAppReviews: fixture("reviews") });
    const reviews = await collector(implementation).getReviewSummary("730");

    assert.deepEqual(reviews?.lifetime, { positive: 8_490_357, negative: 1_401_288, total: 9_891_645, positiveRatio: 8_490_357 / 9_891_645 });
    assert.equal(reviews?.recent, null);
    assert.doesNotMatch(JSON.stringify(reviews), /FIXTURE PLACEHOLDER/);
    assert.equal(calls[0]?.searchParams.has("key"), false);
  });

  it("reports no reviews as an empty total with no ratio", async () => {
    const { implementation } = fakeFetch({ GetAppReviews: fixture("reviews-empty") });
    const reviews = await collector(implementation).getReviewSummary("730");
    assert.deepEqual(reviews?.lifetime, { positive: 0, negative: 0, total: 0, positiveRatio: null });
  });

  it("returns current players, or null when Steam does not report a count", async () => {
    const ok = fakeFetch({ GetNumberOfCurrentPlayers: fixture("players") });
    assert.equal((await collector(ok.implementation).getCurrentPlayers("730"))?.currentPlayers, 703_666);

    const missing = fakeFetch({ GetNumberOfCurrentPlayers: fixture("players-unavailable") });
    assert.equal(await collector(missing.implementation).getCurrentPlayers("730"), null);

    const unavailable = fakeFetch({ GetNumberOfCurrentPlayers: 404 });
    assert.equal(await collector(unavailable.implementation).getCurrentPlayers("730"), null);
  });

  it("still reports non-404 current-player failures", async () => {
    const unavailable = fakeFetch({ GetNumberOfCurrentPlayers: 503 });
    await assert.rejects(() => collector(unavailable.implementation).getCurrentPlayers("730"), /HTTP 503/);
  });

  it("assembles into the shared observation contract", async () => {
    const { implementation } = fakeFetch({ GetAppReviews: fixture("reviews"), GetNumberOfCurrentPlayers: fixture("players") });
    const steam = collector(implementation);
    const observation = steamObservationSchema.parse({
      platform: "steam",
      externalId: "730",
      market: "global",
      assembledAt: now().toISOString(),
      reviews: await steam.getReviewSummary("730"),
      players: await steam.getCurrentPlayers("730"),
      charts: [],
      prices: [],
    });
    assert.equal(observation.players?.currentPlayers, 703_666);
  });
});

describe("SteamCollector transport", () => {
  it("retries transient failures and then succeeds", async () => {
    let retries = 0;
    const { implementation, calls } = fakeFetch({ GetMostPlayedGames: [429, new Error("socket hang up"), fixture("most-played")] });
    const entries = await collector(implementation, { events: { onRetry: () => (retries += 1) } }).getMostPlayed();

    assert.equal(entries.length, 3);
    assert.equal(calls.length, 3);
    assert.equal(retries, 2);
  });

  it("does not retry an auth failure and never puts the key in the error", async () => {
    const { implementation, calls } = fakeFetch({ GetMostPlayedGames: 403 });
    await assert.rejects(
      () => collector(implementation).getMostPlayed(),
      (error: unknown) => {
        assert.ok(error instanceof SteamApiError);
        assert.equal(error.status, 403);
        assert.equal(error.message.includes(API_KEY), false);
        return true;
      },
    );
    assert.equal(calls.length, 1);
  });

  it("rejects a malformed payload instead of guessing", async () => {
    const { implementation } = fakeFetch({ GetMostPlayedGames: { response: { ranks: [{ rank: "one" }] } } });
    await assert.rejects(() => collector(implementation).getMostPlayed(), /did not match the expected shape/);
  });

  it("caches successful responses until the TTL expires", async () => {
    const { implementation, calls } = fakeFetch({ GetMostPlayedGames: fixture("most-played") });
    const steam = collector(implementation);
    await steam.getMostPlayed();
    await steam.getMostPlayed();
    assert.equal(calls.length, 1);
    steam.clearCache();
    await steam.getMostPlayed();
    assert.equal(calls.length, 2);
  });

  it("spaces consecutive requests across endpoints", async () => {
    const waits: number[] = [];
    const { implementation } = fakeFetch({ GetMostPlayedGames: fixture("most-played"), GetNumberOfCurrentPlayers: fixture("players") });
    const steam = collector(implementation, { minimumRequestIntervalMs: 1_000, sleep: async (ms) => { waits.push(ms); } });
    await steam.getMostPlayed();
    await steam.getCurrentPlayers("730");
    assert.deepEqual(waits, [1_000]);
  });

  it("requires an API key", () => {
    assert.throws(() => new SteamCollector({ apiKey: "" }), SteamApiError);
  });
});
