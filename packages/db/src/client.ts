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
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];
