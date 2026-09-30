import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTaxonomy, STEAM_RULES_VERSION } from "@analytic-dashboard/classifier";
import type { SteamClassificationInputRow } from "@analytic-dashboard/db";

import {
  runSteamRuleClassification,
  toClassificationInput,
  type SteamClassificationStore,
} from "./steam-classification.js";

const taxonomy = parseTaxonomy({
  version: "taxonomy-v1",
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
