import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { countryCodeSchema, localeSchema } from "@analytic-dashboard/shared";
import { z } from "zod";

export const enabledCountriesSchema = z.object({
  version: z.number().int().positive(),
  // Only the storefronts listed here are collected; the others stay supported but dormant.
  countries: z.partialRecord(countryCodeSchema, z.object({ locale: localeSchema })),
});

export const discoverySeedsSchema = z.object({
  version: z.string().min(1),
  /** Results per Apple search term; one request each, so a larger page is cheap. */
  appleLimit: z.number().int().min(1).max(200),
  /** Games per Apple chart; one feed request and one lookup request each, so it can be large. */
  appleChartLimit: z.number().int().min(1).max(200).default(100),
  /** Apple charts to collect; empty for seed files from before Apple charts existed. */
  appleCharts: z.array(z.enum(["TOP_FREE", "TOP_PAID", "GROSSING"])).default([]),
  /** Games per Google chart; each needs a throttled detail request, so it stays small. */
  googleLimit: z.number().int().min(1).max(25),
  appleSearchTerms: z.array(z.string().trim().min(1)).min(1),
  googleCharts: z
    .array(z.enum(["TOP_FREE", "TOP_PAID", "GROSSING"]))
    .min(1),
});

export type EnabledCountries = z.infer<typeof enabledCountriesSchema>;
export type DiscoverySeeds = z.infer<typeof discoverySeedsSchema>;

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

export function getRepositoryRoot(): string {
  return repositoryRoot;
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

export function loadEnabledCountries(): EnabledCountries {
  return enabledCountriesSchema.parse(readJson("config/countries/enabled.json"));
}

/** Seed files are versioned; older ones stay in the repository so past runs remain explainable. */
export const ACTIVE_DISCOVERY_SEEDS = "config/discovery-seeds/mvp-v3.json";

export function loadDiscoverySeeds(): DiscoverySeeds {
  return discoverySeedsSchema.parse(readJson(ACTIVE_DISCOVERY_SEEDS));
}
