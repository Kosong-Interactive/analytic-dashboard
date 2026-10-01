import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCollectorDescriptor } from "./descriptor.js";

describe("collector descriptor", () => {
  it("lists the storefronts given and both mobile sources", () => {
    assert.deepEqual(createCollectorDescriptor(["id", "us"]), {
      countries: ["id", "us"],
      sources: ["app_store", "google_play"],
    });
  });

  it("rejects a storefront the code does not support", () => {
    assert.throws(() => createCollectorDescriptor(["id", "xx"]));
  });

  it("reads the enabled storefronts from the configuration file by default", () => {
    const { countries } = createCollectorDescriptor();
    assert.ok(countries.includes("id"));
    assert.ok(countries.length >= 1);
  });
});
