import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTaxonomy, STEAM_RULES_VERSION } from "@analytic-dashboard/classifier";
import type { SteamClassificationInputRow } from "@analytic-dashboard/db";

import { runAiClassification } from "./ai-classification.js";
import {
  runSteamRuleClassification,
  toAiClassificationInput,
  toAiClassificationStore,
  toClassificationInput,
  type SteamClassificationStore,
} from "./steam-classification.js";

const taxonomy = parseTaxonomy({
  version: "taxonomy-v2",
  labels: {
    genre: { action: "Action" },
    subgenre: { roguelike: "Roguelike" },
    core_mechanic: { deckbuilding: "Deckbuilding" },
    meta_mechanic: {},
    theme: {},
    multiplayer_mode: {},
    monetization_clue: { free_to_play: "Free to play", premium: "Premium (paid)" },
  },
});

const row = (overrides: Partial<SteamClassificationInputRow> = {}): SteamClassificationInputRow => ({
  steamAppId: "s1",
  title: "Spire Cards",
  description: null,
  genres: [],
  tags: ["Roguelike", "Deckbuilder"],
  isFree: false,
  usPrice: 14.99,
  ...overrides,
});

function memoryStore(rows: SteamClassificationInputRow[], hashes = new Map<string, string>()) {
  const writes: Array<{ steamAppId: string; labels: number; inputHash: string; rulesVersion: string }> = [];
  const store: SteamClassificationStore = {
    syncTaxonomy: async (_v, labels) => new Map(labels.map((l, i) => [`${l.type}:${l.slug}`, `label-${i}`])),
    loadInputs: async () => rows,
    loadRuleInputHashes: async () => hashes,
    replaceRuleLabels: async (input) => {
      writes.push({ steamAppId: input.steamAppId, labels: input.labels.length, inputHash: input.inputHash, rulesVersion: input.rulesVersion });
      return { written: input.labels.length, removed: 0 };
    },
  };
  return { store, writes };
}

describe("toClassificationInput", () => {
  it("treats a free game as price 0 and an unknown price as null", () => {
    assert.equal(toClassificationInput(row({ isFree: true, usPrice: null })).listings[0]?.price, 0);
    assert.equal(toClassificationInput(row({ usPrice: null })).listings[0]?.price, null);
  });
});

describe("runSteamRuleClassification", () => {
  it("labels from Steam tags with the Steam rules version", async () => {
    const { store, writes } = memoryStore([row()]);
    const summary = await runSteamRuleClassification(taxonomy, store);

    assert.equal(summary.rulesVersion, STEAM_RULES_VERSION);
    // subgenre:roguelike, core_mechanic:deckbuilding, monetization_clue:premium
    assert.equal(writes[0]?.labels, 3);
  });

  it("skips a game whose input hash is unchanged and caches an empty result", async () => {
    const first = memoryStore([row(), row({ steamAppId: "s2", tags: [], usPrice: null })]);
    await runSteamRuleClassification(taxonomy, first.store);
    assert.deepEqual(first.writes.map((w) => w.labels), [3, 0]);

    const hashes = new Map(first.writes.map((w) => [w.steamAppId, w.inputHash]));
    const second = memoryStore([row(), row({ steamAppId: "s2", tags: [], usPrice: null })], hashes);
    const summary = await runSteamRuleClassification(taxonomy, second.store);
    assert.equal(summary.unchanged, 2);
    assert.equal(second.writes.length, 0);
  });

  it("records a failed write and keeps going", async () => {
    const { store } = memoryStore([row(), row({ steamAppId: "s2" })]);
    store.replaceRuleLabels = async (input) => {
      if (input.steamAppId === "s1") throw new Error("write failed");
      return { written: 1, removed: 0 };
    };
    const summary = await runSteamRuleClassification(taxonomy, store);
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.classified, 1);
  });
});

describe("Steam AI classification", () => {
  it("sends Steam genres and tags as store genres, without duplicates", () => {
    const input = toAiClassificationInput(row({ genres: ["Action"], tags: ["Roguelike", "Action"], isFree: true }));
    assert.equal(input.appId, "s1");
    assert.deepEqual(input.listings[0]?.storeGenres, ["Action", "Roguelike"]);
    assert.equal(input.listings[0]?.price, 0);
    assert.equal(input.listings[0]?.store, "steam");
  });

  it("runs the shared AI job over Steam games and stores labels per Steam game", async () => {
    const written: Array<{ steamAppId: string; labels: number; model: string; inputHash: string }> = [];
    const store = toAiClassificationStore({
      syncTaxonomy: async (_v, labels) => new Map(labels.map((l) => [`${l.type}:${l.slug}`, `id-${l.slug}`])),
      loadInputs: async () => [row(), row({ steamAppId: "s2" })],
      loadAiInputHashes: async () => new Map(),
      replaceAiLabels: async (input) => {
        written.push({ steamAppId: input.steamAppId, labels: input.labels.length, model: input.model, inputHash: input.inputHash });
        return { written: input.labels.length, removed: 0 };
      },
    });
    const classifier = {
      classifyBatch: async (inputs: readonly { appId: string }[]) => ({
        model: "test-model",
        promptVersion: "ai-test",
        inputTokens: 10,
        outputTokens: 5,
        results: inputs.map((input) => ({
          appId: input.appId,
          rejected: 0,
          labels: input.appId === "s1"
            ? [{ type: "subgenre" as const, slug: "roguelike", confidence: 0.9, evidence: [{ field: "store_category" as const, excerpt: "Roguelike" }] }]
            : [],
        })),
      }),
    };

    const summary = await runAiClassification(taxonomy, classifier, store, { maxApps: 10, batchSize: 8 });

    assert.equal(summary.classified, 2);
    assert.equal(summary.emptyResults, 1);
    assert.deepEqual(written.map((w) => [w.steamAppId, w.labels, w.model]), [["s1", 1, "test-model"], ["s2", 0, "test-model"]]);
  });

  it("skips a Steam game whose AI input hash is unchanged", async () => {
    const hashes = new Map<string, string>();
    const first = toAiClassificationStore({
      syncTaxonomy: async (_v, labels) => new Map(labels.map((l) => [`${l.type}:${l.slug}`, `id-${l.slug}`])),
      loadInputs: async () => [row()],
      loadAiInputHashes: async () => hashes,
      replaceAiLabels: async (input) => {
        hashes.set(input.steamAppId, input.inputHash);
        return { written: 0, removed: 0 };
      },
    });
    const classifier = {
      classifyBatch: async (inputs: readonly { appId: string }[]) => ({
        model: "m",
        promptVersion: "ai-test",
        inputTokens: 0,
        outputTokens: 0,
        results: inputs.map((input) => ({ appId: input.appId, rejected: 0, labels: [] })),
      }),
    };
    await runAiClassification(taxonomy, classifier, first, { maxApps: 10, batchSize: 8 });
    const second = await runAiClassification(taxonomy, classifier, first, { maxApps: 10, batchSize: 8 });
    assert.equal(second.pending, 0);
    assert.equal(second.attempted, 0);
  });
});
