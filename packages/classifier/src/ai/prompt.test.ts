import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ClassificationInput } from "../input.js";
import { parseTaxonomy } from "../taxonomy.js";
import { AiResponseError, buildUserPrompt, parseAiResponse, toPromptApps } from "./prompt.js";

const taxonomy = parseTaxonomy({
  version: "taxonomy-v1",
  labels: {
    genre: { puzzle: "Puzzle" },
    subgenre: { match_3: "Match-3", solitaire: "Solitaire" },
    core_mechanic: { matching: "Matching" },
    meta_mechanic: {},
    theme: { food: "Food" },
    multiplayer_mode: {},
    monetization_clue: {},
  },
});

const inputs: ClassificationInput[] = [
  {
    appId: "a",
    listings: [
      { store: "google_play", country: "id", title: "Candy Kingdom", description: "Deskripsi.", storeGenres: ["GAME_CASUAL"], price: 0 },
      { store: "google_play", country: "us", title: "Candy Kingdom", description: "Match 3 candies to win. Also try our Solitaire game!", storeGenres: ["GAME_CASUAL"], price: 0 },
    ],
  },
  { appId: "b", listings: [{ store: "app_store", country: "us", title: "Chef Rush", description: "Cook burgers fast.", storeGenres: ["Games", "Casual"], price: 0 }] },
];

const answer = (apps: unknown) => JSON.stringify({ apps });

describe("toPromptApps", () => {
  it("prefers the US listing and drops generic store genres", () => {
    const [first, second] = toPromptApps(inputs);
    assert.match(first?.description ?? "", /Match 3 candies/);
    assert.deepEqual(second?.storeGenres, ["Casual"]);
    assert.doesNotMatch(buildUserPrompt(toPromptApps(inputs)), /"appId"/);
  });
});

describe("parseAiResponse", () => {
  it("maps prompt ids back to app ids and keeps verified labels", () => {
    const results = parseAiResponse(
      answer([
        { id: "app1", labels: [{ label: "subgenre:match_3", confidence: 0.9, evidence: [{ field: "description", excerpt: "match 3 candies" }] }] },
        { id: "app2", labels: [{ label: "theme:food", confidence: 0.8, evidence: [{ field: "description", excerpt: "Cook burgers" }] }] },
      ]),
      inputs,
      taxonomy,
    );
    assert.deepEqual(results.map((r) => [r.appId, r.labels.map((l) => l.slug)]), [["a", ["match_3"]], ["b", ["food"]]]);
  });

  it("drops labels outside the taxonomy or with evidence not found in the input", () => {
    const [result] = parseAiResponse(
      answer([
        {
          id: "app1",
          labels: [
            { label: "genre:rpg", confidence: 0.9, evidence: [{ field: "title", excerpt: "Candy" }] },
            { label: "core_mechanic:matching", confidence: 0.9, evidence: [{ field: "description", excerpt: "swipe to connect" }] },
            { label: "genre:puzzle", confidence: 0.9, evidence: [] },
          ],
        },
      ]),
      inputs,
      taxonomy,
    );
    assert.deepEqual(result?.labels, []);
    assert.equal(result?.rejected, 3);
  });

  it("treats a missing app as no labels and keeps the stronger duplicate", () => {
    const results = parseAiResponse(
      answer([
        {
          id: "app1",
          labels: [
            { label: "subgenre:match_3", confidence: 0.6, evidence: [{ field: "title", excerpt: "Candy Kingdom" }] },
            { label: "subgenre:match_3", confidence: 0.9, evidence: [{ field: "description", excerpt: "Match 3" }] },
          ],
        },
      ]),
      inputs,
      taxonomy,
    );
    assert.equal(results[0]?.labels[0]?.confidence, 0.9);
    assert.deepEqual(results[1], { appId: "b", labels: [], rejected: 0 });
  });

  it("rejects malformed or off-schema output", () => {
    assert.throws(() => parseAiResponse("not json", inputs, taxonomy), AiResponseError);
    assert.throws(() => parseAiResponse(JSON.stringify({ results: [] }), inputs, taxonomy), AiResponseError);
    assert.throws(
      () => parseAiResponse(answer([{ id: "app1", labels: [{ label: "genre:puzzle", confidence: 2, evidence: [] }] }]), inputs, taxonomy),
      AiResponseError,
    );
  });
});
