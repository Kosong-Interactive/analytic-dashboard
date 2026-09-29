import { resolve } from "node:path";

import { config } from "dotenv";

/**
 * Local development keeps one `.env.local` at the repository root, but Next.js only reads the
 * app directory. Load the root file on demand; variables already set (Vercel, shell, apps/web)
 * are never overwritten. dotenv is used instead of `@next/env`, which caches its first load
 * and would ignore a second directory.
 */
export function loadRootEnv(appDir: string = process.cwd()): void {
  config({ path: resolve(appDir, "../..", ".env.local"), quiet: true });
}
