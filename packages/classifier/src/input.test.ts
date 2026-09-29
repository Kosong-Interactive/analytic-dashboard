import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classificationInputHash, type ClassificationInput } from "./input.js";

const versions = { taxonomyVersion: "taxonomy-v1", classifierVersion: "rules-v1" };
const input: ClassificationInput = {
  appId: "a1",
  listings: [
    { store: "google_play", country: "us", title: "Merge Town", description: "Merge things.", storeGenres: ["GAME_PUZZLE"], price: 0 },
    { store: "app_store", country: "id", title: "Merge Town", description: "Merge things.", storeGenres: ["Games", "Puzzle"], price: 0 },
  ],
};

describe("classificationInputHash", () => {
  it("is stable regardless of listing and genre order", () => {
    const reordered: ClassificationInput = {
      appId: "a1",
      listings: [...input.listings].reverse().map((l) => ({ ...l, storeGenres: [...l.storeGenres].reverse() })),
    };
    assert.equal(classificationInputHash(input, versions), classificationInputHash(reordered, versions));
  });

  it("changes when the text or a version changes", () => {
    const base = classificationInputHash(input, versions);
    const edited: ClassificationInput = {
      ...input,
      listings: [{ ...input.listings[0]!, description: "Match things." }, input.listings[1]!],
    };
    assert.notEqual(classificationInputHash(edited, versions), base);
    assert.notEqual(classificationInputHash(input, { ...versions, classifierVersion: "rules-v2" }), base);
  });
});
