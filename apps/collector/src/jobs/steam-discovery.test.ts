import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SteamChartEntry, SteamListingsResult } from "@analytic-dashboard/collectors";
import type { SteamPriceInput, SteamSnapshotInput } from "@analytic-dashboard/db";
import type { SteamListing } from "@analytic-dashboard/shared";

import { runSteamDiscovery, type SteamDiscoveryStore, type SteamSource } from "./steam-discovery.js";

const capturedAt = "2026-09-30T08:00:00.000Z";
const now = () => new Date(capturedAt);

const listing = (externalId: string): SteamListing => ({
  platform: "steam",
  market: "global",
  locale: "en-US",
  externalId,
  title: `Game ${externalId}`,
  description: null,
  developerNames: [],
  publisherNames: [],
  genres: [],
  categories: [],
  tags: [],
  releaseState: "released",
  releaseDate: null,
  supportedOperatingSystems: { windows: true, macos: false, linux: false },
  isFree: false,
  headerImageUrl: null,
  storeUrl: `https://store.steampowered.com/app/${externalId}/`,
  source: "steam_web_api",
  capturedAt,
});

const chart = (chartName: SteamChartEntry["chart"], ids: string[]): SteamChartEntry[] =>
  ids.map((externalId, index) => ({ chart: chartName, rank: index + 1, externalId, lastWeekRank: null }));

function fakeSource(overrides: Partial<SteamSource> = {}): SteamSource & { listingCalls: string[][] } {
  const listingCalls: string[][] = [];
  return {
    listingCalls,
    getMostPlayed: async () => chart("most_played", ["1", "2", "3"]),
    getTopSellers: async () => chart("top_sellers", ["3", "4"]),
    getListings: async ({ externalIds, country }): Promise<SteamListingsResult> => {
      listingCalls.push(externalIds);
      const found = externalIds.filter((id) => id !== "4");
      return {
        listings: found.map(listing),
        prices: new Map(
          found.map((id) => [
            id,
            { source: "steam_store", capturedAt, country, currency: country === "id" ? "IDR" : "USD", initialPrice: 10, finalPrice: 10, discountPercent: 0 },
          ]),
        ),
        missing: externalIds.filter((id) => id === "4"),
      };
    },
    getReviewSummary: async () => ({
      source: "steam_user_reviews_service",
      capturedAt,
      purchaseScope: "all",
      languageScope: ["all"],
      offTopicActivityFiltered: true,
      lifetime: { positive: 9, negative: 1, total: 10, positiveRatio: 0.9 },
      recent: null,
    }),
    getCurrentPlayers: async () => ({ source: "steam_user_stats", capturedAt, currentPlayers: 5 }),
    ...overrides,
  };
}

function memoryStore(failApps = false) {
  const saved = { charts: 0, snapshots: [] as SteamSnapshotInput[], prices: [] as SteamPriceInput[], finished: [] as Array<Record<string, unknown>> };
  const store: SteamDiscoveryStore = {
    startRun: async () => "run-1",
    persistApps: async (listings) => {
      if (failApps) throw new Error("db down");
      return { ids: new Map(listings.map((l) => [l.externalId, `steam-${l.externalId}`])), created: listings.length, metadataChanged: 0 };
    },
    persistCharts: async (entries) => (saved.charts += entries.length),
    persistSnapshots: async (inputs) => {
      saved.snapshots.push(...inputs);
      return { written: inputs.length };
    },
    persistPrices: async (prices) => {
      saved.prices.push(...prices);
      return { written: prices.length };
    },
    finishRun: async (_id, input) => {
      saved.finished.push(input);
    },
  };
  return { store, saved };
}

const options = { topSellersLimit: 100, priceCountries: ["us", "id"] as const, maxGames: 200 };

describe("runSteamDiscovery", () => {
  it("collects both charts, prices per country, and one snapshot per stored game", async () => {
    const source = fakeSource();
    const { store, saved } = memoryStore();
    const result = await runSteamDiscovery(source, store, options, now);

    assert.equal(result.status, "succeeded");
    assert.equal(result.chartGames, 4);
    assert.equal(result.listings, 3);
    assert.equal(result.missing, 1);
    // Chart rows only for games that have a stored listing: 3 most played + 1 top seller ("3").
    assert.equal(saved.charts, 4);
    assert.equal(saved.prices.length, 6);
    assert.deepEqual([...new Set(saved.prices.map((p) => p.currency))].sort(), ["IDR", "USD"]);
    assert.equal(saved.snapshots.length, 3);
    assert.equal(saved.snapshots[0]?.reviews?.total, 10);
    assert.equal(source.listingCalls.length, 2);
  });

  it("caps the games per run, keeping the head of both charts", async () => {
    const source = fakeSource();
    const { store } = memoryStore();
    await runSteamDiscovery(source, store, { ...options, maxGames: 2 }, now);
    assert.deepEqual(source.listingCalls[0], ["1", "3"]);
  });

  it("keeps collecting when one game's reviews fail, and marks the run partial", async () => {
    const source = fakeSource({
      getReviewSummary: async (id) => {
        if (id === "2") throw new Error("HTTP 500");
        return fakeSource().getReviewSummary(id);
      },
    });
    const { store, saved } = memoryStore();
    const result = await runSteamDiscovery(source, store, options, now);

    assert.equal(result.status, "partial");
    assert.match(result.errorSample ?? "", /reviews 2: HTTP 500/);
    const failed = saved.snapshots.find((s) => s.steamAppId === "steam-2");
    assert.equal(failed?.reviews, null);
    assert.equal(failed?.players?.currentPlayers, 5);
  });

  it("still records a chart failure and continues with the other chart", async () => {
    const source = fakeSource({ getTopSellers: async () => { throw new Error("HTTP 503"); } });
    const { store } = memoryStore();
    const result = await runSteamDiscovery(source, store, options, now);
    assert.equal(result.status, "partial");
    assert.equal(result.chartGames, 3);
  });

  it("fails the run when nothing could be listed or stored", async () => {
    const empty = await runSteamDiscovery(
      fakeSource({ getMostPlayed: async () => [], getTopSellers: async () => [] }),
      memoryStore().store,
      options,
      now,
    );
    assert.equal(empty.status, "failed");
    assert.equal(empty.errorSample, "Steam charts returned no games");

    const { store, saved } = memoryStore(true);
    const dbDown = await runSteamDiscovery(fakeSource(), store, options, now);
    assert.equal(dbDown.status, "partial");
    assert.match(dbDown.errorSample ?? "", /persist listings: db down/);
    assert.equal(saved.snapshots.length, 0);
    assert.equal(saved.finished.length, 1);
  });
});
