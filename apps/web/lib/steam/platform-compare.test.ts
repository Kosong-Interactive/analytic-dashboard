import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPlatformComparison, type PlatformDataset } from "./platform-compare";

const asOf = new Date("2026-10-01T00:00:00Z");
const old = new Date("2026-08-01T00:00:00Z");

/** Six genres; genre i has 3 games whose score is `base(i)`. */
function dataset(prefix: string, base: (i: number) => number, genres = 6): PlatformDataset {
  const games: PlatformDataset["games"][number][] = [];
  const membership: PlatformDataset["membership"][number][] = [];
  for (let i = 0; i < genres; i++) {
    for (let m = 0; m < 3; m++) {
      const id = `${prefix}-${i}-${m}`;
      games.push({ id, score: base(i), firstSeenAt: old });
      membership.push({ gameId: id, type: "genre", slug: `g${i}`, displayName: `Genre ${i}` });
    }
  }
  return { games, membership, available: true };
}
const unavailable: PlatformDataset = { games: [], membership: [], available: false };

describe("buildPlatformComparison", () => {
  const datasets = {
    steam: dataset("s", (i) => 10 + i * 10),
    google_play: dataset("g", (i) => 90 - i * 10),
    app_store: unavailable,
  };
  const run = (sort: Parameters<typeof buildPlatformComparison>[0]["sort"] = "coverage") =>
    buildPlatformComparison({ datasets, type: "genre", sort, asOf });

  it("ranks each label inside its own platform and keeps both ranks side by side", () => {
    const g0 = run().rows.find((r) => r.slug === "g0");
    assert.equal(g0?.displayName, "Genre 0");
    assert.equal(g0?.platforms.steam?.momentumPercentile, 0);
    assert.equal(g0?.platforms.google_play?.momentumPercentile, 1);
  });

  it("leaves an unavailable platform out of the coverage count instead of treating it as weak", () => {
    const result = run();
    assert.deepEqual(result.available, ["steam", "google_play"]);
    const g0 = result.rows.find((r) => r.slug === "g0");
    assert.equal(g0?.total, 2);
    assert.equal(g0?.measured, 2);
    assert.equal(g0?.platforms.app_store, undefined);
  });

  it("sorts by one platform's momentum with unranked labels last", () => {
    const rows = buildPlatformComparison({
      datasets: { ...datasets, steam: dataset("s", (i) => 10 + i * 10, 6) },
      type: "genre",
      sort: "steam",
      asOf,
    }).rows;
    assert.equal(rows[0]?.slug, "g5");
    assert.equal(rows.at(-1)?.slug, "g0");
  });

  it("only considers labels of the requested type", () => {
    const other = buildPlatformComparison({ datasets, type: "theme", sort: "coverage", asOf });
    assert.equal(other.rows.length, 0);
  });

  it("names the formula version", () => {
    assert.equal(run().formulaVersion, "platform_label_v1");
  });

  it("names the situation of each label and can filter by it", () => {
    const rows = run().rows;
    assert.ok(rows.every((r) => r.opportunity.formulaVersion === "platform_opportunity_v1"));
    // Steam and Google Play rank labels in opposite order here, so the extremes conflict.
    assert.equal(rows.find((r) => r.slug === "g0")?.opportunity.mode, "conflicting");
    assert.equal(rows.find((r) => r.slug === "g5")?.opportunity.mode, "conflicting");
    const conflicting = buildPlatformComparison({ datasets, type: "genre", sort: "coverage", asOf, mode: "conflicting" }).rows;
    assert.ok(conflicting.length > 0 && conflicting.every((r) => r.opportunity.mode === "conflicting"));
    const none = buildPlatformComparison({ datasets, type: "genre", sort: "coverage", asOf, mode: "steam_to_mobile" }).rows;
    assert.equal(none.length, 0);
  });
});
