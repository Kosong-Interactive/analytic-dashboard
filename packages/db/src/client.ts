import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index";

export interface DatabaseConnectionOptions {
  maxConnections?: number;
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
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];
