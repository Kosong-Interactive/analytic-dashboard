import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { windowedChange, type Observation } from "./velocity.js";

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n));
const obs = (n: number, value: number | null): Observation => ({
  capturedAt: day(n),
  value,
});

describe("windowedChange", () => {
  it("compares the latest reading with the last one at or before the window start", () => {
    const result = windowedChange(
      [obs(0, 100), obs(2, 130), obs(8, 170), obs(10, 200)],
      { windowDays: 7 },
    );

    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.from.value, 130);
    assert.equal(result.delta, 70);
    assert.equal(result.spanDays, 8);
    assert.equal(result.perDay, 70 / 8);
  });

  it("uses the earliest reading when it covers enough of the window", () => {
    const result = windowedChange([obs(0, 10), obs(4, 30)], { windowDays: 7 });

    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.perDay, 5);
  });

  it("reports insufficient history instead of extrapolating a short span", () => {
    const result = windowedChange([obs(0, 10), obs(1, 30)], { windowDays: 7 });

    assert.equal(result.status, "insufficient_history");
  });

  it("ignores missing readings rather than treating them as zero", () => {
    const result = windowedChange([obs(0, 50), obs(3, null), obs(8, 80)], {
      windowDays: 7,
    });

    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.delta, 30);
  });

  it("needs two real readings and tolerates unordered input", () => {
    assert.equal(
      windowedChange([obs(0, null), obs(8, 5)], { windowDays: 7 }).status,
      "insufficient_history",
    );
    const result = windowedChange([obs(8, 90), obs(0, 60)], { windowDays: 7 });
    assert.equal(result.status === "ok" && result.delta, 30);
  });

  it("allows negative change", () => {
    const result = windowedChange([obs(0, 100), obs(7, 80)], { windowDays: 7 });
    assert.equal(result.status === "ok" && result.perDay, -20 / 7);
  });
});
