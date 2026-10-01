import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { ruleLabelRefs, steamRuleLabelRefs } from "./rules.js";
import { hasLabel, listTaxonomyLabels, parseTaxonomy } from "./taxonomy.js";

const v1 = parseTaxonomy(
  JSON.parse(readFileSync(new URL("../../../config/taxonomy/v1.json", import.meta.url), "utf8")),
);
const v2 = parseTaxonomy(
  JSON.parse(readFileSync(new URL("../../../config/taxonomy/v2.json", import.meta.url), "utf8")),
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

describe("taxonomy v2", () => {
  it("is a strict superset of v1 and contains every Steam rule label", () => {
    assert.equal(v2.version, "taxonomy-v2");
    const v1Labels = new Set(listTaxonomyLabels(v1).map((label) => `${label.type}:${label.slug}`));
    const v2Labels = new Set(listTaxonomyLabels(v2).map((label) => `${label.type}:${label.slug}`));

    for (const label of v1Labels) assert.ok(v2Labels.has(label), `${label} was removed from taxonomy-v2`);
    assert.ok(v2Labels.size > v1Labels.size);

    const missing = steamRuleLabelRefs().filter(([type, slug]) => !hasLabel(v2, type, slug));
    assert.deepEqual(missing, []);
  });

  it("keeps technical and lifecycle facets outside the gameplay taxonomy", () => {
    const labels = new Set(listTaxonomyLabels(v2).map((label) => label.slug));
    assert.equal(labels.has("controller_support"), false);
    assert.equal(labels.has("early_access"), false);
    assert.equal(labels.has("production_scope"), false);
    assert.equal(labels.has("perspective"), false);
  });
});
