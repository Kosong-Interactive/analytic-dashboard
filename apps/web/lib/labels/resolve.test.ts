import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveListingLabels, type LabelRowInput } from "./resolve";

const row = (labelId: string, source: LabelRowInput["source"], confidence: number): LabelRowInput => ({
  labelId,
  type: "genre",
  slug: labelId,
  displayName: labelId,
  source,
  confidence,
  evidence: [],
  version: "rules-v1",
  model: null,
});

describe("resolveListingLabels", () => {
  it("lets a manual decision override the automated label but keeps both visible", () => {
    const [rejected] = resolveListingLabels([row("solitaire", "rule", 0.7), row("solitaire", "manual", 0)]);
    assert.equal(rejected?.status, "rejected");
    assert.equal(rejected?.automated?.confidence, 0.7);

    const [confirmed] = resolveListingLabels([row("rpg", "manual", 1)]);
    assert.equal(confirmed?.status, "confirmed");
    assert.equal(confirmed?.automated, null);
  });

  it("separates counted from weak automated labels and orders by status", () => {
    const labels = resolveListingLabels([
      row("weak", "rule", 0.55),
      row("strong", "rule", 0.95),
      row("gone", "manual", 0),
      row("mine", "manual", 1),
    ]);
    assert.deepEqual(labels.map((l) => `${l.slug}:${l.status}`), ["mine:confirmed", "strong:counted", "weak:weak", "gone:rejected"]);
  });

  it("prefers an AI label over a rule label for the same slug", () => {
    const [label] = resolveListingLabels([row("x", "rule", 0.95), row("x", "ai", 0.7)]);
    assert.equal(label?.automated?.source, "ai");
  });
});
