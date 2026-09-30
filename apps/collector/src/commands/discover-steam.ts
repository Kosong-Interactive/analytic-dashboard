import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { SteamCollector } from "@analytic-dashboard/collectors";
import {
  createDatabaseConnection,
  finishSteamCollectorRun,
  persistSteamApps,
  persistSteamChartEntries,
  persistSteamPrices,
  persistSteamSnapshots,
  startSteamCollectorRun,
} from "@analytic-dashboard/db";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { runSteamDiscovery, type SteamDiscoveryStore } from "../jobs/steam-discovery.js";
import { getRepositoryRoot } from "../runtime/config.js";

const optionsSchema = z.object({
  maxGames: z.coerce.number().int().min(1).max(200).default(200),
  topSellers: z.coerce.number().int().min(1).max(100).default(100),
});

/**
 * Sampled Steam Global collection from the most-played and top-seller charts. Skips (exit 0)
 * without STEAM_WEB_API_KEY. `--dry-run` calls Steam but writes nothing. Exit code is non-zero
 * when the run hit any error.
 */
export async function runDiscoverSteamCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      "max-games": { type: "string" },
      "top-sellers": { type: "string" },
    },
  });
  const dryRun = values["dry-run"] === true;
  const options = optionsSchema.parse({ maxGames: values["max-games"], topSellers: values["top-sellers"] });
  loadEnv({ path: resolve(getRepositoryRoot(), ".env.local"), quiet: true });

  const apiKey = process.env.STEAM_WEB_API_KEY;
  if (!apiKey) {
    console.info(JSON.stringify({ event: "steam.discovery", skipped: "STEAM_WEB_API_KEY is not set" }));
    return 0;
  }

  let retries = 0;
  const steam = new SteamCollector({ apiKey, events: { onRetry: () => (retries += 1) } });
  const { store, close } = await openStore(dryRun);
  try {
    const result = await runSteamDiscovery(
      steam,
      store,
      { topSellersLimit: options.topSellers, priceCountries: ["us", "id"], maxGames: options.maxGames },
      () => new Date(),
      () => retries,
    );
    console.info(JSON.stringify({ event: "steam.discovery", dryRun, ...result }));
    return result.errorCount > 0 ? 1 : 0;
  } finally {
    await close();
  }
}

async function openStore(dryRun: boolean): Promise<{ store: SteamDiscoveryStore; close: () => Promise<void> }> {
  if (dryRun) {
    return {
      store: {
        startRun: async () => null,
        persistApps: async (listings) => ({
          ids: new Map(listings.map((listing) => [listing.externalId, `dry-${listing.externalId}`])),
          created: 0,
          metadataChanged: 0,
        }),
        persistCharts: async () => 0,
        persistSnapshots: async () => ({ written: 0 }),
        persistPrices: async () => ({ written: 0 }),
        finishRun: async () => undefined,
      },
      close: async () => undefined,
    };
  }

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL in the repository root .env.local, or pass --dry-run.");
  const { db, client } = createDatabaseConnection(connectionString);
  return {
    store: {
      startRun: (input) => startSteamCollectorRun(db, input),
      persistApps: (listings) => persistSteamApps(db, listings),
      persistCharts: (entries) => persistSteamChartEntries(db, entries),
      persistSnapshots: (inputs) => persistSteamSnapshots(db, inputs),
      persistPrices: (prices) => persistSteamPrices(db, prices),
      finishRun: async (runId, input) => {
        if (runId) await finishSteamCollectorRun(db, runId, input);
      },
    },
    close: () => client.end(),
  };
}
