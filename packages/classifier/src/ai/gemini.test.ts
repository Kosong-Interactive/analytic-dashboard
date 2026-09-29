import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ClassificationInput } from "../input.js";
import { parseTaxonomy } from "../taxonomy.js";
import {
  AllModelsExhaustedError,
  classifyGeminiError,
  GeminiFatalError,
  GeminiProvider,
  type GeminiClient,
} from "./gemini.js";

const taxonomy = parseTaxonomy({
  version: "taxonomy-v1",
  labels: { genre: { puzzle: "Puzzle" }, subgenre: {}, core_mechanic: {}, meta_mechanic: {}, theme: {}, multiplayer_mode: {}, monetization_clue: {} },
});
const inputs: ClassificationInput[] = [
  { appId: "a", listings: [{ store: "google_play", country: "us", title: "Puzzle Land", description: null, storeGenres: [], price: 0 }] },
];
const ok = JSON.stringify({
  apps: [{ id: "app1", labels: [{ label: "genre:puzzle", confidence: 0.9, evidence: [{ field: "title", excerpt: "Puzzle Land" }] }] }],
});

class HttpError extends Error {
  constructor(readonly status: number, message = `HTTP ${status}`) {
    super(message);
  }
}

function fakeClient(
  listed: string[] | Error,
  behaviour: Record<string, Array<string | Error>>,
): { client: GeminiClient; calls: string[] } {
  const calls: string[] = [];
  const queues = new Map(Object.entries(behaviour).map(([model, queue]) => [model, [...queue]]));
  return {
    calls,
    client: {
      listModels: async () => {
        if (listed instanceof Error) throw listed;
        return listed;
      },
      generate: async (model) => {
        calls.push(model);
        const next = queues.get(model)?.shift() ?? ok;
        if (next instanceof Error) throw next;
        return { text: next, inputTokens: 100, outputTokens: 20 };
      },
    },
  };
}

const provider = (client: GeminiClient, preferredModels = ["m1", "m2", "m3"]) =>
  new GeminiProvider({ client, preferredModels, sleep: async () => undefined, minimumRequestIntervalMs: 0 });

describe("classifyGeminiError", () => {
  it("separates quota, missing, transient, and fatal errors", () => {
    assert.equal(classifyGeminiError(new HttpError(429)), "quota");
    assert.equal(classifyGeminiError(new Error("RESOURCE_EXHAUSTED: quota")), "quota");
    assert.equal(classifyGeminiError(new HttpError(404)), "not_found");
    assert.equal(classifyGeminiError(new HttpError(503)), "unavailable");
    assert.equal(classifyGeminiError(new HttpError(403)), "fatal");
    assert.equal(classifyGeminiError(new HttpError(400)), "fatal");
  });
});

describe("GeminiProvider", () => {
  it("uses only listed models, in preference order", async () => {
    const { client, calls } = fakeClient(["m3", "m2", "other"], {});
    const p = provider(client);
    assert.deepEqual(await p.availableModels(), ["m2", "m3"]);
    const result = await p.classifyBatch(inputs, taxonomy);
    assert.equal(result.model, "m2");
    assert.deepEqual(calls, ["m2"]);
    assert.equal(result.results[0]?.labels[0]?.slug, "puzzle");
  });

  it("falls back to the preference list when listing fails", async () => {
    const { client } = fakeClient(new Error("network"), {});
    assert.deepEqual(await provider(client).availableModels(), ["m1", "m2", "m3"]);
  });

  it("rotates on quota and keeps an exhausted model out for later batches", async () => {
    const { client, calls } = fakeClient(["m1", "m2"], { m1: [new HttpError(429)] });
    const p = provider(client);
    assert.equal((await p.classifyBatch(inputs, taxonomy)).model, "m2");
    assert.equal((await p.classifyBatch(inputs, taxonomy)).model, "m2");
    assert.deepEqual(calls, ["m1", "m2", "m2"]);
  });

  it("retries a transient failure once on the same model", async () => {
    const { client, calls } = fakeClient(["m1"], { m1: [new HttpError(503)] });
    assert.equal((await provider(client).classifyBatch(inputs, taxonomy)).model, "m1");
    assert.deepEqual(calls, ["m1", "m1"]);
  });

  it("retries malformed output once, then moves to the next model", async () => {
    const { client, calls } = fakeClient(["m1", "m2"], { m1: ["garbage", "{}"] });
    assert.equal((await provider(client).classifyBatch(inputs, taxonomy)).model, "m2");
    assert.deepEqual(calls, ["m1", "m1", "m2"]);
  });

  it("stops on a fatal error such as a bad key", async () => {
    const { client } = fakeClient(["m1", "m2"], { m1: [new HttpError(403)] });
    await assert.rejects(() => provider(client).classifyBatch(inputs, taxonomy), GeminiFatalError);
  });

  it("reports when every model is out of quota", async () => {
    const { client } = fakeClient(["m1", "m2"], { m1: [new HttpError(429)], m2: [new HttpError(429)] });
    await assert.rejects(() => provider(client).classifyBatch(inputs, taxonomy), AllModelsExhaustedError);
  });
});
