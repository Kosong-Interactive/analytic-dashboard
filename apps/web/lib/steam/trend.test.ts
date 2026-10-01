import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SteamGameListRow, SteamHistoryReading } from "@analytic-dashboard/db";

import { buildSteamTrendList } from "./trend";

const asOf = new Date("2026-10-01T00:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

function game(id: string, rank: number | null, lastWeek: number | null, overrides: Partial<SteamGameListRow> = {}): SteamGameListRow {
  return {
    steamAppId: id,
    externalId: `${id}0`,
    title: `Game ${id}`,
    headerImageUrl: null,
    isFree: false,
    releaseState: "released",
    releaseDate: null,
    tags: [],
    firstSeenAt: daysAgo(1),
    snapshot: null,
    prices: {},
    charts: { most_played: rank === null ? null : { rank, lastWeekRank: lastWeek }, top_sellers: null },
    ...overrides,
  };
}

describe("buildSteamTrendList", () => {
  const games = [game("a", 10, 10), game("b", 10, 40), game("c", 10, 90), game("d", null, null, { firstSeenAt: daysAgo(90) })];
  const history = new Map<string, readonly SteamHistoryReading[]>();

  it("ranks scored games best first and leaves unscored games out", () => {
    const list = buildSteamTrendList({ games, history, asOf });
    assert.deepEqual(list.rows.map((r) => r.game.steamAppId), ["c", "b", "a"]);
    assert.equal(list.tracked, 4);
    assert.equal(list.scoredCount, 3);
    assert.ok(list.rows.every((r) => r.tier !== null));
  });

  it("reports how much of the score weight was measurable", () => {
    const list = buildSteamTrendList({ games, history, asOf });
    assert.ok(Math.abs((list.averageCoverage ?? 0) - 0.5) < 1e-9);
  });

  it("returns an empty list with a null coverage when nothing can be scored", () => {
    const list = buildSteamTrendList({ games: [game("a", null, null, { firstSeenAt: daysAgo(90) })], history, asOf });
    assert.equal(list.rows.length, 0);
    assert.equal(list.averageCoverage, null);
  });

  it("uses reading history when it covers the window", () => {
    const readings = (players: number[]): SteamHistoryReading[] =>
      players.map((value, i) => ({ capturedAt: daysAgo(14 - i * 14), currentPlayers: value, reviewPositive: 90, reviewTotal: 100 }));
    const withHistory = new Map<string, readonly SteamHistoryReading[]>([
      ["a", readings([100, 100])],
      ["b", readings([100, 300])],
      ["c", readings([100, 200])],
    ]);
    const list = buildSteamTrendList({ games: [game("a", 5, 5), game("b", 5, 5), game("c", 5, 5)], history: withHistory, asOf });
    const growth = list.rows.find((r) => r.game.steamAppId === "b")?.score.components.find((c) => c.component === "playerMomentum7d");
    assert.equal(growth?.raw, 2);
    assert.equal(list.rows[0]?.game.steamAppId, "b");
  });
});
