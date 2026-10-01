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
        // The session pooler admits only a few clients in total (15 on this project) and every
        // serverless instance, including frozen ones from earlier deployments, keeps its sockets.
        // One connection per instance halves that footprint; queries of one request still go out
        // together and share it, and no web transaction runs a query outside its own `tx`.
        maxConnections: 1,
        idleTimeoutSeconds: 10,
        maxLifetimeSeconds: 300,
      }).db;
  }
  return globalForDatabase.__analyticsDatabase;
}
