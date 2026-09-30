import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SteamLabelGame, SteamLabelMembershipRow } from "@analytic-dashboard/db";

import { buildSteamLabelOverview } from "./label-overview";

const game = (id: string, players: number | null, positive: number | null, negative: number | null, rank: number | null = null): SteamLabelGame => ({
  steamAppId: id,
  externalId: `${id}0`,
  title: `Game ${id}`,
  headerImageUrl: null,
  mostPlayedRank: rank,
  snapshot: {
    capturedAt: new Date(0),
    reviewPositive: positive,
    reviewNegative: negative,
    reviewTotal: positive === null || negative === null ? null : positive + negative,
    reviewsCapturedAt: null,
    currentPlayers: players,
    playersCapturedAt: null,
  },
});

const member = (steamAppId: string, slug: string): SteamLabelMembershipRow => ({
  steamAppId,
  type: "genre",
  slug,
  displayName: slug,
  confidence: 0.75,
  source: "rule",
});

describe("buildSteamLabelOverview", () => {
  const games = [game("a", 1000, 90, 10, 1), game("b", 500, 50, 50), game("c", null, null, null), game("d", 10, 1, 1)];
  const membership = [member("a", "rpg"), member("b", "rpg"), member("c", "rpg"), member("d", "action")];

  it("counts members, shares, and keeps missing values out of sums and means", () => {
    const { labels, tracked, labelled } = buildSteamLabelOverview({ games, membership, sort: "games" });
    assert.equal(tracked, 4);
    assert.equal(labelled, 4);
    const rpg = labels[0];
    assert.equal(rpg?.slug, "rpg");
    assert.equal(rpg?.games, 3);
    assert.equal(rpg?.share, 0.75);
    assert.equal(rpg?.currentPlayers, 1500);
    // Only a and b report reviews: mean of 0.9 and 0.5.
    assert.ok(Math.abs((rpg?.averagePositive ?? 0) - 0.7) < 1e-9);
    assert.equal(rpg?.onMostPlayed, 1);
    assert.deepEqual(rpg?.topGames.map((g) => g.title), ["Game a", "Game b", "Game c"]);
  });

  it("returns null, not zero, when no member reports players or reviews", () => {
    const { labels } = buildSteamLabelOverview({ games: [game("c", null, null, null)], membership: [member("c", "rpg")], sort: "games" });
    assert.equal(labels[0]?.currentPlayers, null);
    assert.equal(labels[0]?.averagePositive, null);
  });

  it("sorts by players with missing values last", () => {
    const { labels } = buildSteamLabelOverview({ games, membership, sort: "players" });
    assert.deepEqual(labels.map((l) => l.slug), ["rpg", "action"]);
  });

  it("ignores membership for games that are not tracked", () => {
    const { labels, labelled } = buildSteamLabelOverview({ games: [], membership: [member("zzz", "rpg")], sort: "games" });
    assert.equal(labels.length, 0);
    assert.equal(labelled, 0);
  });
});
