import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TrendingScore } from "@analytic-dashboard/analytics";

import type { OverviewCandidate } from "../overview/view-model";
import { buildLabelOverview, type MembershipRow } from "./aggregate";
import { genresPage, labelHref, mechanicsPage, parseLabelQuery } from "./query";
import { steamManualLabelInputSchema } from "../steam/manual-label-input";

const asOf = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

function candidate(id: string, rating: number | null, firstSeenDaysAgo = 30): OverviewCandidate {
  return {
    storeAppId: id,
    store: "google_play",
    country: "id",
    title: `Game ${id}`,
    developerName: null,
    storeCategory: null,
    iconUrl: null,
    storeUrl: "https://example.com",
    releaseDate: null,
    firstSeenAt: daysAgo(firstSeenDaysAgo),
    snapshots: [{ capturedAt: daysAgo(0), rating, ratingCount: 100 }],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
  };
}

const member = (storeAppId: string, slug: string, source: MembershipRow["source"] = "rule"): MembershipRow => ({
  storeAppId,
  type: "genre",
  slug,
  displayName: slug,
  confidence: 0.95,
  source,
});

const score = (id: string, value: number | null) => ({ id, score: value }) as TrendingScore;

describe("buildLabelOverview", () => {
  const candidates = [candidate("a", 4), candidate("b", null, 2), candidate("c", 5), candidate("d", 3)];
  const membership = [member("a", "puzzle"), member("b", "puzzle", "manual"), member("c", "puzzle"), member("d", "action"), member("zz", "action")];

  it("counts members, share, new games, and average rating ignoring missing ratings", () => {
    const view = buildLabelOverview({ candidates, scores: [], membership, sort: "games", asOf });
    const puzzle = view.labels[0];

    assert.equal(puzzle?.slug, "puzzle");
    assert.equal(puzzle?.games, 3);
    assert.equal(puzzle?.share, 0.75);
    assert.equal(puzzle?.newlyDiscovered7d, 1);
    assert.equal(puzzle?.averageRating, 4.5);
    assert.ok(Math.abs((puzzle?.manualShare ?? 0) - 1 / 3) < 1e-9);
    // "zz" is not in the selection, so it is ignored everywhere.
    assert.equal(view.labels[1]?.games, 1);
    assert.equal(view.tracked, 4);
    assert.equal(view.labelled, 4);
  });

  it("keeps momentum empty until members are scored, then averages scored members only", () => {
    const unscored = buildLabelOverview({ candidates, scores: [], membership, sort: "games", asOf });
    assert.equal(unscored.labels[0]?.momentum, null);

    const scored = buildLabelOverview({
      candidates,
      scores: [score("a", 80), score("c", 40), score("b", null)],
      membership,
      sort: "momentum",
      asOf,
    });
    assert.equal(scored.labels[0]?.slug, "puzzle");
    assert.equal(scored.labels[0]?.momentum, 60);
    assert.equal(scored.labels[0]?.scoredGames, 2);
    assert.deepEqual(scored.labels[0]?.topGames.map((g) => g.id), ["a", "c", "b"]);
    assert.equal(scored.labels[1]?.momentum, null);
  });
});

describe("label page query", () => {
  it("defaults to the first type and falls back on unknown values", () => {
    assert.deepEqual(parseLabelQuery(genresPage, {}), { country: "id", platform: "all", market: "id", type: "genre", sort: "games" });
    const query = parseLabelQuery(mechanicsPage, { type: "genre", sort: "x" });
    assert.equal(query.type, "core_mechanic");
    assert.equal(query.sort, "games");
  });

  it("builds short, shareable links", () => {
    const query = parseLabelQuery(mechanicsPage, {});
    assert.equal(labelHref(mechanicsPage, query, {}), "/mechanics");
    assert.equal(labelHref(mechanicsPage, query, { type: "theme", sort: "momentum" }), "/mechanics?type=theme&sort=momentum");
  });
});

describe("steamManualLabelInputSchema", () => {
  const valid = {
    steamAppId: "00000000-0000-4000-8000-000000000001",
    labelId: "00000000-0000-4000-8000-000000000002",
    intent: "confirm",
  };

  it("accepts a tracked-game identity and supported decision", () => {
    assert.equal(steamManualLabelInputSchema.safeParse(valid).success, true);
  });

  it("rejects malformed ids and unknown decisions", () => {
    assert.equal(steamManualLabelInputSchema.safeParse({ ...valid, steamAppId: "730" }).success, false);
    assert.equal(steamManualLabelInputSchema.safeParse({ ...valid, intent: "delete" }).success, false);
  });
});
