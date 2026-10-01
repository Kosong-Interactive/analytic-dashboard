import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { parseTaxonomy } from "@analytic-dashboard/classifier";
import {
  createDatabaseConnection,
  loadClassificationInputs,
  loadRuleInputHashes,
  replaceRuleLabels,
  syncTaxonomyLabels,
} from "@analytic-dashboard/db";
import { config as loadEnv } from "dotenv";

import { runRuleClassification, type ClassificationStore } from "../jobs/classification.js";
import { getRepositoryRoot } from "../runtime/config.js";
import { traceStep } from "../runtime/trace-step.js";

/** Taxonomy files are versioned; older ones stay so earlier labels remain explainable. */
export const ACTIVE_TAXONOMY = "config/taxonomy/v1.json";
export const ACTIVE_STEAM_TAXONOMY = "config/taxonomy/v2.json";

/**
 * Deterministic rule classification for every tracked app. `--dry-run` computes labels
 * without writing. Exit code is non-zero when any app failed to be written.
 */
export async function runClassifyCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { "dry-run": { type: "boolean", default: false } },
  });
  const dryRun = values["dry-run"] === true;
  const root = getRepositoryRoot();
  const taxonomy = parseTaxonomy(JSON.parse(readFileSync(resolve(root, ACTIVE_TAXONOMY), "utf8")));

  loadEnv({ path: resolve(root, ".env.local"), quiet: true });
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL in the repository root .env.local.");
  }
  const { db, client } = createDatabaseConnection(connectionString);

  const store: ClassificationStore = {
    // A dry run still reads real inputs and hashes, but never writes.
    syncTaxonomy: dryRun
      ? async (_version, labels) => new Map(labels.map((l) => [`${l.type}:${l.slug}`, `${l.type}:${l.slug}`]))
      : traceStep("classification.rules.step", "syncTaxonomy", (taxonomyVersion, labels) => syncTaxonomyLabels(db, { taxonomyVersion, labels })),
    loadInputs: traceStep("classification.rules.step", "loadInputs", () => loadClassificationInputs(db)),
    loadRuleInputHashes: traceStep("classification.rules.step", "loadInputHashes", (version: string) => loadRuleInputHashes(db, version)),
    replaceRuleLabels: dryRun
      ? async (input) => ({ written: input.labels.length, removed: 0 })
      : (input) => replaceRuleLabels(db, input),
  };

  try {
    const summary = await runRuleClassification(taxonomy, store);
    console.info(JSON.stringify({ event: "classification.rules", dryRun, ...summary }));
    return summary.errorCount > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
}
