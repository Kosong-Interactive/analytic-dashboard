import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeOpportunityHistory, type OpportunityHistoryPoint } from "./opportunity-history.js";

const DAY_MS = 86_400_000;
const end = new Date("2026-10-01T00:00:00Z");

function point(daysAgo: number, score: number | null, overrides: Partial<OpportunityHistoryPoint> = {}): OpportunityHistoryPoint {
  return {
    id: `p-${daysAgo}`,
    asOf: new Date(end.getTime() - daysAgo * DAY_MS),
    score,
    confidence: 0.6,
    confidenceBand: "medium",
    insightType: "build_opportunity",
    comparableIds: ["a", "b", "c"],
    counterSignals: ["Competition is concentrated."],
    ...overrides,
  };
}

describe("analyzeOpportunityHistory", () => {
  it("keeps 30/90-day durability collecting until time coverage is sufficient", () => {
    const result = analyzeOpportunityHistory([point(5, 62), point(0, 68)]);
    assert.equal(result.version, "opportunity_history_v1");
    assert.equal(result.windows[0]?.status, "collecting");
    assert.equal(result.windows[0]?.observedDays, 5);
    assert.equal(result.windows[0]?.scoreChange, 6);
    assert.equal(result.windows[0]?.durableShare, 1);
    assert.equal(result.windows[1]?.status, "collecting");
  });

  it("calculates ready durability without converting missing scores to zero", () => {
    const result = analyzeOpportunityHistory([point(30, 70), point(15, null), point(0, 50)]);
    const window = result.windows[0];
    assert.equal(window?.status, "ready");
    assert.equal(window?.sampleCount, 2);
    assert.equal(window?.averageScore, 60);
    assert.equal(window?.scoreChange, -20);
    assert.equal(window?.durableShare, 0.5);
  });

  it("measures acceleration from two preceding seven-day windows", () => {
    const result = analyzeOpportunityHistory([point(14, 40), point(7, 45), point(0, 60)]);
    assert.deepEqual(result.acceleration, {
      status: "ready",
      direction: "accelerating",
      value: 10,
      recentChange: 15,
      previousChange: 5,
      requiredHistoryDays: 14,
    });
  });

  it("creates bounded alerts only for material latest-run changes", () => {
    const result = analyzeOpportunityHistory([
      point(1, 70, { confidenceBand: "low", insightType: "emerging_pattern", comparableIds: ["a", "b", "c"] }),
      point(0, 55, { confidenceBand: "medium", insightType: "watch_carefully", comparableIds: ["d", "e", "c"], counterSignals: ["Competition is concentrated.", "Momentum weakened."] }),
    ]);
    assert.deepEqual(result.alerts.map((alert) => alert.kind), [
      "score_change",
      "confidence_change",
      "insight_change",
      "counter_signal_added",
      "comparables_changed",
    ]);
  });

  it("reports an opportunity becoming measurable instead of a fabricated zero-to-score jump", () => {
    const result = analyzeOpportunityHistory([point(1, null), point(0, 64)]);
    assert.equal(result.alerts[0]?.kind, "score_available");
    assert.equal(result.windows[0]?.scoreChange, 0);
  });

  it("does not treat changing numbers in the same counter-signal category as a new alert", () => {
    const result = analyzeOpportunityHistory([
      point(1, 64, { counterSignals: ["Median Trend Score 24 across 8 scored games"] }),
      point(0, 65, { counterSignals: ["Median Trend Score 25 across 9 scored games"] }),
    ]);
    assert.equal(result.alerts.some((alert) => alert.kind === "counter_signal_added"), false);
  });

  it("shows an unscored short history as collecting instead of a zero or a failure", () => {
    const result = analyzeOpportunityHistory([point(1, null), point(0, null)]);
    assert.equal(result.windows[0]?.status, "collecting");
    assert.equal(result.windows[0]?.durableShare, null);
    assert.equal(result.acceleration.status, "collecting");
  });
});
