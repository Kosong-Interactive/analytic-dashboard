import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createDatabaseConnection } from "../client";
import { appSnapshots, apps, chartEntries, storeApps } from "../schema/index";
import {
  finishCollectorRun,
  startCollectorRun,
} from "./collector-runs";
import type { DatabaseExecutor } from "./executor";
import {
  persistChartEntries,
  persistStoreApps,
  type PersistableStoreApp,
} from "./store-app-persistence";

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

function game(
  overrides: Partial<PersistableStoreApp> = {},
  snapshot: Partial<PersistableStoreApp["snapshot"]> = {},
): PersistableStoreApp {
  return {
    store: "google_play",
    externalId: "com.example.puzzle",
    country: "us",
    locale: "en_US",
    title: "Puzzle Quest",
    description: "A puzzle game.",
    developerName: "Example Games",
    developerExternalId: "example-games",
    storeCategory: "Puzzle",
    releaseDate: "2025-01-02T00:00:00.000Z",
    currentVersion: "1.2.3",
    iconUrl: "https://example.com/icon.png",
    storeUrl: "https://play.google.com/store/apps/details?id=com.example.puzzle",
    metadataHash: "a".repeat(64),
    rawMetadata: { appId: "com.example.puzzle" },
    snapshot: {
      capturedAt: "2026-09-29T10:00:00.000Z",
      rating: 4.778066,
      ratingCount: 12_345,
      reviewCount: 456,
      minInstalls: 100_000,
      maxInstalls: 188_000,
      price: 0,
      currency: "USD",
      version: "1.2.3",
      ...snapshot,
    },
    ...overrides,
  };
}

describe("store app persistence", { skip: connection === null }, () => {
  after(async () => {
    await connection?.client.end();
  });

  it("is idempotent when the same observation is persisted twice", async () => {
    await inRolledBackTransaction(async (tx) => {
      const first = await persistStoreApps(tx, [game()]);
      const second = await persistStoreApps(tx, [game()]);

      assert.equal(first.newStoreApps, 1);
      assert.equal(first.snapshotsWritten, 1);
      assert.equal(second.newStoreApps, 0);
      assert.equal(second.snapshotsWritten, 0);
      assert.equal((await tx.select().from(storeApps)).length, 1);
      assert.equal((await tx.select().from(appSnapshots)).length, 1);
    });
  });

  it("skips an unchanged later observation and records a changed one", async () => {
    await inRolledBackTransaction(async (tx) => {
      await persistStoreApps(tx, [game()]);
      const unchanged = await persistStoreApps(tx, [
        game({}, { capturedAt: "2026-09-29T11:00:00.000Z" }),
      ]);
      const changed = await persistStoreApps(tx, [
        game({}, { capturedAt: "2026-09-29T12:00:00.000Z", reviewCount: 500 }),
      ]);
      const heartbeat = await persistStoreApps(tx, [
        game(
          {},
          {
            capturedAt: "2026-09-30T13:00:00.000Z",
            reviewCount: 500,
          },
        ),
      ]);

      assert.equal(unchanged.snapshotsWritten, 0);
      assert.equal(changed.snapshotsWritten, 1);
      assert.equal(heartbeat.snapshotsWritten, 1);
      assert.equal((await tx.select().from(appSnapshots)).length, 3);
    });
  });

  it("stores a missing metric as null and an install range as a range", async () => {
    await inRolledBackTransaction(async (tx) => {
      await persistStoreApps(tx, [
        game({}, { reviewCount: null, minInstalls: 1_000, maxInstalls: 5_000 }),
      ]);
      const [snapshot] = await tx.select().from(appSnapshots);

      assert.equal(snapshot?.reviewCount, null);
      assert.equal(snapshot?.minInstalls, 1_000);
      assert.equal(snapshot?.maxInstalls, 5_000);
      assert.equal(snapshot?.rating, "4.78");
    });
  });

  it("updates metadata in place when the metadata hash changes", async () => {
    await inRolledBackTransaction(async (tx) => {
      await persistStoreApps(tx, [game()]);
      const result = await persistStoreApps(tx, [
        game(
          { title: "Puzzle Quest 2", metadataHash: "b".repeat(64) },
          { capturedAt: "2026-09-29T11:00:00.000Z" },
        ),
      ]);
      const rows = await tx.select().from(storeApps);

      assert.equal(result.metadataUpdated, 1);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.title, "Puzzle Quest 2");
      assert.equal(
        rows[0]?.firstSeenAt.toISOString(),
        "2026-09-29T10:00:00.000Z",
      );
    });
  });

  it("shares one canonical app across countries for the same store id", async () => {
    await inRolledBackTransaction(async (tx) => {
      await persistStoreApps(tx, [game({ country: "us" })]);
      await persistStoreApps(tx, [
        game({ country: "id", locale: "id_ID" }),
      ]);

      assert.equal((await tx.select().from(storeApps)).length, 2);
      assert.equal((await tx.select().from(apps)).length, 1);
    });
  });

  it("does not merge different stores that only share a title", async () => {
    await inRolledBackTransaction(async (tx) => {
      await persistStoreApps(tx, [
        game(),
        game({ store: "app_store", externalId: "1324604053" }),
      ]);

      assert.equal((await tx.select().from(apps)).length, 2);
    });
  });

  it("ignores a repeated chart observation", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { storeAppIds } = await persistStoreApps(tx, [game()]);
      const storeAppId = [...storeAppIds.values()][0];
      assert.ok(storeAppId);
      const chart = {
        chartType: "TOP_FREE",
        category: "GAME",
        country: "us",
        capturedAt: new Date("2026-09-29T10:00:00.000Z"),
        entries: [{ storeAppId, rank: 3 }],
      };

      assert.equal(await persistChartEntries(tx, chart), 1);
      assert.equal(await persistChartEntries(tx, chart), 0);
      assert.equal((await tx.select().from(chartEntries)).length, 1);
    });
  });

  it("finishes a collector run only once", async () => {
    await inRolledBackTransaction(async (tx) => {
      const runId = await startCollectorRun(tx, {
        source: "google_play",
        jobType: "discovery.chart",
        country: "us",
        locale: "en_US",
        startedAt: new Date("2026-09-29T10:00:00.000Z"),
      });
      const result = {
        status: "succeeded" as const,
        finishedAt: new Date("2026-09-29T10:01:00.000Z"),
        discoveredCount: 10,
        changedCount: 4,
        retryCount: 0,
        errorCount: 0,
        errorSample: null,
      };

      assert.equal(await finishCollectorRun(tx, runId, result), true);
      assert.equal(
        await finishCollectorRun(tx, runId, { ...result, status: "failed" }),
        false,
      );
    });
  });
});
