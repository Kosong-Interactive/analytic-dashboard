import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { platformIds, platformLabel, platformRegistry, platformsSupporting, supports } from "./platforms.js";
import { storeValues } from "./store.js";

describe("platform registry", () => {
  it("describes every stored platform and nothing else", () => {
    assert.deepEqual(Object.keys(platformRegistry).sort(), [...storeValues].sort());
    assert.deepEqual([...platformIds].sort(), [...storeValues].sort());
    for (const id of platformIds) assert.equal(platformRegistry[id].id, id);
  });

  it("records what each platform publishes", () => {
    assert.equal(supports("google_play", "installs"), true);
    assert.equal(supports("app_store", "installs"), false);
    assert.equal(supports("app_store", "reviewCount"), false);
    assert.equal(supports("app_store", "chartRank"), true);
    assert.equal(supports("app_store", "rating"), true);
    assert.deepEqual(platformsSupporting(["app_store", "google_play"], "installs"), ["google_play"]);
  });

  it("labels platforms for display", () => {
    assert.equal(platformLabel("google_play"), "Google Play");
    assert.equal(platformLabel("app_store"), "App Store");
  });
});
