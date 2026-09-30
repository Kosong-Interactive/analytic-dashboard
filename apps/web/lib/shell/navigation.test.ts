import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NAV_ENTRIES, navItemsFor, platformModeOf, platformSwitchHref } from "./navigation";

describe("navItemsFor", () => {
  it("keeps Mobile and Desktop menus apart", () => {
    const mobile = navItemsFor("mobile");
    const desktop = navItemsFor("desktop");
    assert.deepEqual(mobile.map((i) => i.href), ["/", "/trending", "/new-releases", "/genres", "/mechanics", "/games"]);
    assert.deepEqual(desktop.map((i) => i.href), [
      "/steam", "/steam/trending", "/steam/new-releases", "/steam/genres", "/steam/mechanics", "/steam/games", "/steam/charts",
    ]);
    assert.ok(mobile.every((i) => i.mode === "mobile"));
    assert.ok(desktop.every((i) => i.mode === "desktop"));
  });

  it("gives Steam Charts as the only Desktop-only menu", () => {
    assert.deepEqual(NAV_ENTRIES.filter((e) => !e.counterpart).map((e) => e.key), ["steam-charts"]);
  });

  it("pairs every counterpart in both directions", () => {
    for (const entry of NAV_ENTRIES.filter((e) => e.counterpart)) {
      const other = NAV_ENTRIES.find((e) => e.key === entry.counterpart);
      assert.equal(other?.counterpart, entry.key);
      assert.notEqual(other?.mode, entry.mode);
    }
  });
});

describe("platformModeOf", () => {
  it("derives the mode from the page key", () => {
    assert.equal(platformModeOf("games"), "mobile");
    assert.equal(platformModeOf("steam-games"), "desktop");
    assert.equal(platformModeOf("steam-charts"), "desktop");
  });
});

describe("platformSwitchHref", () => {
  const go = (active: Parameters<typeof platformSwitchHref>[0]["active"], target: "mobile" | "desktop", country = "id", noCounterpart = false) =>
    platformSwitchHref({ active, target, country, noCounterpart });

  it("goes to the equivalent menu", () => {
    assert.equal(go("overview", "desktop"), "/steam");
    assert.equal(go("trending", "desktop"), "/steam/trending");
    assert.equal(go("releases", "desktop"), "/steam/new-releases");
    assert.equal(go("genres", "desktop"), "/steam/genres");
    assert.equal(go("mechanics", "desktop"), "/steam/mechanics");
    assert.equal(go("games", "desktop"), "/steam/games");
    assert.equal(go("steam-games", "mobile"), "/games");
    assert.equal(go("steam-overview", "mobile"), "/");
  });

  it("sends detail, Watchlist, and Compare (Games key) to the other mode's Games list", () => {
    assert.equal(go("games", "desktop", "us"), "/steam/games?country=us");
    assert.equal(go("steam-games", "mobile"), "/games");
  });

  it("falls back to the target Overview when there is no equivalent", () => {
    assert.equal(go("steam-charts", "mobile"), "/");
    assert.equal(go("games", "desktop", "id", true), "/steam");
    assert.equal(go("steam-games", "mobile", "us", true), "/?country=us");
  });

  it("keeps the current page for the mode already shown", () => {
    assert.equal(go("steam-genres", "desktop"), "/steam/genres");
    assert.equal(go("games", "mobile"), "/games");
    assert.equal(go("games", "mobile", "id", true), "/");
  });

  it("carries only the country", () => {
    assert.equal(go("trending", "desktop", "us"), "/steam/trending?country=us");
    assert.equal(go("steam-releases", "mobile", "us"), "/new-releases?country=us");
  });
});
