import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  buildResearchBriefPrompt,
  buildResearchBriefSystemInstruction,
  createGeminiClient,
  GeminiProvider,
  parseResearchBriefResponse,
  researchBriefJsonSchema,
} from "@analytic-dashboard/classifier";
import {
  createDatabaseConnection,
  loadLatestStudioProfile,
  loadResearchBriefCandidates,
  loadResearchBriefInputHashes,
  recordResearchBrief,
} from "@analytic-dashboard/db";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { planResearchBriefs, runResearchBriefs, type ResearchBriefStore } from "../jobs/research-brief.js";
import { getRepositoryRoot } from "../runtime/config.js";

const optionsSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(10) });

/** Generates bounded, cited briefs for scored opportunities. Dashboard requests never call AI. */
export async function runResearchBriefCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      plan: { type: "boolean", default: false },
      limit: { type: "string" },
    },
  });
  const dryRun = values["dry-run"] === true;
  const planOnly = values.plan === true;
  const options = optionsSchema.parse({ limit: values.limit });
  loadEnv({ path: resolve(getRepositoryRoot(), ".env.local"), quiet: true });

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL in the repository root .env.local.");
  const { db, client } = createDatabaseConnection(connectionString);
  const store: ResearchBriefStore = {
    loadCandidates: (limit) => loadResearchBriefCandidates(db, limit),
    loadProfile: () => loadLatestStudioProfile(db),
    loadExistingHashes: (promptVersion, opportunityIds) => loadResearchBriefInputHashes(db, promptVersion, opportunityIds),
    record: dryRun ? async () => true : (input) => recordResearchBrief(db, input),
  };

  try {
    if (planOnly) {
      const plan = await planResearchBriefs(store, { limit: options.limit });
      console.info(JSON.stringify({
        event: "research.brief.plan",
        candidates: plan.candidates,
        pending: plan.pending.length,
        skippedInvalid: plan.skippedInvalid,
        skippedExisting: plan.skippedExisting,
      }));
      return 0;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.info(JSON.stringify({ event: "research.brief", skipped: "GEMINI_API_KEY is not set" }));
      return 0;
    }
    const provider = new GeminiProvider({
      client: createGeminiClient(apiKey),
      onEvent: (event) => console.info(JSON.stringify({ event: "research.brief.request", ...event })),
    });
    const summary = await runResearchBriefs(
      {
        generate: async (input) => {
          const generated = await provider.generateStructured(
            {
              systemInstruction: buildResearchBriefSystemInstruction(),
              prompt: buildResearchBriefPrompt(input),
              schema: researchBriefJsonSchema(input),
            },
            (raw) => parseResearchBriefResponse(raw, input),
          );
          return { model: generated.model, brief: generated.value, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens };
        },
      },
      store,
      { limit: options.limit },
    );
    console.info(JSON.stringify({ event: "research.brief", dryRun, providerEvents: provider.events, ...summary }));
    return summary.errorCount > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
}
