import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLabelEvidence, selectOpportunities } from "./opportunities";
import type { PlatformDataset } from "./platform-compare";

const asOf = new Date("2026-10-01T00:00:00Z");
const old = new Date("2026-08-01T00:00:00Z");

/**
 * Six genres of 3 games each; `scoreFor` gives each genre's score (null = unscored platform).
 * Membership and details are filled so evidence lists have titles.
 */
function dataset(prefix: string, scoreFor: (i: number) => number | null, available = true): PlatformDataset {
  const games: PlatformDataset["games"][number][] = [];
  const membership: PlatformDataset["membership"][number][] = [];
  const details = new Map<string, { title: string; href: string }>();
  for (let i = 0; i < 6; i++) {
    for (let m = 0; m < 3; m++) {
      const id = `${prefix}-${i}-${m}`;
      games.push({ id, score: scoreFor(i) === null ? null : (scoreFor(i) as number) + m, firstSeenAt: old });
      membership.push({ gameId: id, type: "genre", slug: `g${i}`, displayName: `Genre ${i}` });
      details.set(id, { title: `${prefix} game ${i}.${m}`, href: `/x/${id}` });
    }
  }
  return { games, membership, details, available };
}
const unavailable: PlatformDataset = { games: [], membership: [], available: false };

describe("selectOpportunities", () => {
  it("surfaces confirmed labels first and carries their evidence and caveats", () => {
    const list = selectOpportunities({
      datasets: { steam: dataset("s", (i) => 10 + i * 10), google_play: dataset("g", (i) => 10 + i * 10), app_store: dataset("a", (i) => 10 + i * 10) },
      asOf,
    });
    assert.ok(list.cards.length > 0 && list.cards.length <= 5);
    assert.equal(list.cards[0]?.mode, "confirmed_cross_platform");
    assert.equal(list.cards[0]?.displayName, "Genre 5");
    assert.equal(list.cards[0]?.confidence, "high");
    assert.ok(list.cards[0]?.caveats.some((c) => /sample/.test(c)));
    assert.equal(list.mobileMeasured, true);
  });

  it("does not turn a Steam-only signal into a claim about mobile, and says it is one-sided", () => {
    const list = selectOpportunities({
      datasets: { steam: dataset("s", (i) => 10 + i * 10), google_play: dataset("g", () => null), app_store: dataset("a", () => null) },
      asOf,
    });
    assert.equal(list.mobileMeasured, false);
    for (const card of list.cards) {
      assert.equal(card.confidence, "low");
      assert.ok(card.caveats.some((c) => /one-sided/.test(c)) || card.mode !== "steam_to_mobile");
      assert.ok(card.caveats.some((c) => /1 of 3/.test(c)));
    }
  });

  it("leaves labels in conflict or without a clear signal out of the opportunities", () => {
    const list = selectOpportunities({
      datasets: { steam: dataset("s", (i) => 10 + i * 10), google_play: dataset("g", (i) => 90 - i * 10), app_store: unavailable },
      asOf,
    });
    assert.ok(list.cards.every((c) => ["confirmed_cross_platform", "steam_to_mobile", "mobile_to_steam"].includes(c.mode)));
    assert.ok(list.assessed >= list.candidates);
  });

  it("respects the display limit and names unavailable platforms", () => {
    const list = selectOpportunities({
      datasets: { steam: dataset("s", (i) => 10 + i * 10), google_play: dataset("g", (i) => 10 + i * 10), app_store: unavailable },
      asOf,
      limit: 2,
    });
    assert.equal(list.cards.length, 2);
    assert.deepEqual(list.available, ["steam", "google_play"]);
    assert.ok(list.cards[0]?.caveats.some((c) => /app_store could not be loaded/.test(c)));
  });

  it("returns no cards when nothing is measurable", () => {
    const list = selectOpportunities({ datasets: { steam: unavailable, google_play: unavailable, app_store: unavailable }, asOf });
    assert.equal(list.cards.length, 0);
    assert.equal(list.candidates, 0);
  });
});

describe("buildLabelEvidence", () => {
  const datasets = { steam: dataset("s", (i) => 10 + i * 10), google_play: dataset("g", (i) => 10 + i * 10), app_store: unavailable };

  it("lists the comparable games of each platform, highest scored first", () => {
    const evidence = buildLabelEvidence({ datasets, type: "genre", slug: "g5", asOf });
    assert.equal(evidence?.row.displayName, "Genre 5");
    const steam = evidence?.platforms.find((p) => p.platform === "steam");
    assert.deepEqual(steam?.games.map((g) => g.title), ["s game 5.2", "s game 5.1", "s game 5.0"]);
    assert.equal(steam?.signal?.momentumPercentile, 1);
  });

  it("marks an unavailable platform instead of showing an empty list as weak", () => {
    const evidence = buildLabelEvidence({ datasets, type: "genre", slug: "g5", asOf });
    const appStore = evidence?.platforms.find((p) => p.platform === "app_store");
    assert.equal(appStore?.available, false);
    assert.equal(appStore?.games.length, 0);
  });

  it("returns null for an unknown label", () => {
    assert.equal(buildLabelEvidence({ datasets, type: "genre", slug: "nope", asOf }), null);
  });
});
