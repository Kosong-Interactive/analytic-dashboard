import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OverviewCandidate } from "../overview/view-model";
import { watchlistChangeSchema, watchlistFormInput } from "./input";
import { buildWatchlistView, parseWatchlistQuery, watchlistHref, type WatchlistEntryInput } from "./view-model";

const asOf = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);
const uuid = "4b6c3a8e-2f1d-4c9a-9e7b-1a2b3c4d5e6f";

function entry(id: string, overrides: Partial<WatchlistEntryInput> = {}): WatchlistEntryInput {
  return {
    storeAppId: id,
    status: "watching",
    note: null,
    addedBy: "a@example.com",
    addedAt: daysAgo(5),
    updatedBy: "a@example.com",
    updatedAt: daysAgo(5),
    baselineCapturedAt: daysAgo(6),
    baselineRating: 4.1,
    baselineRatingCount: 1000,
    store: "google_play",
    country: "id",
    title: `Game ${id}`,
    developerName: null,
    iconUrl: null,
    ...overrides,
  };
}

function candidate(id: string, rating: number | null, ratingCount: number | null): OverviewCandidate {
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
    firstSeenAt: daysAgo(10),
    snapshots: [{ capturedAt: daysAgo(0.1), rating, ratingCount }],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
  };
}

describe("watchlist query", () => {
  it("defaults to active entries and keeps links short", () => {
    const query = parseWatchlistQuery({ view: "bogus" });
    assert.equal(query.view, "active");
    assert.equal(watchlistHref(query, {}), "/watchlist");
    assert.equal(watchlistHref(query, { view: "archived", country: "us" }), "/watchlist?country=us&view=archived");
  });
});

describe("buildWatchlistView", () => {
  const entries = [
    entry("a", { updatedAt: daysAgo(1) }),
    entry("b", { status: "priority", updatedAt: daysAgo(3) }),
    entry("c", { status: "archived" }),
    entry("d", { baselineRating: null, baselineRatingCount: null, baselineCapturedAt: null }),
  ];
  const candidates = [candidate("a", 4.3, 1500), candidate("b", null, 900), candidate("d", 4, 10)];

  it("puts priority first, hides archived by default, and counts every status", () => {
    const view = buildWatchlistView({ entries, candidates, scores: [], view: "active" });
    assert.deepEqual(view.rows.map((r) => r.entry.storeAppId), ["b", "a", "d"]);
    assert.deepEqual(view.counts, { active: 3, priority: 1, archived: 1, all: 4 });
  });

  it("computes movement since added and keeps missing readings missing", () => {
    const view = buildWatchlistView({ entries, candidates, scores: [], view: "all" });
    const byId = new Map(view.rows.map((r) => [r.entry.storeAppId, r]));
    assert.equal(byId.get("a")?.ratingCountSinceAdded, 500);
    assert.ok(Math.abs((byId.get("a")?.ratingSinceAdded ?? 0) - 0.2) < 1e-9);
    assert.equal(byId.get("b")?.ratingCountSinceAdded, -100);
    assert.equal(byId.get("b")?.ratingSinceAdded, null);
    assert.equal(byId.get("c")?.current, null);
    assert.equal(byId.get("c")?.ratingCountSinceAdded, null);
    assert.equal(byId.get("d")?.ratingCountSinceAdded, null);
  });
});

describe("watchlistChangeSchema", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return watchlistFormInput(data);
  };

  it("accepts an update and turns a blank note into a cleared note", () => {
    const parsed = watchlistChangeSchema.parse(form({ intent: "update", storeAppId: uuid, status: "priority", note: "   " }));
    assert.deepEqual(parsed, { intent: "update", storeAppId: uuid, status: "priority", note: null });
  });

  it("rejects unknown intents, statuses, bad ids, and long notes", () => {
    assert.equal(watchlistChangeSchema.safeParse(form({ intent: "delete", storeAppId: uuid })).success, false);
    assert.equal(watchlistChangeSchema.safeParse(form({ intent: "update", storeAppId: uuid, status: "done" })).success, false);
    assert.equal(watchlistChangeSchema.safeParse(form({ intent: "add", storeAppId: "x" })).success, false);
    assert.equal(
      watchlistChangeSchema.safeParse(form({ intent: "update", storeAppId: uuid, note: "x".repeat(2001) })).success,
      false,
    );
  });
});
