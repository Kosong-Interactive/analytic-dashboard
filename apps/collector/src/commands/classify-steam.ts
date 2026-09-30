import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { parseTaxonomy } from "@analytic-dashboard/classifier";
import {
  createDatabaseConnection,
  loadSteamClassificationInputs,
  loadSteamInputHashes,
  replaceSteamAutomatedLabels,
  syncTaxonomyLabels,
} from "@analytic-dashboard/db";
import { config as loadEnv } from "dotenv";

import { runSteamRuleClassification, type SteamClassificationStore } from "../jobs/steam-classification.js";
import { getRepositoryRoot } from "../runtime/config.js";
import { traceStep } from "../runtime/trace-step.js";
import { ACTIVE_TAXONOMY } from "./classify.js";

/**
 * Deterministic rule classification for every tracked Steam game. `--dry-run` computes labels
 * without writing. Exit code is non-zero when any game failed to be written.
 */
export async function runClassifySteamCommand(argv: string[]): Promise<number> {
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

  const store: SteamClassificationStore = {
    syncTaxonomy: dryRun
      ? async (_version, labels) => new Map(labels.map((l) => [`${l.type}:${l.slug}`, `${l.type}:${l.slug}`]))
      : traceStep("classification.steam.step", "syncTaxonomy", (taxonomyVersion, labels) => syncTaxonomyLabels(db, { taxonomyVersion, labels })),
    loadInputs: traceStep("classification.steam.step", "loadInputs", () => loadSteamClassificationInputs(db)),
    loadRuleInputHashes: traceStep("classification.steam.step", "loadInputHashes", (version: string) => loadSteamInputHashes(db, "rule", version)),
    replaceRuleLabels: dryRun
      ? async (input) => ({ written: input.labels.length, removed: 0 })
      : (input) =>
          replaceSteamAutomatedLabels(db, {
            source: "rule",
            steamAppId: input.steamAppId,
            taxonomyVersion: input.taxonomyVersion,
            classifierVersion: input.rulesVersion,
            model: null,
            inputHash: input.inputHash,
            labels: input.labels,
          }),
  };

  try {
    const summary = await runSteamRuleClassification(taxonomy, store);
    console.info(JSON.stringify({ event: "classification.steam.rules", dryRun, ...summary }));
    return summary.errorCount > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
}
