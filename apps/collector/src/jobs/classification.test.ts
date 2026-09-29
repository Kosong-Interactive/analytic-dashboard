import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classificationInputHash,
  parseTaxonomy,
  RULES_VERSION,
  type ClassificationInput,
} from "@analytic-dashboard/classifier";

import { runRuleClassification, type ClassificationStore } from "./classification.js";

const taxonomy = parseTaxonomy({
  version: "taxonomy-v1",
  labels: {
    genre: { puzzle: "Puzzle" },
    subgenre: { merge: "Merge" },
    core_mechanic: { merging: "Merging" },
    meta_mechanic: {},
    theme: {},
    multiplayer_mode: {},
    monetization_clue: { free_to_play: "Free to play" },
  },
});

const merge: ClassificationInput = {
  appId: "app-merge",
  listings: [{ store: "google_play", country: "us", title: "Merge Town", description: null, storeGenres: ["GAME_PUZZLE"], price: 0 }],
};
const plain: ClassificationInput = {
  appId: "app-plain",
  listings: [{ store: "app_store", country: "us", title: "Quiet Game", description: null, storeGenres: ["Games"], price: null }],
};

function memoryStore(inputs: ClassificationInput[], hashes = new Map<string, string>(), failFor?: string) {
  const writes: Array<{ appId: string; slugs: number; inputHash: string; rulesVersion: string }> = [];
  const store: ClassificationStore = {
    syncTaxonomy: async (_version, labels) => new Map(labels.map((l, i) => [`${l.type}:${l.slug}`, `label-${i}`])),
    loadInputs: async () => inputs,
    loadRuleInputHashes: async () => hashes,
    replaceRuleLabels: async (input) => {
      if (input.appId === failFor) throw new Error("write failed");
      writes.push({ appId: input.appId, slugs: input.labels.length, inputHash: input.inputHash, rulesVersion: input.rulesVersion });
      return { written: input.labels.length, removed: 0 };
    },
  };
  return { store, writes };
}

describe("runRuleClassification", () => {
  it("writes taxonomy labels only, with the rules version and input hash", async () => {
    const { store, writes } = memoryStore([merge, plain]);
    const summary = await runRuleClassification(taxonomy, store);

    assert.equal(summary.apps, 2);
    // The app without a matching rule is still recorded, so its empty result is cached.
    assert.equal(summary.classified, 2);
    assert.deepEqual(writes.map((w) => `${w.appId}:${w.slugs}`), ["app-merge:4", "app-plain:0"]);
    // genre:puzzle, subgenre:merge, core_mechanic:merging, monetization_clue:free_to_play
    assert.equal(writes[0]?.slugs, 4);
    assert.equal(writes[0]?.rulesVersion, RULES_VERSION);
    assert.equal(summary.withoutLabels, 1);
  });

  it("skips apps whose input hash is unchanged", async () => {
    const hash = classificationInputHash(merge, { taxonomyVersion: "taxonomy-v1", classifierVersion: RULES_VERSION });
    const { store, writes } = memoryStore([merge], new Map([["app-merge", hash]]));
    const summary = await runRuleClassification(taxonomy, store);

    assert.equal(summary.unchanged, 1);
    assert.equal(writes.length, 0);
  });

  it("clears stale rule labels when a changed app no longer matches any rule", async () => {
    const { store, writes } = memoryStore([plain], new Map([["app-plain", "old-hash"]]));
    const summary = await runRuleClassification(taxonomy, store);

    assert.equal(writes[0]?.slugs, 0);
    assert.equal(summary.classified, 1);
  });

  it("records a failed write and continues with the next app", async () => {
    const other = { ...merge, appId: "app-other" };
    const { store, writes } = memoryStore([merge, other], new Map(), "app-merge");
    const summary = await runRuleClassification(taxonomy, store);

    assert.equal(summary.errorCount, 1);
    assert.match(summary.errorSample ?? "", /app-merge: write failed/);
    assert.deepEqual(writes.map((w) => w.appId), ["app-other"]);
  });
});
