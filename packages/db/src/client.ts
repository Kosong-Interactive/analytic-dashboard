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
    max: options.maxConnections ?? 1,
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
