import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { steamListingSchema, steamObservationSchema } from "./steam.js";

const capturedAt = "2026-09-30T08:00:00.000Z";

describe("Steam contracts", () => {
  it("accepts platform-specific listing metadata without activating Steam as a stored platform", () => {
    const listing = steamListingSchema.parse({
      platform: "steam",
      externalId: "730",
      market: "global",
      locale: "en-US",
      title: "Counter-Strike 2",
      description: "Competitive multiplayer game.",
      developerNames: ["Valve"],
      publisherNames: ["Valve"],
      genres: ["Action"],
      categories: ["Multi-player"],
      tags: ["FPS", "Competitive"],
      releaseState: "released",
      releaseDate: "2023-09-27T00:00:00.000Z",
      supportedOperatingSystems: { windows: true, macos: false, linux: true },
      isFree: true,
      headerImageUrl: "https://example.com/header.jpg",
      storeUrl: "https://store.steampowered.com/app/730",
      capturedAt,
      source: "steam_store",
    });

    assert.equal(listing.externalId, "730");
    assert.equal(listing.market, "global");
    assert.equal(listing.releaseState, "released");
  });

  it("keeps review, player, chart, and regional price semantics separate", () => {
    const observation = steamObservationSchema.parse({
      platform: "steam",
      externalId: "730",
      market: "global",
      assembledAt: capturedAt,
      reviews: {
        source: "steam_user_reviews_service",
        capturedAt,
        purchaseScope: "all",
        languageScope: ["all"],
        offTopicActivityFiltered: true,
        lifetime: { positive: 9, negative: 1, total: 10, positiveRatio: 0.9 },
        recent: { windowDays: 30, positive: 3, negative: 1, total: 4, positiveRatio: 0.75 },
      },
      players: { source: "steam_user_stats", capturedAt, currentPlayers: 0 },
      charts: [{ source: "steam_charts", capturedAt, chart: "most_played", rank: 1 }],
      prices: [{
        source: "steam_store",
        capturedAt,
        country: "ID",
        currency: "idr",
        initialPrice: 150_000,
        finalPrice: 75_000,
        discountPercent: 50,
      }],
    });

    assert.equal(observation.players?.currentPlayers, 0);
    assert.equal(observation.prices[0]?.country, "id");
    assert.equal(observation.prices[0]?.currency, "IDR");
  });

  it("rejects inconsistent review totals and fabricated star-rating semantics", () => {
    const base = {
      platform: "steam",
      externalId: "730",
      market: "global",
      assembledAt: capturedAt,
      reviews: {
        source: "steam_user_reviews_service",
        capturedAt,
        purchaseScope: "all",
        languageScope: ["all"],
        offTopicActivityFiltered: true,
        lifetime: { positive: 8, negative: 1, total: 10, positiveRatio: 0.8 },
        recent: null,
      },
      players: null,
      charts: [],
      prices: [],
    };

    assert.equal(steamObservationSchema.safeParse(base).success, false);
    assert.equal(
      steamObservationSchema.safeParse({
        ...base,
        reviews: {
          ...base.reviews,
          lifetime: { positive: 8, negative: 2, total: 10, positiveRatio: 0.8 },
          recent: { windowDays: 30, positive: 4, negative: 1, total: 6, positiveRatio: 0.8 },
        },
      }).success,
      false,
    );
    assert.equal(steamObservationSchema.safeParse({ ...base, reviews: null, rating: 4.5 }).success, false);
  });

  it("requires at least one real signal and valid chart/price constraints", () => {
    const empty = {
      platform: "steam",
      externalId: "730",
      market: "global",
      assembledAt: capturedAt,
      reviews: null,
      players: null,
      charts: [],
      prices: [],
    };

    assert.equal(steamObservationSchema.safeParse(empty).success, false);
    assert.equal(
      steamObservationSchema.safeParse({
        ...empty,
        charts: [{ source: "steam_charts", capturedAt, chart: "top_sellers", rank: 0 }],
      }).success,
      false,
    );
    assert.equal(
      steamObservationSchema.safeParse({
        ...empty,
        prices: [{
          source: "steam_store",
          capturedAt,
          country: "us",
          currency: "USD",
          initialPrice: 10,
          finalPrice: 20,
          discountPercent: 0,
        }],
      }).success,
      false,
    );
  });
});
