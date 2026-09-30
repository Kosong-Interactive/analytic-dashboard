import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ClassificationListing } from "./input.js";
import { applyRules } from "./rules.js";

function listing(overrides: Partial<ClassificationListing> = {}): ClassificationListing {
  return { store: "google_play", country: "us", title: "Some Game", description: null, storeGenres: [], price: null, ...overrides };
}

const labelsOf = (listings: ClassificationListing[]) =>
  applyRules({ appId: "a1", listings });

describe("applyRules", () => {
  it("maps store genres from Google genreId and Apple genres, ignoring generic ones", () => {
    const labels = labelsOf([
      listing({ storeGenres: ["GAME_ROLE_PLAYING"] }),
      listing({ store: "app_store", storeGenres: ["Games", "Entertainment", "Strategy"] }),
    ]);
    const genres = labels.filter((l) => l.type === "genre").map((l) => [l.slug, l.confidence]);
    assert.deepEqual(genres, [["rpg", 0.95], ["strategy", 0.95]]);
  });

  it("uses price only when the store reported one", () => {
    assert.equal(labelsOf([listing({ price: 0 })]).find((l) => l.type === "monetization_clue")?.slug, "free_to_play");
    assert.equal(labelsOf([listing({ price: 4.99 })]).find((l) => l.type === "monetization_clue")?.slug, "premium");
    assert.equal(labelsOf([listing()]).length, 0);
  });

  it("trusts a title match more than a single description mention", () => {
    const title = labelsOf([listing({ title: "Merge Kingdom" })]).find((l) => l.slug === "merge");
    const once = labelsOf([listing({ description: "You can merge items." })]).find((l) => l.slug === "merge");
    const twice = labelsOf([listing({ description: "Merge items. Then merge again." })]).find((l) => l.slug === "merge");
    assert.equal(title?.confidence, 0.8);
    assert.equal(once?.confidence, 0.55);
    assert.equal(twice?.confidence, 0.7);
    assert.equal(title?.evidence[0]?.field, "title");
    assert.match(once?.evidence[0]?.excerpt ?? "", /merge items/i);
  });

  it("emits every label a rule declares, with its rule id", () => {
    const labels = labelsOf([listing({ title: "Castle Tower Defense" })]);
    const slugs = labels.map((l) => `${l.type}:${l.slug}`);
    assert.ok(slugs.includes("subgenre:tower_defense"));
    assert.ok(slugs.includes("core_mechanic:tower_placement"));
    assert.ok(labels.every((l) => l.ruleIds.length > 0));
  });

  it("matches whole words only", () => {
    assert.equal(labelsOf([listing({ description: "Emerged from the idleness." })]).length, 0);
  });

  it("merges the same label across listings, keeping the strongest confidence", () => {
    const labels = labelsOf([
      listing({ description: "A puzzle with sorting. Ball sort fun." }),
      listing({ store: "app_store", title: "Ball Sort Puzzle" }),
    ]);
    const sort = labels.find((l) => l.slug === "sort_puzzle");
    assert.equal(sort?.confidence, 0.8);
    assert.equal(sort?.evidence.length, 2);
  });
  it("maps Steam tags with reduced confidence and leaves unknown tags out", () => {
    const labels = labelsOf([
      listing({ store: "steam", storeTags: ["Roguelike", "Deckbuilder", "Co-op", "Very Positive Vibes"], price: 0 }),
    ]);
    const bySlug = new Map(labels.map((l) => [l.slug, l]));
    assert.equal(bySlug.get("roguelike")?.confidence, 0.75);
    assert.equal(bySlug.get("deckbuilding")?.confidence, 0.75);
    assert.equal(bySlug.get("co_op")?.confidence, 0.75);
    assert.equal(bySlug.get("roguelike")?.evidence[0]?.excerpt, "Steam tag: Roguelike");
    assert.equal(bySlug.get("free_to_play")?.evidence[0]?.excerpt, "Steam US price: 0");
  });
});
