import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { createGeminiClient, GeminiProvider, parseTaxonomy } from "@analytic-dashboard/classifier";
import {
  createDatabaseConnection,
  loadSteamClassificationInputs,
  loadSteamInputHashes,
  replaceSteamAutomatedLabels,
  syncTaxonomyLabels,
} from "@analytic-dashboard/db";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { runAiClassification } from "../jobs/ai-classification.js";
import { toAiClassificationStore, type SteamAiBackend } from "../jobs/steam-classification.js";
import { getRepositoryRoot } from "../runtime/config.js";
import { traceStep } from "../runtime/trace-step.js";
import { ACTIVE_TAXONOMY } from "./classify.js";

const optionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(5_000).default(200),
  batchSize: z.coerce.number().int().min(1).max(20).default(8),
});

/**
 * AI labels via Gemini for Steam games whose input changed. Skips (exit 0) without GEMINI_API_KEY.
 * `--dry-run` calls the model but writes nothing, not even the taxonomy sync. Only public Steam
 * store text (title, genres, tags, description) is sent.
 */
export async function runClassifySteamAiCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
      "batch-size": { type: "string" },
    },
  });
  const dryRun = values["dry-run"] === true;
  const options = optionsSchema.parse({ limit: values.limit, batchSize: values["batch-size"] });
  const root = getRepositoryRoot();
  loadEnv({ path: resolve(root, ".env.local"), quiet: true });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.info(JSON.stringify({ event: "classification.steam.ai", skipped: "GEMINI_API_KEY is not set" }));
    return 0;
  }
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL in the repository root .env.local.");

  const taxonomy = parseTaxonomy(JSON.parse(readFileSync(resolve(root, ACTIVE_TAXONOMY), "utf8")));
  const provider = new GeminiProvider({
    client: createGeminiClient(apiKey),
    onEvent: (event) => console.info(JSON.stringify({ event: "classification.steam.ai.request", ...event })),
  });
  const { db, client } = createDatabaseConnection(connectionString);

  const backend: SteamAiBackend = {
    syncTaxonomy: dryRun
      ? async (_version, labels) => new Map(labels.map((l) => [`${l.type}:${l.slug}`, `${l.type}:${l.slug}`]))
      : traceStep("classification.steam.ai.step", "syncTaxonomy", (taxonomyVersion, labels) => syncTaxonomyLabels(db, { taxonomyVersion, labels })),
    loadInputs: traceStep("classification.steam.ai.step", "loadInputs", () => loadSteamClassificationInputs(db)),
    loadAiInputHashes: traceStep("classification.steam.ai.step", "loadInputHashes", (version: string) => loadSteamInputHashes(db, "ai", version)),
    replaceAiLabels: dryRun
      ? async (input) => ({ written: input.labels.length, removed: 0 })
      : (input) =>
          replaceSteamAutomatedLabels(db, {
            source: "ai",
            steamAppId: input.steamAppId,
            taxonomyVersion: input.taxonomyVersion,
            classifierVersion: input.promptVersion,
            model: input.model,
            inputHash: input.inputHash,
            labels: input.labels,
          }),
  };

  try {
    const models = await provider.availableModels();
    const summary = await runAiClassification(taxonomy, provider, toAiClassificationStore(backend), {
      maxApps: options.limit,
      batchSize: options.batchSize,
    });
    console.info(JSON.stringify({ event: "classification.steam.ai", dryRun, models, providerEvents: provider.events, ...summary }));
    return summary.errorCount > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
}
