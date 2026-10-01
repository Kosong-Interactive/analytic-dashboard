import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeMarketRuns } from "./market-runs";

const asOf = new Date("2026-10-04T02:00:00Z");
const run = (country: string, overrides: Record<string, unknown> = {}) => ({
  store: "google_play" as const,
  country,
  status: "succeeded" as const,
  asOf,
  cohortsEvaluated: 100,
  opportunitiesScored: 10,
  historyDays: 4,
  ...overrides,
});

describe("summarizeMarketRuns", () => {
  it("counts distinct cohorts across storefronts instead of summing them", () => {
    const [summary] = summarizeMarketRuns(
      [run("sg"), run("th")],
      [
        { store: "google_play", opportunityKey: "genre:puzzle", scored: false },
        { store: "google_play", opportunityKey: "genre:puzzle", scored: true },
        { store: "google_play", opportunityKey: "genre:card", scored: false },
      ],
    );
    assert.equal(summary?.cohortsEvaluated, 2);
    assert.equal(summary?.opportunitiesScored, 1);
  });

  it("uses the shortest history and the newest run", () => {
    const [summary] = summarizeMarketRuns(
      [run("sg", { historyDays: 6 }), run("th", { historyDays: 2, asOf: new Date("2026-10-05T02:00:00Z") })],
      [],
    );
    assert.equal(summary?.historyDays, 2);
    assert.equal(summary?.asOf.toISOString(), "2026-10-05T02:00:00.000Z");
  });

  it("is failed only when every storefront's newest run failed", () => {
    const some = summarizeMarketRuns([run("sg", { status: "failed" }), run("th")], []);
    assert.equal(some[0]?.status, "succeeded");
    const all = summarizeMarketRuns([run("sg", { status: "failed" }), run("th", { status: "failed" })], []);
    assert.equal(all[0]?.status, "failed");
  });

  it("keeps platforms separate", () => {
    const summaries = summarizeMarketRuns([run("sg"), run("sg", { store: "app_store" })], []);
    assert.deepEqual(summaries.map((s) => s.store).sort(), ["app_store", "google_play"]);
  });
});
