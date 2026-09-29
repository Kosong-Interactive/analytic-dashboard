import "server-only";

import { createDatabaseConnection, type Database } from "@analytic-dashboard/db";

const globalForDatabase = globalThis as typeof globalThis & {
  __analyticsDatabase?: Database;
};

/**
 * One lazily created connection per server instance. On Vercel use the Supabase
 * transaction-pooler URL for DATABASE_URL; the client already disables prepared statements.
 */
export function getDatabase(): Database {
  if (!globalForDatabase.__analyticsDatabase) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    globalForDatabase.__analyticsDatabase =
      createDatabaseConnection(connectionString).db;
  }
  return globalForDatabase.__analyticsDatabase;
}
