import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { percentileRanks } from "./normalize.js";

describe("percentileRanks", () => {
  it("ranks values from 0 to 1 and keeps nulls", () => {
    assert.deepEqual(percentileRanks([10, null, 30, 20]), [0, null, 1, 0.5]);
  });

  it("gives ties the middle rank", () => {
    assert.deepEqual(percentileRanks([5, 5, 5]), [0.5, 0.5, 0.5]);
    assert.deepEqual(percentileRanks([1, 2, 2, 3]), [0, 0.5, 0.5, 1]);
  });

  it("returns null for a cohort below the minimum size", () => {
    assert.deepEqual(percentileRanks([1, 2, null], 3), [null, null, null]);
    assert.deepEqual(percentileRanks([7], 1), [null]);
  });
});
