import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { ruleLabelRefs } from "./rules.js";
import { hasLabel, listTaxonomyLabels, parseTaxonomy } from "./taxonomy.js";

const v1 = parseTaxonomy(
  JSON.parse(readFileSync(new URL("../../../config/taxonomy/v1.json", import.meta.url), "utf8")),
);

describe("taxonomy v1", () => {
  it("parses and covers every label type", () => {
    assert.equal(v1.version, "taxonomy-v1");
    const types = new Set(listTaxonomyLabels(v1).map((label) => label.type));
    assert.equal(types.size, 7);
  });

  it("contains every label the rules can emit", () => {
    const missing = ruleLabelRefs().filter(([type, slug]) => !hasLabel(v1, type, slug));
    assert.deepEqual(missing, []);
  });

  it("rejects free-form slugs and unknown versions", () => {
    const broken = structuredClone(v1) as { labels: { genre: Record<string, string> } };
    broken.labels.genre["Not A Slug"] = "x";
    assert.throws(() => parseTaxonomy(broken));
    assert.throws(() => parseTaxonomy({ ...v1, version: "v1" }));
  });
});
