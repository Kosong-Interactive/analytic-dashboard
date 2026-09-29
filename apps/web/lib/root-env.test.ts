import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { loadEnvConfig } from "@next/env";

import { loadRootEnv } from "./root-env";

function fakeRepo(envLocal: string): string {
  const root = mkdtempSync(join(tmpdir(), "root-env-"));
  const appDir = join(root, "apps", "web");
  mkdirSync(appDir, { recursive: true });
  writeFileSync(join(root, ".env.local"), envLocal);
  return appDir;
}

describe("loadRootEnv", () => {
  afterEach(() => {
    delete process.env.ROOT_ENV_TEST_VALUE;
  });

  it("reads variables from the repository root", () => {
    delete process.env.ROOT_ENV_TEST_VALUE;
    loadRootEnv(fakeRepo("ROOT_ENV_TEST_VALUE=from-root\n"));
    assert.equal(process.env.ROOT_ENV_TEST_VALUE, "from-root");
  });

  it("still loads after Next.js has already loaded (and cached) the app directory env", () => {
    delete process.env.ROOT_ENV_TEST_VALUE;
    const appDir = fakeRepo("ROOT_ENV_TEST_VALUE=from-root\n");
    loadEnvConfig(appDir);
    loadRootEnv(appDir);
    assert.equal(process.env.ROOT_ENV_TEST_VALUE, "from-root");
  });

  it("does not override a variable that is already set", () => {
    process.env.ROOT_ENV_TEST_VALUE = "already-set";
    loadRootEnv(fakeRepo("ROOT_ENV_TEST_VALUE=from-root\n"));
    assert.equal(process.env.ROOT_ENV_TEST_VALUE, "already-set");
  });
});
