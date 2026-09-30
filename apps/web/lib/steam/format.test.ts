import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPrice, formatRatio, positiveRatio, rankChange } from "./format";

const snapshot = (positive: number | null, negative: number | null) => ({
  capturedAt: new Date(0),
  reviewPositive: positive,
  reviewNegative: negative,
  reviewTotal: positive === null || negative === null ? null : positive + negative,
  reviewsCapturedAt: null,
  currentPlayers: null,
  playersCapturedAt: null,
});

describe("steam formatting", () => {
  it("keeps missing reviews as a dash instead of 0%", () => {
    assert.equal(formatRatio(positiveRatio(null)), "—");
    assert.equal(formatRatio(positiveRatio(snapshot(null, null))), "—");
    assert.equal(formatRatio(positiveRatio(snapshot(0, 0))), "—");
  });

  it("computes the positive share", () => {
    assert.equal(formatRatio(positiveRatio(snapshot(90, 10))), "90.0%");
    assert.equal(formatRatio(positiveRatio(snapshot(0, 10))), "0.0%");
  });

  it("formats prices and free games", () => {
    assert.equal(formatPrice(undefined, true), "Free");
    assert.equal(formatPrice(undefined, false), "—");
    const price = {
      country: "us", currency: "USD", initialPrice: 20, finalPrice: 10, discountPercent: 50, capturedAt: new Date(0),
    };
    assert.equal(formatPrice(price, false), "$10.00 (−50%)");
  });

  it("reports chart movement only when last week is known", () => {
    assert.equal(rankChange(3, 8), 5);
    assert.equal(rankChange(8, 3), -5);
    assert.equal(rankChange(3, null), null);
  });
});
