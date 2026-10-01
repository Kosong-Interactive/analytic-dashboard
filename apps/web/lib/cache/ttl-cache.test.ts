import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTtlCache } from "./ttl-cache";

describe("createTtlCache", () => {
  it("computes once per key within the lifetime and again after it expires", async () => {
    let clock = 0;
    const cache = createTtlCache<number>(1_000, () => clock);
    let calls = 0;
    const compute = async () => ++calls;

    assert.equal(await cache.get("a", compute), 1);
    clock = 999;
    assert.equal(await cache.get("a", compute), 1);
    clock = 1_001;
    assert.equal(await cache.get("a", compute), 2);
    assert.equal(await cache.get("b", compute), 3);
  });

  it("lets concurrent callers share one computation", async () => {
    const cache = createTtlCache<string>(1_000);
    let calls = 0;
    const slow = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "done";
    };
    const results = await Promise.all([cache.get("k", slow), cache.get("k", slow), cache.get("k", slow)]);
    assert.deepEqual(results, ["done", "done", "done"]);
    assert.equal(calls, 1);
  });

  it("does not keep a failed computation", async () => {
    const cache = createTtlCache<number>(1_000);
    await assert.rejects(() => cache.get("k", async () => { throw new Error("boom"); }), /boom/);
    assert.equal(await cache.get("k", async () => 7), 7);
  });

  it("can be cleared", async () => {
    const cache = createTtlCache<number>(1_000);
    let calls = 0;
    await cache.get("k", async () => ++calls);
    cache.clear();
    await cache.get("k", async () => ++calls);
    assert.equal(calls, 2);
  });
});
