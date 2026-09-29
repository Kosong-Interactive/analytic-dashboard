import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MembershipRow } from "../labels/aggregate";
import { buildComparison, compareHref, parseCompareQuery, searchCandidates, type CompareCandidate } from "./comparison";

const asOf = new Date("2026-09-30T12:00:00Z");
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

function candidate(id: string, store: "app_store" | "google_play", title: string): CompareCandidate {
  return {
    storeAppId: id,
    store,
    country: "id",
    title,
    developerName: "Studio",
    storeCategory: null,
    iconUrl: null,
    storeUrl: "https://example.com",
    releaseDate: null,
    firstSeenAt: asOf,
    snapshots: [
      { capturedAt: new Date(asOf.getTime() - 86_400_000), rating: 4, ratingCount: 10, minInstalls: 1000, maxInstalls: 5000 },
      { capturedAt: asOf, rating: 4.2, ratingCount: 20, minInstalls: store === "google_play" ? 10_000 : null, maxInstalls: null },
    ],
    ranks: [],
    countryBreadth: { current: 1, previous: 1 },
  };
}

const label = (storeAppId: string, type: string, slug: string): MembershipRow => ({
  storeAppId,
  type,
  slug,
  displayName: slug,
  confidence: 0.9,
  source: "rule",
});

describe("parseCompareQuery", () => {
  it("accepts comma-separated or repeated ids, drops invalid and duplicates, and caps at four", () => {
    const query = parseCompareQuery({ ids: [`${ids[0]},bad,${ids[1]}`, ids[0]!, `${ids[2]},${ids[3]},${ids[4]}`] });
    assert.deepEqual(query.ids, ids.slice(0, 4));
  });

  it("builds shareable links", () => {
    const query = parseCompareQuery({ ids: ids[0]!, q: " merge " });
    assert.equal(query.q, "merge");
    assert.equal(compareHref(query, { q: "" }), `/compare?ids=${ids[0]}`);
    assert.equal(compareHref(query, { ids: [] , q: "" }), "/compare");
  });
});

describe("buildComparison", () => {
  const candidates = [candidate(ids[0]!, "google_play", "Merge A"), candidate(ids[1]!, "app_store", "Merge B")];
  const membership = [
    label(ids[0]!, "genre", "puzzle"),
    label(ids[1]!, "genre", "puzzle"),
    label(ids[0]!, "core_mechanic", "merging"),
  ];
  const comparison = buildComparison({ ids: [ids[1]!, ids[0]!, ids[2]!], candidates, scores: [], membership });

  it("keeps the requested order and reports untracked ids", () => {
    assert.deepEqual(comparison.games.map((g) => g.row.id), [ids[1], ids[0]]);
    assert.deepEqual(comparison.missingIds, [ids[2]]);
  });

  it("flags mixed stores and marks labels shared by every game", () => {
    assert.equal(comparison.mixedStores, true);
    assert.equal(comparison.mixedCountries, false);
    assert.deepEqual(comparison.games[0]?.genres.map((l) => `${l.slug}:${l.shared}`), ["puzzle:true"]);
    assert.deepEqual(comparison.games[1]?.mechanics.map((l) => `${l.slug}:${l.shared}`), ["merging:false"]);
  });

  it("uses the latest observation and never invents App Store installs", () => {
    const [appStore, googlePlay] = comparison.games;
    assert.equal(googlePlay?.row.ratingCount, 20);
    assert.deepEqual(googlePlay?.installs, { min: 10_000, max: null });
    assert.equal(appStore?.installs, null);
    assert.equal(appStore?.row.ratingCountPerDay, null);
  });

  it("does not mark a label shared when only one game is compared", () => {
    const single = buildComparison({ ids: [ids[0]!], candidates, scores: [], membership });
    assert.equal(single.games[0]?.genres[0]?.shared, false);
  });
});

describe("searchCandidates", () => {
  it("matches title or developer and excludes games already compared", () => {
    const candidates = [candidate(ids[0]!, "google_play", "Merge A"), candidate(ids[1]!, "google_play", "Tower")];
    assert.deepEqual(searchCandidates(candidates, "merge", []).map((c) => c.storeAppId), [ids[0]]);
    assert.deepEqual(searchCandidates(candidates, "studio", [ids[0]!]).map((c) => c.storeAppId), [ids[1]]);
    assert.deepEqual(searchCandidates(candidates, "", []), []);
  });
});
