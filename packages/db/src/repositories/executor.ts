import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

import type * as schema from "../schema/index";

/** Accepts the pooled database and a transaction, so callers can compose repositories atomically. */
export type DatabaseExecutor = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema
>;
