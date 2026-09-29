import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { parseTaxonomy } from "@analytic-dashboard/classifier";
import {
  createDatabaseConnection,
  loadLabelMembership,
  loadSourceHealth,
  loadTrendCandidates,
  recordFailedResearchRun,
  recordResearchRun,
} from "@analytic-dashboard/db";
import { countryCodeSchema, MIN_LABEL_CONFIDENCE, storeValues, supportedCountryCodes } from "@analytic-dashboard/shared";
import { config as loadEnv } from "dotenv";

import { runResearch, type ResearchStore } from "../jobs/research.js";
import { getRepositoryRoot } from "../runtime/config.js";
import { ACTIVE_TAXONOMY } from "./classify.js";

/** Label types the opportunity cohorts are built from (opportunity_score_v1). */
const RESEARCH_LABEL_TYPES = ["genre", "subgenre", "core_mechanic", "theme"] as const;

/**
 * Research is calculated as of the start of the current UTC hour, so a rerun within the hour sees
 * identical inputs (history length, recency windows) and is skipped by the input hash.
 */
export function researchAsOf(now: Date): Date {
  const asOf = new Date(now);
  asOf.setUTCMinutes(0, 0, 0);
  return asOf;
}

/**
 * Deterministic opportunity research over stored observations and labels. `--dry-run` computes
 * and prints without writing. Exit code is non-zero when any storefront failed.
 */
export async function runResearchCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      country: { type: "string" },
    },
  });
  const dryRun = values["dry-run"] === true;
  const countries = values.country ? [countryCodeSchema.parse(values.country)] : [...supportedCountryCodes];
  const root = getRepositoryRoot();
  const taxonomy = parseTaxonomy(JSON.parse(readFileSync(resolve(root, ACTIVE_TAXONOMY), "utf8")));

  loadEnv({ path: resolve(root, ".env.local"), quiet: true });
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL in the repository root .env.local.");
  const { db, client } = createDatabaseConnection(connectionString);

  const store: ResearchStore = {
    loadCandidates: (storeId, country, asOf) =>
      loadTrendCandidates(db, { store: storeId, country, asOf, windowDays: 7, chartType: "TOP_FREE" }),
    loadMembership: (storeId, country) =>
      loadLabelMembership(db, {
        stores: [storeId],
        country,
        taxonomyVersion: taxonomy.version,
        types: [...RESEARCH_LABEL_TYPES],
        minConfidence: MIN_LABEL_CONFIDENCE,
      }),
    loadHealth: (country) => loadSourceHealth(db, [country]),
    record: dryRun ? async () => ({ created: false }) : (input) => recordResearchRun(db, input),
    recordFailure: dryRun ? async () => undefined : (input) => recordFailedResearchRun(db, input),
  };

  try {
    const summary = await runResearch(store, {
      countries,
      stores: storeValues,
      taxonomyVersion: taxonomy.version,
      asOf: researchAsOf(new Date()),
    });
    console.info(JSON.stringify({ event: "research", dryRun, ...summary }));
    return summary.errorCount > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
}
