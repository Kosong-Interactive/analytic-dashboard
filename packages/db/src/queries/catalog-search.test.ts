import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { escapeLikePattern } from "./catalog-search";

describe("escapeLikePattern", () => {
  it("makes LIKE wildcards and the escape character literal", () => {
    assert.equal(escapeLikePattern("100%_fun\\"), "100\\%\\_fun\\\\");
    assert.equal(escapeLikePattern("Merge Town"), "Merge Town");
  });
});
