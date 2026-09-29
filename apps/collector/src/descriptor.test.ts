import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCollectorDescriptor } from "./descriptor.js";

describe("collector descriptor", () => {
  it("enables the approved MVP sources and countries", () => {
    assert.deepEqual(createCollectorDescriptor(), {
      countries: ["id", "us"],
      sources: ["app_store", "google_play"],
    });
  });
});
