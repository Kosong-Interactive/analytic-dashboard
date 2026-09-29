import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { overviewHref, parseOverviewFilters } from "./filters";

describe("parseOverviewFilters", () => {
  it("defaults to Indonesia and all platforms", () => {
    assert.deepEqual(parseOverviewFilters({}), { country: "id", platform: "all" });
  });

  it("accepts valid values", () => {
    assert.deepEqual(
      parseOverviewFilters({ country: "us", platform: "app_store" }),
      { country: "us", platform: "app_store" },
    );
  });

  it("falls back for unknown values and takes the first repeated one", () => {
    assert.deepEqual(
      parseOverviewFilters({ country: "zz", platform: ["google_play", "app_store"] }),
      { country: "id", platform: "google_play" },
    );
  });
});

describe("overviewHref", () => {
  it("omits defaults so shared links stay short", () => {
    const current = { country: "id", platform: "all" } as const;
    assert.equal(overviewHref(current, {}), "/");
    assert.equal(overviewHref(current, { country: "us" }), "/?country=us");
    assert.equal(
      overviewHref({ country: "us", platform: "app_store" }, { platform: "all" }),
      "/?country=us",
    );
  });
});
