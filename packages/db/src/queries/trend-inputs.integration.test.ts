import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createDatabaseConnection } from "../client";
import type { DatabaseExecutor } from "../repositories/executor";
import {
  persistChartEntries,
  persistStoreApps,
  type PersistableStoreApp,
} from "../repositories/store-app-persistence";
import { loadGameHistory } from "./game-history";
import { loadTrendCandidates } from "./trend-inputs";

// Needs a migrated PostgreSQL. Every test rolls back, so nothing is left behind.
const connectionString = process.env.TEST_DATABASE_URL;
const connection = connectionString
  ? createDatabaseConnection(connectionString)
  : null;

class Rollback extends Error {}

async function inRolledBackTransaction(
  run: (tx: DatabaseExecutor) => Promise<void>,
): Promise<void> {
  const database = connection?.db;
  assert.ok(database);
  await assert.rejects(
    () =>
      database.transaction(async (tx) => {
        await run(tx);
        throw new Rollback();
      }),
    Rollback,
  );
}

const at = (day: number) => new Date(Date.UTC(2026, 8, day, 12));

function game(
  externalId: string,
  country: "us" | "id",
  day: number,
  reviewCount: number,
): PersistableStoreApp {
  return {
    store: "google_play",
    externalId,
    country,
    locale: country === "us" ? "en_US" : "id_ID",
    title: externalId,
    description: null,
    developerName: null,
    developerExternalId: null,
    storeCategory: "GAME_PUZZLE",
    releaseDate: null,
    currentVersion: null,
    iconUrl: null,
    storeUrl: `https://play.google.com/store/apps/details?id=${externalId}`,
    metadataHash: "b".repeat(64),
    rawMetadata: {},
    snapshot: {
      capturedAt: at(day).toISOString(),
      rating: 4.5,
      ratingCount: reviewCount * 10,
      reviewCount,
      minInstalls: null,
      maxInstalls: null,
      price: null,
      currency: null,
      version: null,
    },
  };
}

// File-level so the connection stays open until every suite in this file has run.
after(async () => {
  await connection?.client.end();
});

describe("loadTrendCandidates", { skip: connection === null }, () => {
  it("returns ordered snapshots, chart ranks, and country breadth for one storefront", async () => {
    await inRolledBackTransaction(async (tx) => {
      const first = await persistStoreApps(tx, [game("com.a", "us", 1, 100)]);
      await persistStoreApps(tx, [game("com.a", "us", 9, 150)]);
      await persistStoreApps(tx, [game("com.a", "id", 9, 40)]);
      await persistStoreApps(tx, [game("com.b", "id", 9, 5)]);

      const storeAppId = [...first.storeAppIds.values()][0];
      assert.ok(storeAppId);
      await persistChartEntries(tx, {
        chartType: "TOP_FREE",
        category: "GAME",
        country: "us",
        capturedAt: at(9),
        entries: [{ storeAppId, rank: 4 }],
      });

      const candidates = await loadTrendCandidates(tx, {
        store: "google_play",
        country: "us",
        asOf: at(10),
        windowDays: 7,
        chartType: "TOP_FREE",
      });

      assert.equal(candidates.length, 1);
      const [candidate] = candidates;
      assert.deepEqual(
        candidate?.snapshots.map((s) => s.reviewCount),
        [100, 150],
      );
      assert.deepEqual(
        candidate?.ranks.map((r) => r.rank),
        [4],
      );
      assert.equal(candidate?.snapshots[0]?.rating, 4.5);
      // "com.a" is listed in two storefronts now; only "us" existed a window ago.
      assert.deepEqual(candidate?.countryBreadth, { current: 2, previous: 1 });
    });
  });

  it("includes the reading in force before the history window", async () => {
    await inRolledBackTransaction(async (tx) => {
      await persistStoreApps(tx, [game("com.a", "us", 1, 100)]);

      const [candidate] = await loadTrendCandidates(tx, {
        store: "google_play",
        country: "us",
        asOf: at(25),
        windowDays: 7,
      });

      assert.deepEqual(
        candidate?.snapshots.map((s) => s.reviewCount),
        [100],
      );
    });
  });

  it("returns nothing for a storefront with no listings", async () => {
    await inRolledBackTransaction(async (tx) => {
      const result = await loadTrendCandidates(tx, {
        store: "app_store",
        country: "id",
        asOf: at(10),
        windowDays: 7,
      });
      assert.deepEqual(result, []);
    });
  });
});

describe("loadGameHistory", { skip: connection === null }, () => {
  it("returns the listing, its history since a date with the baseline reading, and sibling listings", async () => {
    await inRolledBackTransaction(async (tx) => {
      const first = await persistStoreApps(tx, [game("com.a", "us", 1, 100)]);
      await persistStoreApps(tx, [game("com.a", "us", 5, 120)]);
      await persistStoreApps(tx, [game("com.a", "us", 9, 150)]);
      await persistStoreApps(tx, [game("com.a", "id", 9, 40)]);
      const storeAppId = [...first.storeAppIds.values()][0];
      assert.ok(storeAppId);

      const history = await loadGameHistory(tx, { storeAppId, since: at(4) });

      assert.equal(history?.listing.externalId, "com.a");
      // Day 1 is before `since` but is the reading in force at day 4, so it is kept.
      assert.deepEqual(history?.snapshots.map((s) => s.reviewCount), [100, 120, 150]);
      assert.deepEqual(history?.siblings.map((s) => s.country), ["id"]);
    });
  });

  it("returns null for an unknown listing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const history = await loadGameHistory(tx, {
        storeAppId: "00000000-0000-4000-8000-000000000000",
        since: at(1),
      });
      assert.equal(history, null);
    });
  });
});
