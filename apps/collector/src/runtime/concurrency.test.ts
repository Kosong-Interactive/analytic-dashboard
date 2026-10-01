import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { forEachConcurrent } from "./concurrency.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("forEachConcurrent", () => {
  it("never runs more than the limit at once and visits every item", async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await forEachConcurrent([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await wait(5);
      seen.push(item);
      active -= 1;
    });
    assert.equal(peak, 3);
    assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6, 7]);
  });

  it("starts tasks in input order", async () => {
    const started: number[] = [];
    await forEachConcurrent([10, 20, 30, 40], 2, async (item) => {
      started.push(item);
      await wait(1);
    });
    assert.deepEqual(started, [10, 20, 30, 40]);
  });

  it("handles an empty list and a limit larger than the list", async () => {
    await forEachConcurrent([], 3, async () => assert.fail("no task expected"));
    let count = 0;
    await forEachConcurrent([1, 2], 10, async () => {
      count += 1;
    });
    assert.equal(count, 2);
  });

  it("rejects when a task throws, and rejects an invalid limit", async () => {
    await assert.rejects(() => forEachConcurrent([1, 2], 2, async () => { throw new Error("boom"); }), /boom/);
    await assert.rejects(() => forEachConcurrent([1], 0, async () => undefined), RangeError);
  });
});
