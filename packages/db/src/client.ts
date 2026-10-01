import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index";

export interface DatabaseConnectionOptions {
  maxConnections?: number;
  /**
   * Close a connection that has been idle this long. Serverless instances keep their pool while
   * frozen, and every held connection counts against the pooler's small pool, so idle ones must be
   * given back quickly. Unset keeps connections open, which suits the long-running collector.
   */
  idleTimeoutSeconds?: number;
  /** Replace a connection after this long, so none outlives the pooler's own limits. */
  maxLifetimeSeconds?: number;
}

export function createDatabaseConnection(
  connectionString: string,
  options: DatabaseConnectionOptions = {},
) {
  if (!connectionString) {
    throw new Error("A PostgreSQL connection string is required");
  }

  const client = postgres(connectionString, {
    // Not 1: through the Supabase transaction pooler (port 6543), a single connection hangs forever
    // when queries are queued the instant a previous query finishes. Pipelined queries through that
    // pooler can also stall under bursts larger than the pool; the session pooler (port 5432) does
    // not, and supports transactions. Do not set max_pipeline to 0: it breaks sql.begin.
    max: options.maxConnections ?? 3,
    prepare: false,
    // Fail fast instead of waiting forever when the pooler cannot be reached.
    connect_timeout: 30,
    ...(options.idleTimeoutSeconds ? { idle_timeout: options.idleTimeoutSeconds } : {}),
    ...(options.maxLifetimeSeconds ? { max_lifetime: options.maxLifetimeSeconds } : {}),
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];
