import "server-only";

import { createDatabaseConnection, type Database } from "@analytic-dashboard/db";

import { loadRootEnv } from "./root-env";

const globalForDatabase = globalThis as typeof globalThis & {
  __analyticsDatabase?: Database;
};

/**
 * One lazily created connection per server instance. Use the Supabase session-pooler URL
 * (port 5432) for DATABASE_URL: through the transaction pooler (6543) concurrent queries stall.
 */
export function getDatabase(): Database {
  if (!globalForDatabase.__analyticsDatabase) {
    if (!process.env.DATABASE_URL) loadRootEnv();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    globalForDatabase.__analyticsDatabase =
      createDatabaseConnection(connectionString, {
        // Serverless: give pooler connections back soon after a request, or idle instances starve it.
        maxConnections: 2,
        idleTimeoutSeconds: 10,
        maxLifetimeSeconds: 300,
      }).db;
  }
  return globalForDatabase.__analyticsDatabase;
}
