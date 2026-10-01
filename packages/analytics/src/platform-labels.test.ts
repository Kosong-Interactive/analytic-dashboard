import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareLabelsAcrossPlatforms,
  computePlatformLabelSignals,
  type PlatformGame,
} from "./platform-labels.js";

const asOf = new Date(Date.UTC(2026, 9, 1));
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

/** Six labels A–F; label `X<i>` has `3 + i` members whose scores rise with i. */
function platform(name: string, scoreFor: (label: number) => number) {
  const games: PlatformGame[] = [];
  const labelsByGame = new Map<string, string[]>();
  let id = 0;
  for (let label = 0; label < 6; label++) {
    for (let member = 0; member < 3 + label; member++) {
      const gameId = `${name}-${id++}`;
      games.push({ id: gameId, score: scoreFor(label), firstSeenAt: daysAgo(member === 0 ? 2 : 40) });
      labelsByGame.set(gameId, [`genre:g${label}`]);
    }
  }
  return { platform: name, games, labelsByGame };
}

describe("computePlatformLabelSignals", () => {
  const steam = platform("steam", (label) => 10 + label * 15);
  const signals = computePlatformLabelSignals(steam, asOf);
  const byKey = new Map(signals.map((s) => [s.key, s]));

  it("uses the median score of members and counts members, share, and new entrants", () => {
    const g3 = byKey.get("genre:g3");
    assert.equal(g3?.members, 6);
    assert.equal(g3?.scoredMembers, 6);
    assert.equal(g3?.momentum, 55);
    assert.equal(g3?.newEntrants, 1);
    assert.ok(Math.abs((g3?.share ?? 0) - 6 / steam.games.length) < 1e-9);
  });

  it("ranks labels against the other labels of the same platform only", () => {
    assert.equal(byKey.get("genre:g5")?.momentumPercentile, 1);
    assert.equal(byKey.get("genre:g0")?.momentumPercentile, 0);
  });

  it("leaves momentum null when too few members are scored, instead of ranking one title", () => {
    const sparse = {
      platform: "steam",
      games: [
        { id: "a", score: 90, firstSeenAt: daysAgo(40) },
        { id: "b", score: null, firstSeenAt: daysAgo(40) },
        { id: "c", score: null, firstSeenAt: daysAgo(40) },
      ],
      labelsByGame: new Map([["a", ["genre:x"]], ["b", ["genre:x"]], ["c", ["genre:x"]]]),
    };
    const [only] = computePlatformLabelSignals(sparse, asOf);
    assert.equal(only?.members, 3);
    assert.equal(only?.scoredMembers, 1);
    assert.equal(only?.momentum, null);
    assert.equal(only?.momentumPercentile, null);
  });

  it("gives no percentile when the platform has too few labels", () => {
    const few = { platform: "steam", games: [{ id: "a", score: 1, firstSeenAt: daysAgo(40) }], labelsByGame: new Map([["a", ["genre:x"]]]) };
    const [only] = computePlatformLabelSignals(few, asOf);
    assert.equal(only?.sharePercentile, null);
  });

  it("ignores labels of games the platform does not track and counts a repeated label once", () => {
    const input = {
      platform: "steam",
      games: [{ id: "a", score: 1, firstSeenAt: daysAgo(40) }],
      labelsByGame: new Map([["a", ["genre:x", "genre:x"]], ["ghost", ["genre:x"]]]),
    };
    assert.equal(computePlatformLabelSignals(input, asOf)[0]?.members, 1);
  });
});

describe("compareLabelsAcrossPlatforms", () => {
  const steam = computePlatformLabelSignals(platform("steam", (label) => 10 + label * 15), asOf);
  const play = computePlatformLabelSignals(platform("google_play", (label) => 90 - label * 10), asOf).filter((s) => s.key !== "genre:g5");

  it("sets each platform's percentile side by side and reports coverage", () => {
    const rows = compareLabelsAcrossPlatforms([...steam, ...play], ["steam", "google_play", "app_store"]);
    const g0 = rows.find((r) => r.key === "genre:g0");
    assert.equal(g0?.platforms.steam?.momentumPercentile, 0);
    assert.equal(g0?.platforms.google_play?.momentumPercentile, 1);
    assert.equal(g0?.measured, 2);
    assert.equal(g0?.total, 3);
  });

  it("treats a platform without the label as missing, not negative", () => {
    const rows = compareLabelsAcrossPlatforms([...steam, ...play], ["steam", "google_play", "app_store"]);
    const g5 = rows.find((r) => r.key === "genre:g5");
    assert.equal(g5?.platforms.google_play, undefined);
    assert.equal(g5?.present, 1);
    assert.equal(g5?.measured, 1);
  });

  it("orders labels with the most measured platforms first", () => {
    const rows = compareLabelsAcrossPlatforms([...steam, ...play], ["steam", "google_play"]);
    assert.equal(rows.at(-1)?.key, "genre:g5");
  });
});
