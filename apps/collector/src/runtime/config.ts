import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { countryCodeSchema, localeSchema } from "@analytic-dashboard/shared";
import { z } from "zod";

export const enabledCountriesSchema = z.object({
  version: z.number().int().positive(),
  countries: z.record(countryCodeSchema, z.object({ locale: localeSchema })),
});

export const discoverySeedsSchema = z.object({
  version: z.string().min(1),
  limit: z.number().int().min(1).max(25),
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

export function loadDiscoverySeeds(): DiscoverySeeds {
  return discoverySeedsSchema.parse(
    readJson("config/discovery-seeds/mvp-v1.json"),
  );
}
