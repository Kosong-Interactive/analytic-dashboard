import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  AppleSearchCollector,
  GooglePlayCollector,
} from "@analytic-dashboard/collectors";
import { createDatabaseConnection } from "@analytic-dashboard/db";
import { countryCodeSchema, storeSchema } from "@analytic-dashboard/shared";
import { config as loadEnv } from "dotenv";

import {
  buildDiscoveryJobs,
  runDiscoveryJob,
  type DiscoveryJobResult,
} from "../jobs/discovery.js";
import {
  getRepositoryRoot,
  loadDiscoverySeeds,
  loadEnabledCountries,
} from "../runtime/config.js";
import {
  createDatabaseDiscoveryStore,
  createDryRunDiscoveryStore,
  type DiscoveryStore,
} from "../runtime/discovery-store.js";

/**
 * Small, rerunnable discovery sample for the enabled storefronts. It is a
 * sampled signal from seeds and top charts, never a complete catalog.
 * Exit code is non-zero when any job failed outright or hit an error.
 */
export async function runDiscoverCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      source: { type: "string" },
      country: { type: "string" },
    },
  });
  const source = values.source ? storeSchema.parse(values.source) : undefined;
  const country = values.country
    ? countryCodeSchema.parse(values.country)
    : undefined;
  const dryRun = values["dry-run"] === true;

  const jobs = buildDiscoveryJobs(
    { apple: new AppleSearchCollector(), googlePlay: new GooglePlayCollector() },
    loadDiscoverySeeds(),
    loadEnabledCountries(),
    { source, country },
  );

  const { store, close } = await openStore(dryRun);
  const results: DiscoveryJobResult[] = [];
  try {
    for (const job of jobs) {
      const result = await runDiscoveryJob(job, store);
      results.push(result);
      console.info(JSON.stringify({ event: "discovery.job", dryRun, ...result }));
    }
  } finally {
    await close();
  }

  return results.some((result) => result.errorCount > 0) ? 1 : 0;
}

async function openStore(
  dryRun: boolean,
): Promise<{ store: DiscoveryStore; close: () => Promise<void> }> {
  if (dryRun) {
    return { store: createDryRunDiscoveryStore(), close: async () => undefined };
  }

  loadEnv({ path: resolve(getRepositoryRoot(), ".env.local"), quiet: true });
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error(
      "Set DATABASE_URL in the repository root .env.local, or pass --dry-run.",
    );
  }

  const { db, client } = createDatabaseConnection(connectionString);
  return {
    store: createDatabaseDiscoveryStore(db),
    close: () => client.end(),
  };
}
