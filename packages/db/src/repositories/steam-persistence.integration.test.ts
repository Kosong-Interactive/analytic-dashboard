import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../client";
import { steamApps, steamPrices, steamSnapshots } from "../schema/index";
import type { DatabaseExecutor } from "./executor";
import {
  finishSteamCollectorRun,
  persistSteamApps,
  persistSteamChartEntries,
  persistSteamPrices,
  persistSteamSnapshots,
  startSteamCollectorRun,
  type PersistableSteamListing,
} from "./steam-persistence";

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

const at = (hours: number) => new Date(Date.UTC(2026, 8, 30, hours));

const listing = (overrides: Partial<PersistableSteamListing> = {}): PersistableSteamListing => ({
  externalId: "730",
  title: "Counter-Strike 2",
  description: "Competitive shooter.",
  developerNames: ["Valve"],
  publisherNames: ["Valve"],
  genres: [],
  categories: ["Multi-player"],
  tags: ["FPS"],
  releaseState: "released",
  releaseDate: "2012-08-21T17:00:00.000Z",
  supportedOperatingSystems: { windows: true, macos: false, linux: true },
  isFree: true,
  headerImageUrl: null,
  storeUrl: "https://store.steampowered.com/app/730/",
  source: "steam_web_api",
  capturedAt: at(1).toISOString(),
  ...overrides,
});

const reviews = (positive: number, hours: number) => ({
  capturedAt: at(hours).toISOString(),
  purchaseScope: "all",
  languageScope: ["all"],
  offTopicActivityFiltered: true,
  positive,
  negative: 10,
  total: positive + 10,
});

after(async () => {
  await connection?.client.end();
});

describe("steam persistence", { skip: connection === null }, () => {
  it("upserts listings idempotently and only rewrites metadata when it changes", async () => {
    await inRolledBackTransaction(async (tx) => {
      const first = await persistSteamApps(tx, [listing()]);
      const again = await persistSteamApps(tx, [listing({ capturedAt: at(2).toISOString() })]);
      const renamed = await persistSteamApps(tx, [listing({ title: "CS2", capturedAt: at(3).toISOString() })]);

      assert.deepEqual([first.created, again.created, again.metadataChanged, renamed.metadataChanged], [1, 0, 0, 1]);
      const [row] = await tx.select().from(steamApps).where(eq(steamApps.externalId, "730"));
      assert.equal(row?.title, "CS2");
      assert.deepEqual(row?.lastSeenAt, at(3));
    });
  });

  it("writes change-only snapshots and keeps a missing group null", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ids } = await persistSteamApps(tx, [listing()]);
      const steamAppId = ids.get("730");
      assert.ok(steamAppId);

      const first = await persistSteamSnapshots(tx, [
        { steamAppId, capturedAt: at(1), reviews: reviews(100, 1), players: null },
      ]);
      const unchanged = await persistSteamSnapshots(tx, [
        { steamAppId, capturedAt: at(2), reviews: reviews(100, 2), players: null },
      ]);
      const changed = await persistSteamSnapshots(tx, [
        { steamAppId, capturedAt: at(3), reviews: reviews(105, 3), players: { capturedAt: at(3).toISOString(), currentPlayers: 42 } },
      ]);

      assert.deepEqual([first.written, unchanged.written, changed.written], [1, 0, 1]);
      const rows = await tx.select().from(steamSnapshots).where(eq(steamSnapshots.steamAppId, steamAppId));
      assert.equal(rows.length, 2);
      const earliest = rows.find((row) => row.capturedAt.getTime() === at(1).getTime());
      assert.equal(earliest?.currentPlayers, null);
      assert.equal(earliest?.reviewTotal, 110);
    });
  });

  it("rejects review totals that do not add up", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ids } = await persistSteamApps(tx, [listing()]);
      const steamAppId = ids.get("730");
      assert.ok(steamAppId);
      await assert.rejects(() =>
        persistSteamSnapshots(tx, [
          { steamAppId, capturedAt: at(1), reviews: { ...reviews(100, 1), total: 999 }, players: null },
        ]),
      );
    });
  });

  it("stores chart entries idempotently and prices only when they change", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ids } = await persistSteamApps(tx, [listing()]);
      const steamAppId = ids.get("730");
      assert.ok(steamAppId);

      const entry = { steamAppId, chart: "most_played" as const, rank: 1, lastWeekRank: 1, capturedAt: at(1) };
      assert.equal(await persistSteamChartEntries(tx, [entry]), 1);
      assert.equal(await persistSteamChartEntries(tx, [entry]), 0);

      const price = { steamAppId, country: "id", currency: "IDR", initialPrice: 150_000, finalPrice: 75_000, discountPercent: 50 };
      const writes = [
        await persistSteamPrices(tx, [{ ...price, capturedAt: at(1) }]),
        await persistSteamPrices(tx, [{ ...price, capturedAt: at(2) }]),
        await persistSteamPrices(tx, [{ ...price, finalPrice: 150_000, discountPercent: 0, capturedAt: at(3) }]),
      ];
      assert.deepEqual(writes.map((w) => w.written), [1, 0, 1]);
      assert.equal((await tx.select().from(steamPrices).where(eq(steamPrices.steamAppId, steamAppId))).length, 2);
    });
  });

  it("finishes a Steam collector run only once", async () => {
    await inRolledBackTransaction(async (tx) => {
      const runId = await startSteamCollectorRun(tx, { jobType: "steam.discovery", startedAt: at(1) });
      const result = {
        status: "succeeded" as const,
        finishedAt: at(2),
        discoveredCount: 5,
        changedCount: 5,
        retryCount: 0,
        errorCount: 0,
        errorSample: null,
      };
      assert.equal(await finishSteamCollectorRun(tx, runId, result), true);
      assert.equal(await finishSteamCollectorRun(tx, runId, result), false);
    });
  });
});
