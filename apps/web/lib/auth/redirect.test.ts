import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { credentialsSchema } from "./credentials";
import { loginPath, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    assert.equal(safeNextPath("/trending?sort=newest"), "/trending?sort=newest");
  });

  it("rejects external, protocol-relative, and malformed targets", () => {
    for (const value of ["https://evil.example", "//evil.example", "/\\evil", "evil", "", null, undefined]) {
      assert.equal(safeNextPath(value), "/");
    }
  });

  it("never sends a signed-in user back to the login page", () => {
    assert.equal(safeNextPath("/login"), "/");
    assert.equal(safeNextPath("/login?next=/x"), "/");
  });
});

describe("loginPath", () => {
  it("encodes the return path and omits the default", () => {
    assert.equal(loginPath("/"), "/login");
    assert.equal(loginPath("/trending?sort=newest"), "/login?next=%2Ftrending%3Fsort%3Dnewest");
    assert.equal(loginPath("//evil.example"), "/login");
  });
});

describe("credentialsSchema", () => {
  it("normalizes the email and accepts a password as is", () => {
    const parsed = credentialsSchema.parse({ email: "  Team@Example.COM ", password: " keep spaces " });
    assert.deepEqual(parsed, { email: "team@example.com", password: " keep spaces " });
  });

  it("rejects a malformed email or empty password", () => {
    assert.equal(credentialsSchema.safeParse({ email: "nope", password: "x" }).success, false);
    assert.equal(credentialsSchema.safeParse({ email: "a@b.co", password: "" }).success, false);
  });
});
