import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import { createDatabaseConnection } from "../client";
import { appLabels, storeApps } from "../schema/index";
import { loadClassificationInputs } from "../queries/classification-inputs";
import { loadRuleInputHashes, replaceRuleLabels, syncTaxonomyLabels } from "./classification";
import type { DatabaseExecutor } from "./executor";
import { persistStoreApps, type PersistableStoreApp } from "./store-app-persistence";

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
  externalId: "com.example.merge",
  country: "us",
  locale: "en_US",
  title: "Merge Town",
  description: "Merge everything.",
  developerName: null,
  developerExternalId: null,
  storeCategory: "Puzzle",
  releaseDate: null,
  currentVersion: null,
  iconUrl: null,
  storeUrl: "https://play.google.com/store/apps/details?id=com.example.merge",
  metadataHash: "c".repeat(64),
  rawMetadata: { genreId: "GAME_PUZZLE" },
  snapshot: {
    capturedAt: "2026-09-29T10:00:00.000Z",
    rating: 4.5,
    ratingCount: 10,
    reviewCount: null,
    minInstalls: null,
    maxInstalls: null,
    price: 0,
    currency: "USD",
    version: null,
  },
};

const labels = [
  { type: "genre" as const, slug: "puzzle", displayName: "Puzzle" },
  { type: "subgenre" as const, slug: "merge", displayName: "Merge" },
];

after(async () => {
  await connection?.client.end();
});

describe("classification repositories", { skip: connection === null }, () => {
  it("syncs a taxonomy version idempotently", async () => {
    await inRolledBackTransaction(async (tx) => {
      const first = await syncTaxonomyLabels(tx, { taxonomyVersion: "taxonomy-test", labels });
      const second = await syncTaxonomyLabels(tx, { taxonomyVersion: "taxonomy-test", labels });
      assert.equal(first.size, 2);
      assert.deepEqual([...second], [...first]);
    });
  });

  it("reads store genres from raw metadata and the latest price", async () => {
    await inRolledBackTransaction(async (tx) => {
      await persistStoreApps(tx, [game]);
      const inputs = await loadClassificationInputs(tx);
      const listing = inputs.flatMap((i) => i.listings).find((l) => l.title === "Merge Town");
      assert.deepEqual(listing?.storeGenres, ["GAME_PUZZLE"]);
      assert.equal(listing?.price, 0);
    });
  });

  it("replaces an app's previous rule labels but never its manual ones", async () => {
    await inRolledBackTransaction(async (tx) => {
      const stored = await persistStoreApps(tx, [game]);
      const [listing] = await tx
        .select({ appId: storeApps.appId })
        .from(storeApps)
        .where(eq(storeApps.id, [...stored.storeAppIds.values()][0] ?? ""));
      assert.ok(listing);
      const ids = await syncTaxonomyLabels(tx, { taxonomyVersion: "taxonomy-test", labels });
      const puzzle = ids.get("genre:puzzle");
      const merge = ids.get("subgenre:merge");
      assert.ok(puzzle && merge);

      await tx.insert(appLabels).values({
        appId: listing.appId,
        labelId: merge,
        source: "manual",
        confidence: "1.000",
        taxonomyVersion: "taxonomy-test",
        isManualOverride: true,
      });
      const base = { appId: listing.appId, taxonomyVersion: "taxonomy-test", rulesVersion: "rules-test" };
      await replaceRuleLabels(tx, { ...base, inputHash: "h1", labels: [{ labelId: puzzle, confidence: 0.95, evidence: [] }] });
      const again = await replaceRuleLabels(tx, { ...base, inputHash: "h1", labels: [{ labelId: puzzle, confidence: 0.95, evidence: [] }] });
      assert.equal(again.written, 0);

      const changed = await replaceRuleLabels(tx, { ...base, inputHash: "h2", labels: [{ labelId: merge, confidence: 0.8, evidence: [] }] });
      assert.deepEqual(changed, { written: 1, removed: 1 });

      const rows = await tx
        .select({ source: appLabels.source, inputHash: appLabels.inputHash, promptVersion: appLabels.promptVersion })
        .from(appLabels)
        .where(and(eq(appLabels.appId, listing.appId), eq(appLabels.taxonomyVersion, "taxonomy-test")));
      assert.deepEqual(
        rows.map((r) => `${r.source}:${r.inputHash}`).sort(),
        ["manual:manual", "rule:h2"],
      );
      assert.equal(rows.find((r) => r.source === "rule")?.promptVersion, "rules-test");
      assert.equal((await loadRuleInputHashes(tx, "taxonomy-test")).get(listing.appId), "h2");
    });
  });
});
