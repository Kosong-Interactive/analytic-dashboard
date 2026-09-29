import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AI_PROMPT_VERSION,
  AllModelsExhaustedError,
  classificationInputHash,
  GeminiFatalError,
  parseTaxonomy,
  type BatchResult,
  type ClassificationInput,
} from "@analytic-dashboard/classifier";

import { runAiClassification, type AiBatchClassifier, type AiClassificationStore } from "./ai-classification.js";

const taxonomy = parseTaxonomy({
  version: "taxonomy-v1",
  labels: { genre: { puzzle: "Puzzle" }, subgenre: {}, core_mechanic: {}, meta_mechanic: {}, theme: {}, multiplayer_mode: {}, monetization_clue: {} },
});
const app = (id: string): ClassificationInput => ({
  appId: id,
  listings: [{ store: "google_play", country: "us", title: `Game ${id}`, description: null, storeGenres: [], price: 0 }],
});

function batchResult(inputs: readonly ClassificationInput[], model = "m1", empty: string[] = []): BatchResult {
  return {
    model,
    promptVersion: AI_PROMPT_VERSION,
    inputTokens: 10,
    outputTokens: 5,
    results: inputs.map((input) => ({
      appId: input.appId,
      rejected: 1,
      labels: empty.includes(input.appId)
        ? []
        : [{ type: "genre", slug: "puzzle", confidence: 0.9, evidence: [{ field: "title", excerpt: "Game" }] }],
    })),
  };
}

function memoryStore(inputs: ClassificationInput[], hashes = new Map<string, string>()) {
  const writes: Array<{ appId: string; model: string; promptVersion: string }> = [];
  const store: AiClassificationStore = {
    syncTaxonomy: async (_v, labels) => new Map(labels.map((l) => [`${l.type}:${l.slug}`, `id-${l.slug}`])),
    loadInputs: async () => inputs,
    loadAiInputHashes: async () => hashes,
    replaceAiLabels: async (input) => {
      writes.push({ appId: input.appId, model: input.model, promptVersion: input.promptVersion });
      return { written: input.labels.length, removed: 0 };
    },
  };
  return { store, writes };
}

const options = { maxApps: 10, batchSize: 2 };

describe("runAiClassification", () => {
  it("classifies pending apps in batches and skips unchanged ones", async () => {
    const inputs = [app("a"), app("b"), app("c")];
    const unchanged = classificationInputHash(inputs[2]!, { taxonomyVersion: "taxonomy-v1", classifierVersion: AI_PROMPT_VERSION });
    const { store, writes } = memoryStore(inputs, new Map([["c", unchanged]]));
    const batches: number[] = [];
    const classifier: AiBatchClassifier = { classifyBatch: async (b) => (batches.push(b.length), batchResult(b)) };

    const summary = await runAiClassification(taxonomy, classifier, store, options);

    assert.deepEqual(batches, [2]);
    assert.equal(summary.pending, 2);
    assert.equal(summary.classified, 2);
    assert.equal(summary.labelsRejected, 2);
    assert.equal(summary.remaining, 0);
    assert.deepEqual(summary.modelsUsed, { m1: 1 });
    assert.deepEqual(writes.map((w) => w.promptVersion), [AI_PROMPT_VERSION, AI_PROMPT_VERSION]);
  });

  it("respects the per-run cap and counts the rest as remaining", async () => {
    const { store } = memoryStore([app("a"), app("b"), app("c")]);
    const summary = await runAiClassification(taxonomy, { classifyBatch: async (b) => batchResult(b) }, store, { maxApps: 2, batchSize: 2 });
    assert.equal(summary.classified, 2);
    assert.equal(summary.remaining, 1);
  });

  it("stops cleanly when every model is out of quota", async () => {
    const { store, writes } = memoryStore([app("a"), app("b"), app("c")]);
    let call = 0;
    const classifier: AiBatchClassifier = {
      classifyBatch: async (b) => {
        call += 1;
        if (call === 2) throw new AllModelsExhaustedError();
        return batchResult(b);
      },
    };
    const summary = await runAiClassification(taxonomy, classifier, store, options);
    assert.equal(summary.quotaExhausted, true);
    assert.equal(summary.errorCount, 0);
    assert.equal(writes.length, 2);
    assert.equal(summary.remaining, 1);
  });

  it("reports a fatal provider error and stops", async () => {
    const { store } = memoryStore([app("a"), app("b"), app("c")]);
    const summary = await runAiClassification(
      taxonomy,
      { classifyBatch: async () => { throw new GeminiFatalError("m1", 403); } },
      store,
      options,
    );
    assert.equal(summary.errorCount, 1);
    assert.match(summary.errorSample ?? "", /HTTP 403/);
  });

  it("records empty results so an unchanged app is not sent again", async () => {
    const { store, writes } = memoryStore([app("a"), app("b")]);
    const summary = await runAiClassification(taxonomy, { classifyBatch: async (b) => batchResult(b, "m1", ["b"]) }, store, options);
    assert.equal(summary.emptyResults, 1);
    assert.equal(summary.classified, 2);
    assert.equal(summary.remaining, 0);
    assert.deepEqual(writes.map((w) => w.appId), ["a", "b"]);
  });
});
