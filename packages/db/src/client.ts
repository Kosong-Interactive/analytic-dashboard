import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index";

export interface DatabaseConnectionOptions {
  maxConnections?: number;
}

/** Supported by postgres.js 3.4 at runtime (default 100) but missing from its type definitions. */
interface PipelineOption {
  max_pipeline: number;
}

export function createDatabaseConnection(
  connectionString: string,
  options: DatabaseConnectionOptions = {},
) {
  if (!connectionString) {
    throw new Error("A PostgreSQL connection string is required");
  }

  const clientOptions: postgres.Options<Record<string, postgres.PostgresType>> & PipelineOption = {
    max: options.maxConnections ?? 3,
    prepare: false,
    // No pipelining: through the Supabase transaction pooler (port 6543), queries pipelined on a
    // busy connection stall until the 2-minute statement timeout. With this off, extra queries wait
    // for a free connection instead. Verified 2026-09-30 with the Overview's concurrent reads: the
    // default pipeline hung with 3 connections; with pipelining off even 1 connection completed.
    max_pipeline: 0,
    // Fail fast instead of waiting forever when the pooler cannot be reached.
    connect_timeout: 30,
  };
  const client = postgres(connectionString, clientOptions);

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];
