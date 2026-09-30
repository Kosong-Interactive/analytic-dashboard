import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideSteamSnapshotWrite, steamMetadataHash, type PersistableSteamListing } from "./steam-persistence";

const listing: PersistableSteamListing = {
  externalId: "730",
  title: "Counter-Strike 2",
  description: null,
  developerNames: ["Valve"],
  publisherNames: ["Valve"],
  genres: [],
  categories: ["Multi-player"],
  tags: ["FPS"],
  releaseState: "released",
  releaseDate: "2012-08-21T17:00:00.000Z",
  supportedOperatingSystems: { windows: true, macos: false, linux: true },
  isFree: true,
  headerImageUrl: null,
  storeUrl: "https://store.steampowered.com/app/730/",
  source: "steam_web_api",
  capturedAt: "2026-09-30T08:00:00.000Z",
};

const at = (hours: number) => new Date(Date.UTC(2026, 8, 30, hours));
const reviews = (positive: number) => ({
  capturedAt: at(1).toISOString(),
  purchaseScope: "all",
  languageScope: ["all"],
  offTopicActivityFiltered: true,
  positive,
  negative: 10,
  total: positive + 10,
});

describe("steamMetadataHash", () => {
  it("ignores capture time but changes with described fields", () => {
    const base = steamMetadataHash(listing);
    assert.equal(steamMetadataHash({ ...listing, capturedAt: "2026-10-01T00:00:00.000Z" }), base);
    assert.notEqual(steamMetadataHash({ ...listing, tags: ["FPS", "Shooter"] }), base);
  });
});

describe("decideSteamSnapshotWrite", () => {
  const latest = { capturedAt: at(1), reviewPositive: 100, reviewNegative: 10, currentPlayers: 500 };
  const incoming = (hours: number, positive: number, players: number | null) => ({
    steamAppId: "s1",
    capturedAt: at(hours),
    reviews: reviews(positive),
    players: players === null ? null : { capturedAt: at(hours).toISOString(), currentPlayers: players },
  });

  it("writes the first snapshot and any change", () => {
    assert.equal(decideSteamSnapshotWrite(null, incoming(2, 100, 500)), "first");
    assert.equal(decideSteamSnapshotWrite(latest, incoming(2, 101, 500)), "changed");
    assert.equal(decideSteamSnapshotWrite(latest, incoming(2, 100, 501)), "changed");
  });

  it("treats a value becoming unavailable as a change, not as zero", () => {
    assert.equal(decideSteamSnapshotWrite(latest, incoming(2, 100, null)), "changed");
  });

  it("skips unchanged readings until the daily heartbeat, and stale ones always", () => {
    assert.equal(decideSteamSnapshotWrite(latest, incoming(5, 100, 500)), "unchanged");
    assert.equal(decideSteamSnapshotWrite(latest, incoming(25, 100, 500)), "heartbeat");
    assert.equal(decideSteamSnapshotWrite(latest, incoming(1, 101, 500)), "stale");
  });
});
