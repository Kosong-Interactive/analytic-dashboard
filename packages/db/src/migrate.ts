import { config } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabaseConnection } from "./client";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, "../../..");

config({ path: resolve(repositoryRoot, ".env.local"), quiet: true });

const connectionCandidates = [
  { name: "DIRECT_URL", value: process.env.DIRECT_URL },
  { name: "DATABASE_URL", value: process.env.DATABASE_URL },
].filter(
  (candidate): candidate is { name: string; value: string } =>
    Boolean(candidate.value),
);

if (connectionCandidates.length === 0) {
  throw new Error(
    "Set DIRECT_URL or DATABASE_URL in the repository root .env.local before running migrations.",
  );
}

const retryableConnectionCodes = new Set([
  "ECONNREFUSED",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

function findErrorCode(error: unknown): string | undefined {
  let current = error;

  while (current && typeof current === "object") {
    const record = current as Record<string, unknown>;

    if (typeof record.code === "string") {
      return record.code;
    }

    current = record.cause;
  }

  return undefined;
}

for (const [index, connection] of connectionCandidates.entries()) {
  const { client, db } = createDatabaseConnection(connection.value, { maxConnections: 1 });

  try {
    await migrate(db, {
      migrationsFolder: resolve(repositoryRoot, "packages/db/drizzle"),
    });
    console.info(`Database migrations completed using ${connection.name}.`);
    break;
  } catch (error) {
    const hasFallback = index < connectionCandidates.length - 1;
    const errorCode = findErrorCode(error);

    if (!hasFallback || !errorCode || !retryableConnectionCodes.has(errorCode)) {
      throw error;
    }

    console.warn(
      `${connection.name} was unreachable (${errorCode}); trying the configured pooler connection.`,
    );
  } finally {
    await client.end();
  }
}
