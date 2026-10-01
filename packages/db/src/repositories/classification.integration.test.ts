import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { and, eq } from "drizzle-orm";

import { createDatabaseConnection } from "../client";
import { appLabels, classificationRuns, steamApps, storeApps } from "../schema/index";
import { loadClassificationInputs } from "../queries/classification-inputs";
import { loadLabelMembership } from "../queries/label-membership";
import { loadListingLabels } from "../queries/listing-labels";
import { loadSteamGameLabels, loadSteamLabelMembership } from "../queries/steam-labels";
import {
  clearManualLabel,
  clearSteamManualLabel,
  findSteamAppId,
  loadInputHashes,
  loadRuleInputHashes,
  replaceAutomatedLabels,
  replaceRuleLabels,
  replaceSteamAutomatedLabels,
  setManualLabel,
  setSteamManualLabel,
  syncTaxonomyLabels,
} from "./classification";
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

  it("resolves membership per listing: manual wins, weak automated labels are dropped", async () => {
    await inRolledBackTransaction(async (tx) => {
      const stored = await persistStoreApps(tx, [game]);
      const storeAppId = [...stored.storeAppIds.values()][0] ?? "";
      const [listing] = await tx.select({ appId: storeApps.appId }).from(storeApps).where(eq(storeApps.id, storeAppId));
      assert.ok(listing);
      const ids = await syncTaxonomyLabels(tx, { taxonomyVersion: "taxonomy-test", labels });
      const puzzle = ids.get("genre:puzzle");
      const merge = ids.get("subgenre:merge");
      assert.ok(puzzle && merge);

      await replaceRuleLabels(tx, {
        appId: listing.appId,
        taxonomyVersion: "taxonomy-test",
        rulesVersion: "rules-test",
        inputHash: "h1",
        labels: [
          { labelId: puzzle, confidence: 0.95, evidence: [] },
          { labelId: merge, confidence: 0.55, evidence: [] },
        ],
      });
      await tx.insert(appLabels).values({
        appId: listing.appId,
        labelId: puzzle,
        source: "manual",
        confidence: "1.000",
        taxonomyVersion: "taxonomy-test",
        isManualOverride: true,
      });

      const rows = await loadLabelMembership(tx, {
        stores: ["google_play"],
        country: "us",
        taxonomyVersion: "taxonomy-test",
        types: ["genre", "subgenre"],
        minConfidence: 0.6,
      });
      assert.deepEqual(
        rows.map((r) => `${r.storeAppId === storeAppId}:${r.slug}:${r.source}`),
        ["true:puzzle:manual"],
      );
    });
  });

  it("records one manual decision per label, hides a rejected label, and can be cleared", async () => {
    await inRolledBackTransaction(async (tx) => {
      const stored = await persistStoreApps(tx, [game]);
      const [listing] = await tx
        .select({ appId: storeApps.appId })
        .from(storeApps)
        .where(eq(storeApps.id, [...stored.storeAppIds.values()][0] ?? ""));
      assert.ok(listing);
      const ids = await syncTaxonomyLabels(tx, { taxonomyVersion: "taxonomy-test", labels });
      const puzzle = ids.get("genre:puzzle");
      assert.ok(puzzle);
      await replaceRuleLabels(tx, {
        appId: listing.appId,
        taxonomyVersion: "taxonomy-test",
        rulesVersion: "rules-test",
        inputHash: "h1",
        labels: [{ labelId: puzzle, confidence: 0.95, evidence: [] }],
      });
      const decision = {
        appId: listing.appId,
        labelId: puzzle,
        taxonomyVersion: "taxonomy-test",
        actor: "analyst@example.com",
        decidedAt: new Date("2026-09-30T10:00:00Z"),
      };
      const membership = () =>
        loadLabelMembership(tx, {
          stores: ["google_play"],
          country: "us",
          taxonomyVersion: "taxonomy-test",
          types: ["genre"],
          minConfidence: 0.6,
        });

      await setManualLabel(tx, { ...decision, decision: "confirm" });
      await setManualLabel(tx, { ...decision, decision: "reject" });
      const manualRows = await tx
        .select({ confidence: appLabels.confidence })
        .from(appLabels)
        .where(and(eq(appLabels.appId, listing.appId), eq(appLabels.source, "manual")));
      assert.deepEqual(manualRows.map((r) => r.confidence), ["0.000"]);
      assert.deepEqual(await membership(), []);

      // Reclassification never removes the manual decision.
      await replaceRuleLabels(tx, {
        appId: listing.appId,
        taxonomyVersion: "taxonomy-test",
        rulesVersion: "rules-test",
        inputHash: "h2",
        labels: [{ labelId: puzzle, confidence: 0.95, evidence: [] }],
      });
      assert.deepEqual(await membership(), []);

      assert.equal(await clearManualLabel(tx, decision), true);
      assert.deepEqual((await membership()).map((r) => `${r.slug}:${r.source}`), ["puzzle:rule"]);
    });
  });

  it("records Steam manual decisions that override and survive automated labels", async () => {
    await inRolledBackTransaction(async (tx) => {
      const [steamGame] = await tx
        .insert(steamApps)
        .values({
          externalId: "999999999991",
          title: "Steam manual-label integration fixture",
          description: "Competitive shooter.",
          releaseState: "released",
          supportsWindows: true,
          supportsMacos: false,
          supportsLinux: true,
          isFree: true,
          storeUrl: "https://store.steampowered.com/app/999999999991/",
          source: "test",
          metadataHash: "s".repeat(64),
        })
        .returning({ id: steamApps.id });
      assert.ok(steamGame);
      assert.equal(await findSteamAppId(tx, steamGame.id), steamGame.id);

      const ids = await syncTaxonomyLabels(tx, { taxonomyVersion: "taxonomy-steam-test", labels });
      const puzzle = ids.get("genre:puzzle");
      assert.ok(puzzle);
      await replaceSteamAutomatedLabels(tx, {
        source: "rule",
        steamAppId: steamGame.id,
        taxonomyVersion: "taxonomy-steam-test",
        classifierVersion: "steam-rules-test",
        model: null,
        inputHash: "r1",
        labels: [{ labelId: puzzle, confidence: 0.95, evidence: [] }],
      });

      const decision = {
        steamAppId: steamGame.id,
        labelId: puzzle,
        taxonomyVersion: "taxonomy-steam-test",
        actor: "analyst@example.com",
        decidedAt: new Date("2026-10-01T10:00:00Z"),
      };
      await setSteamManualLabel(tx, { ...decision, decision: "confirm" });
      assert.deepEqual(
        (await loadSteamLabelMembership(tx, {
          taxonomyVersion: "taxonomy-steam-test",
          types: ["genre"],
          minConfidence: 0.6,
        })).map((row) => `${row.slug}:${row.source}`),
        ["puzzle:manual"],
      );

      await setSteamManualLabel(tx, { ...decision, decision: "reject" });
      assert.deepEqual(
        await loadSteamLabelMembership(tx, {
          taxonomyVersion: "taxonomy-steam-test",
          types: ["genre"],
          minConfidence: 0.6,
        }),
        [],
      );
      const detail = await loadSteamGameLabels(tx, {
        steamAppId: steamGame.id,
        taxonomyVersion: "taxonomy-steam-test",
      });
      assert.deepEqual(detail.map((row) => `${row.source}:${row.confidence}`).sort(), ["manual:0", "rule:0.95"]);

      await replaceSteamAutomatedLabels(tx, {
        source: "rule",
        steamAppId: steamGame.id,
        taxonomyVersion: "taxonomy-steam-test",
        classifierVersion: "steam-rules-test",
        model: null,
        inputHash: "r2",
        labels: [{ labelId: puzzle, confidence: 0.9, evidence: [] }],
      });
      assert.equal(await clearSteamManualLabel(tx, decision), true);
      const membership = await loadSteamLabelMembership(tx, {
        taxonomyVersion: "taxonomy-steam-test",
        types: ["genre"],
        minConfidence: 0.6,
      });
      assert.deepEqual(membership.map((row) => `${row.slug}:${row.source}`), ["puzzle:rule"]);
    });
  });

  it("caches AI results by input hash, including empty ones, without touching rule or manual labels", async () => {
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

      await replaceRuleLabels(tx, {
        appId: listing.appId,
        taxonomyVersion: "taxonomy-test",
        rulesVersion: "rules-test",
        inputHash: "r1",
        labels: [{ labelId: puzzle, confidence: 0.95, evidence: [] }],
      });
      await setManualLabel(tx, {
        appId: listing.appId,
        labelId: merge,
        taxonomyVersion: "taxonomy-test",
        decision: "reject",
        actor: "analyst@example.com",
        decidedAt: new Date("2026-09-30T10:00:00Z"),
      });
      const ai = { source: "ai" as const, appId: listing.appId, taxonomyVersion: "taxonomy-test", classifierVersion: "prompt-test" };

      const first = await replaceAutomatedLabels(tx, {
        ...ai,
        model: "model-a",
        inputHash: "a1",
        labels: [{ labelId: merge, confidence: 0.8, evidence: [{ field: "title", excerpt: "Merge" }] }],
      });
      assert.deepEqual(first, { written: 1, removed: 0 });
      assert.equal((await loadInputHashes(tx, "ai", "taxonomy-test")).get(listing.appId), "a1");

      // A changed input whose correct result is empty removes the old AI label and is still cached.
      const empty = await replaceAutomatedLabels(tx, { ...ai, model: "model-b", inputHash: "a2", labels: [] });
      assert.deepEqual(empty, { written: 0, removed: 1 });
      assert.equal((await loadInputHashes(tx, "ai", "taxonomy-test")).get(listing.appId), "a2");
      assert.equal((await loadInputHashes(tx, "rule", "taxonomy-test")).get(listing.appId), "r1");

      const runs = await tx
        .select({ source: classificationRuns.source, model: classificationRuns.model, labelCount: classificationRuns.labelCount })
        .from(classificationRuns)
        .where(eq(classificationRuns.appId, listing.appId));
      assert.deepEqual(
        runs.map((r) => `${r.source}:${r.model}:${r.labelCount}`).sort(),
        ["ai:model-b:0", "rule:null:1"],
      );

      const rows = await tx
        .select({ source: appLabels.source, confidence: appLabels.confidence })
        .from(appLabels)
        .where(eq(appLabels.appId, listing.appId));
      assert.deepEqual(rows.map((r) => `${r.source}:${r.confidence}`).sort(), ["manual:0.000", "rule:0.950"]);
    });
  });

  it("lets an AI result replace the app's rule labels, including rule false positives, but never manual ones", async () => {
    await inRolledBackTransaction(async (tx) => {
      const stored = await persistStoreApps(tx, [game]);
      const storeAppId = [...stored.storeAppIds.values()][0] ?? "";
      const [listing] = await tx.select({ appId: storeApps.appId }).from(storeApps).where(eq(storeApps.id, storeAppId));
      assert.ok(listing);
      const ids = await syncTaxonomyLabels(tx, { taxonomyVersion: "taxonomy-test", labels });
      const puzzle = ids.get("genre:puzzle");
      const merge = ids.get("subgenre:merge");
      assert.ok(puzzle && merge);
      const membership = async () =>
        (
          await loadLabelMembership(tx, {
            stores: ["google_play"],
            country: "us",
            taxonomyVersion: "taxonomy-test",
            types: ["genre", "subgenre"],
            minConfidence: 0.6,
          })
        ).map((r) => `${r.slug}:${r.source}`).sort();

      await replaceRuleLabels(tx, {
        appId: listing.appId,
        taxonomyVersion: "taxonomy-test",
        rulesVersion: "rules-test",
        inputHash: "r1",
        labels: [
          { labelId: puzzle, confidence: 0.95, evidence: [] },
          { labelId: merge, confidence: 0.8, evidence: [] },
        ],
      });
      assert.deepEqual(await membership(), ["merge:rule", "puzzle:rule"]);

      // The AI keeps "merge" but not the rule's "puzzle".
      await replaceAutomatedLabels(tx, {
        source: "ai",
        appId: listing.appId,
        taxonomyVersion: "taxonomy-test",
        classifierVersion: "prompt-test",
        model: "model-a",
        inputHash: "a1",
        labels: [{ labelId: merge, confidence: 0.9, evidence: [] }],
      });
      assert.deepEqual(await membership(), ["merge:ai"]);
      const detail = await loadListingLabels(tx, { storeAppId, taxonomyVersion: "taxonomy-test" });
      assert.deepEqual(detail.map((r) => `${r.slug}:${r.source}`), ["merge:ai"]);

      await setManualLabel(tx, {
        appId: listing.appId,
        labelId: puzzle,
        taxonomyVersion: "taxonomy-test",
        decision: "confirm",
        actor: "analyst@example.com",
        decidedAt: new Date("2026-09-30T10:00:00Z"),
      });
      assert.deepEqual(await membership(), ["merge:ai", "puzzle:manual"]);
    });
  });
});
