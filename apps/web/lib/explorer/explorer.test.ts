import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TrendingScore } from "@analytic-dashboard/analytics";

import { summarizeFreshness } from "../freshness/summary";
import type { MembershipRow } from "../labels/aggregate";
import type { OverviewCandidate } from "../overview/view-model";
import { buildExplorerList } from "./list";
import { clearedExplorerFilters, explorerHref, parseExplorerQuery } from "./query";

const asOf = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(asOf.getTime() - d * 86_400_000);

function candidate(
  id: string,
  overrides: Partial<OverviewCandidate> & { rating?: number | null; ratingCount?: number | null } = {},
): OverviewCandidate {
  const { rating = 4, ratingCount = 100, ...rest } = overrides;
  return {
    storeAppId: id,
    store: "google_play",
    country: "id",
    title: `Game ${id}`,
    developerName: "Studio",
    storeCategory: "Puzzle",
    iconUrl: null,
    storeUrl: "https://example.com",
    releaseDate: null,
    firstSeenAt: daysAgo(2),
    snapshots: [{ capturedAt: daysAgo(0.1), rating, ratingCount }],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
    ...rest,
  };
}

function score(id: string, value: number | null): TrendingScore {
  return {
    id,
    score: value,
    weightCoverage: value === null ? 0 : 1,
    components: [],
    reason: value === null ? "Not enough history" : null,
    latestObservationAt: daysAgo(0.1),
  } as unknown as TrendingScore;
}

function label(storeAppId: string, type: string, slug: string, source: MembershipRow["source"] = "rule"): MembershipRow {
  return { storeAppId, type, slug, displayName: slug[0]!.toUpperCase() + slug.slice(1), confidence: 0.9, source };
}

const candidates = [
  candidate("a", { title: "Merge Town", ratingCount: 500, releaseDate: daysAgo(10) }),
  candidate("b", { title: "Tower Rush", developerName: "Rush Games", storeCategory: "Strategy", rating: null, ratingCount: null }),
  candidate("c", { title: "Quiet Farm", ratingCount: 50, releaseDate: daysAgo(200), firstSeenAt: daysAgo(0.5) }),
];
const scores = [score("a", 72), score("b", null), score("c", 35)];
const membership = [
  label("a", "genre", "puzzle"),
  label("a", "core_mechanic", "merging", "manual"),
  label("c", "genre", "simulation"),
];

function build(params: Record<string, string>) {
  return buildExplorerList({ candidates, scores, membership, query: parseExplorerQuery(params), asOf });
}

describe("parseExplorerQuery", () => {
  it("defaults to no filters, most rated first", () => {
    const query = parseExplorerQuery({});
    assert.equal(query.sort, "most_rated");
    assert.equal(query.q, "");
    assert.equal(query.genre, undefined);
    assert.equal(query.released, "any");
    assert.equal(query.page, 1);
  });

  it("falls back on unknown values and rejects unsafe slugs", () => {
    const query = parseExplorerQuery({ sort: "x", released: "7", minRating: "2", momentum: "hot", genre: "Bad Slug!", page: "-1" });
    assert.equal(query.sort, "most_rated");
    assert.equal(query.released, "any");
    assert.equal(query.minRating, 0);
    assert.equal(query.momentum, "any");
    assert.equal(query.genre, undefined);
    assert.equal(query.page, 1);
  });

  it("trims and bounds free text", () => {
    assert.equal(parseExplorerQuery({ q: `  ${"x".repeat(100)}  ` }).q.length, 80);
  });

  it("keeps the compare selection across filters, and keeps the page when only the selection changes", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const query = { ...parseExplorerQuery({ compare: `${id},bad`, genre: "puzzle" }), page: 3 };
    assert.deepEqual(query.compare, [id]);
    assert.equal(explorerHref(query, { compare: [] }), "/games?genre=puzzle&page=3");
    assert.equal(explorerHref(query, { genre: undefined }), `/games?compare=${id}`);
    assert.equal(explorerHref(query, clearedExplorerFilters), `/games?compare=${id}`);
  });

  it("builds short, shareable links that reset the page", () => {
    const query = { ...parseExplorerQuery({ genre: "puzzle", q: "merge" }), page: 3 };
    assert.equal(explorerHref(query, { sort: "name" }), "/games?q=merge&genre=puzzle&sort=name");
    assert.equal(explorerHref(query, { page: 4 }), "/games?q=merge&genre=puzzle&page=4");
    assert.equal(explorerHref(query, clearedExplorerFilters), "/games");
  });
});

describe("buildExplorerList", () => {
  it("sorts missing values last and keeps them missing", () => {
    const list = build({});
    assert.deepEqual(list.rows.map((r) => r.id), ["a", "c", "b"]);
    assert.equal(list.rows[2]?.ratingCount, null);
    assert.equal(list.rows[2]?.rating, null);
  });

  it("matches title or developer text case-insensitively", () => {
    assert.deepEqual(build({ q: "rush" }).rows.map((r) => r.id), ["b"]);
    assert.deepEqual(build({ q: "MERGE" }).rows.map((r) => r.id), ["a"]);
  });

  it("filters by category, genre, and mechanic", () => {
    assert.deepEqual(build({ category: "Strategy" }).rows.map((r) => r.id), ["b"]);
    assert.deepEqual(build({ genre: "simulation" }).rows.map((r) => r.id), ["c"]);
    assert.deepEqual(build({ mechanic: "merging" }).rows.map((r) => r.id), ["a"]);
  });

  it("uses the store release date only, and can select games without one", () => {
    assert.deepEqual(build({ released: "30" }).rows.map((r) => r.id), ["a"]);
    assert.deepEqual(build({ released: "365" }).rows.map((r) => r.id), ["a", "c"]);
    assert.deepEqual(build({ released: "unknown" }).rows.map((r) => r.id), ["b"]);
  });

  it("never lets a missing rating pass a rating filter", () => {
    assert.deepEqual(build({ minRating: "3" }).rows.map((r) => r.id), ["a", "c"]);
  });

  it("filters by momentum tier and score availability", () => {
    assert.deepEqual(build({ momentum: "trending" }).rows.map((r) => r.id), ["a"]);
    assert.deepEqual(build({ momentum: "growing" }).rows.map((r) => r.id), ["a", "c"]);
    assert.deepEqual(build({ momentum: "unscored" }).rows.map((r) => r.id), ["b"]);
  });

  it("filters by classification status", () => {
    assert.deepEqual(build({ labels: "unlabelled" }).rows.map((r) => r.id), ["b"]);
    assert.deepEqual(build({ labels: "labelled" }).rows.map((r) => r.id), ["a", "c"]);
    assert.deepEqual(build({ labels: "confirmed" }).rows.map((r) => r.id), ["a"]);
  });

  it("paginates with stable ranks and clamps an out-of-range page", () => {
    const many = Array.from({ length: 30 }, (_, i) => candidate(`g${String(i).padStart(2, "0")}`, { ratingCount: 10 }));
    const list = buildExplorerList({ candidates: many, scores: [], membership: [], query: parseExplorerQuery({ page: "9" }), asOf });
    assert.equal(list.page, 2);
    assert.equal(list.pageCount, 2);
    assert.equal(list.rows.length, 5);
    assert.equal(list.rows[0]?.rank, 26);
    assert.equal(list.rows[0]?.id, "g25");
  });

  it("offers filter options with counts across all tracked games", () => {
    const { options } = build({ q: "nothing matches" });
    assert.deepEqual(options.categories, [
      { value: "Puzzle", label: "Puzzle", count: 2 },
      { value: "Strategy", label: "Strategy", count: 1 },
    ]);
    assert.deepEqual(options.mechanics.map((o) => o.value), ["merging"]);
  });
});

describe("summarizeFreshness", () => {
  it("reports the worst state per store and a store with no runs as never collected", () => {
    const health = [
      { source: "google_play" as const, country: "id", jobType: "discovery.chart", latestStatus: "succeeded", latestErrorCount: 0, lastCollectedAt: daysAgo(0.1) },
      { source: "google_play" as const, country: "id", jobType: "discovery.search", latestStatus: "failed", latestErrorCount: 3, lastCollectedAt: daysAgo(1) },
    ];
    const summary = summarizeFreshness(health, ["google_play", "app_store"], asOf);
    assert.deepEqual(
      summary.map((s) => `${s.store}:${s.state}:${s.lastCollectedAt?.toISOString() ?? "null"}`),
      [`google_play:failed:${daysAgo(0.1).toISOString()}`, "app_store:never:null"],
    );
  });
});
