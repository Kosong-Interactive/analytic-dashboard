import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createDatabaseConnection } from "../client";
import type { DatabaseExecutor } from "./executor";
import { persistStoreApps, type PersistableStoreApp } from "./store-app-persistence";
import {
  addWatchlistEntry,
  findWatchlistEntry,
  loadWatchlist,
  removeWatchlistEntry,
  updateWatchlistEntry,
} from "./watchlist";

// Needs a migrated PostgreSQL. Every test rolls back, so nothing is left behind.
const connectionString = process.env.TEST_DATABASE_URL;
const connection = connectionString ? createDatabaseConnection(connectionString) : null;

class Rollback extends Error {}

async function inRolledBackTransaction(run: (tx: DatabaseExecutor) => Promise<void>): Promise<void> {
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

const game: PersistableStoreApp = {
  store: "google_play",
  externalId: "com.example.watch",
  country: "id",
  locale: "id_ID",
  title: "Watch Me",
  description: null,
  developerName: "Studio",
  developerExternalId: null,
  storeCategory: "Puzzle",
  releaseDate: null,
  currentVersion: null,
  iconUrl: null,
  storeUrl: "https://play.google.com/store/apps/details?id=com.example.watch",
  metadataHash: "d".repeat(64),
  rawMetadata: {},
  snapshot: {
    capturedAt: "2026-09-29T10:00:00.000Z",
    rating: 4.25,
    ratingCount: 1200,
    reviewCount: null,
    minInstalls: null,
    maxInstalls: null,
    price: 0,
    currency: "IDR",
    version: null,
  },
};

after(async () => {
  await connection?.client.end();
});

describe("watchlist repository", { skip: connection === null }, () => {
  it("adds once with a baseline, updates with the actor, and removes", async () => {
    await inRolledBackTransaction(async (tx) => {
      const stored = await persistStoreApps(tx, [game]);
      const storeAppId = [...stored.storeAppIds.values()][0] ?? "";

      assert.equal(await addWatchlistEntry(tx, { storeAppId, actor: "a@example.com" }), true);
      assert.equal(await addWatchlistEntry(tx, { storeAppId, actor: "b@example.com" }), false);

      const [entry] = await loadWatchlist(tx, { stores: ["google_play"], country: "id" });
      assert.equal(entry?.addedBy, "a@example.com");
      assert.equal(entry?.status, "watching");
      assert.equal(entry?.baselineRating, 4.25);
      assert.equal(entry?.baselineRatingCount, 1200);
      assert.deepEqual(await loadWatchlist(tx, { stores: ["google_play"], country: "us" }), []);

      assert.equal(await updateWatchlistEntry(tx, { storeAppId, actor: "b@example.com", status: "priority", note: "Check D7" }), true);
      const updated = await findWatchlistEntry(tx, storeAppId);
      assert.equal(updated?.status, "priority");
      assert.equal(updated?.note, "Check D7");
      const [reloaded] = await loadWatchlist(tx, { stores: ["google_play"], country: "id" });
      assert.equal(reloaded?.updatedBy, "b@example.com");
      assert.equal(reloaded?.addedBy, "a@example.com");

      assert.equal(await removeWatchlistEntry(tx, storeAppId), true);
      assert.equal(await findWatchlistEntry(tx, storeAppId), null);
      assert.equal(await updateWatchlistEntry(tx, { storeAppId, actor: "b@example.com", status: "archived" }), false);
    });
  });
});
