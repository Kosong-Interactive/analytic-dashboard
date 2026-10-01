import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PlatformLabelComparison, PlatformLabelSignal } from "./platform-labels.js";
import { classifyPlatformOpportunity } from "./platform-opportunity.js";

function signal(platform: string, momentumPercentile: number | null, members = 10, share = 0.1): PlatformLabelSignal {
  return {
    platform,
    key: "genre:x",
    members,
    share,
    scoredMembers: momentumPercentile === null ? 0 : members,
    momentum: momentumPercentile === null ? null : 50,
    momentumPercentile,
    sharePercentile: null,
    newEntrants: 0,
  };
}

function comparison(signals: PlatformLabelSignal[], total = 3): PlatformLabelComparison {
  return {
    key: "genre:x",
    platforms: Object.fromEntries(signals.map((s) => [s.platform, s])),
    present: signals.length,
    measured: signals.filter((s) => s.momentumPercentile !== null).length,
    total,
  };
}
const all = ["steam", "google_play", "app_store"];

describe("classifyPlatformOpportunity", () => {
  it("confirms a pattern that is strong on Steam and on mobile", () => {
    const result = classifyPlatformOpportunity(comparison([signal("steam", 0.9), signal("google_play", 0.8), signal("app_store", 0.7)]), all);
    assert.equal(result.mode, "confirmed_cross_platform");
    assert.equal(result.confidence, "high");
    assert.ok(Math.abs((result.mobileStrength ?? 0) - 0.75) < 1e-9);
  });

  it("flags a conflict when one side is strong and the other weak", () => {
    assert.equal(classifyPlatformOpportunity(comparison([signal("steam", 0.9), signal("google_play", 0.2)]), all).mode, "conflicting");
    assert.equal(classifyPlatformOpportunity(comparison([signal("steam", 0.1), signal("app_store", 0.9)]), all).mode, "conflicting");
  });

  it("names a Steam-to-mobile adaptation when mobile is thin", () => {
    const result = classifyPlatformOpportunity(
      comparison([signal("steam", 0.9), signal("google_play", null, 1, 0.01), signal("app_store", null, 2, 0.02)]),
      all,
    );
    assert.equal(result.mode, "steam_to_mobile");
    assert.equal(result.confidence, "low");
  });

  it("names a mobile-to-Steam adaptation when Steam is thin or has no games", () => {
    assert.equal(
      classifyPlatformOpportunity(comparison([signal("steam", null, 1, 0.01), signal("google_play", 0.9)]), all).mode,
      "mobile_to_steam",
    );
    assert.equal(classifyPlatformOpportunity(comparison([signal("google_play", 0.9)]), all).mode, "mobile_to_steam");
  });

  it("does not claim a migration when the other platform is established but not yet measurable", () => {
    const result = classifyPlatformOpportunity(
      comparison([signal("steam", 0.9), signal("google_play", null, 14), signal("app_store", null, 234)]),
      all,
    );
    assert.equal(result.mode, "insufficient");
    assert.match(result.reasons.join(" "), /No clear signal/);
  });

  it("does not call a label thin on mobile just because other genres are larger there", () => {
    // Mobile has 64 games at 6% of its catalogue while Steam has 9 games at 6%: comparable share, not thin.
    const result = classifyPlatformOpportunity(
      comparison([signal("steam", 0.9, 9, 0.06), signal("google_play", null, 2, 0.02), signal("app_store", null, 64, 0.058)]),
      all,
    );
    assert.notEqual(result.mode, "steam_to_mobile");
  });

  it("calls a label thin on mobile when its share is under half of Steam's", () => {
    const result = classifyPlatformOpportunity(
      comparison([signal("steam", 0.9, 30, 0.2), signal("google_play", null, 4, 0.02), signal("app_store", null, 20, 0.02)]),
      all,
    );
    assert.equal(result.mode, "steam_to_mobile");
  });

  it("names single-platform labels", () => {
    assert.equal(classifyPlatformOpportunity(comparison([signal("steam", 0.5)]), all).mode, "steam_only");
    assert.equal(classifyPlatformOpportunity(comparison([signal("app_store", 0.5)]), all).mode, "mobile_only");
  });

  it("treats an unavailable platform as missing rather than as thin", () => {
    const result = classifyPlatformOpportunity(comparison([signal("steam", 0.9)], 1), ["steam"]);
    assert.notEqual(result.mode, "steam_to_mobile");
    assert.match(result.reasons.join(" "), /unavailable/);
    const noSteam = classifyPlatformOpportunity(comparison([signal("google_play", 0.9)], 2), ["google_play", "app_store"]);
    assert.notEqual(noSteam.mode, "mobile_to_steam");
  });

  it("reports insufficient evidence when no platform has enough games", () => {
    const result = classifyPlatformOpportunity(comparison([signal("steam", null, 1, 0.01), signal("google_play", null, 2, 0.01)]), all);
    assert.equal(result.mode, "insufficient");
    assert.match(result.reasons.join(" "), /Too few/);
  });

  it("scales confidence with the platforms that were measured", () => {
    assert.equal(classifyPlatformOpportunity(comparison([signal("steam", 0.5)]), all).confidence, "low");
    assert.equal(classifyPlatformOpportunity(comparison([signal("steam", 0.5), signal("google_play", 0.5)]), all).confidence, "medium");
  });

  it("names the formula version", () => {
    assert.equal(classifyPlatformOpportunity(comparison([signal("steam", 0.5)]), all).formulaVersion, "platform_opportunity_v1");
  });
});
