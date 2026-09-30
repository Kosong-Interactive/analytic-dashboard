import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabaseConnection } from "./client";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, "../../..");

config({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error(
    "Set DATABASE_URL or DIRECT_URL in the repository root .env.local before verifying the database.",
  );
}

const expectedTables = [
  "app_labels",
  "app_snapshots",
  "apps",
  "chart_entries",
  "classification_runs",
  "collector_runs",
  "jobs",
  "market_opportunities",
  "opportunity_decisions",
  "research_runs",
  "reviews",
  "steam_apps",
  "steam_chart_entries",
  "steam_collector_runs",
  "steam_prices",
  "steam_snapshots",
  "store_apps",
  "studio_profiles",
  "opportunity_research_briefs",
  "taxonomy_labels",
  "watchlist_entries",
] as const;

const { client } = createDatabaseConnection(connectionString);

try {
  const tableRows = await client<
    Array<{ tableName: string; rlsEnabled: boolean }>
  >`
    select
      c.relname as "tableName",
      c.relrowsecurity as "rlsEnabled"
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any(${expectedTables})
    order by c.relname
  `;

  const foundTables = new Set(tableRows.map((row) => row.tableName));
  const missingTables = expectedTables.filter(
    (tableName) => !foundTables.has(tableName),
  );
  const tablesWithoutRls = tableRows
    .filter((row) => !row.rlsEnabled)
    .map((row) => row.tableName);

  const [migrationResult] = await client<Array<{ count: number }>>`
    select count(*)::integer as count
    from drizzle.__drizzle_migrations
  `;

  const [policyResult] = await client<Array<{ count: number }>>`
    select count(*)::integer as count
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any(${expectedTables})
  `;

  if (missingTables.length > 0) {
    throw new Error(`Missing database tables: ${missingTables.join(", ")}`);
  }

  if (tablesWithoutRls.length > 0) {
    throw new Error(
      `Row Level Security is disabled for: ${tablesWithoutRls.join(", ")}`,
    );
  }

  if (!migrationResult || migrationResult.count < 1) {
    throw new Error("No applied Drizzle migration was recorded");
  }

  if (!policyResult || policyResult.count !== 0) {
    throw new Error(
      "Initial internal tables must not expose browser-accessible RLS policies",
    );
  }

  console.info(
    `Database verified: ${tableRows.length} tables, RLS enabled, ${migrationResult.count} migration applied, no public policies.`,
  );
} finally {
  await client.end();
}
