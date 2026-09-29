import type {
  AppleSearchCollector,
  GooglePlayCollector,
} from "@analytic-dashboard/collectors";
import type {
  CollectorRunFinalStatus,
  CollectorRunSource,
} from "@analytic-dashboard/db";
import { storeListingKey } from "@analytic-dashboard/db";
import type { CountryCode } from "@analytic-dashboard/shared";

import type { DiscoverySeeds, EnabledCountries } from "../runtime/config.js";
import type {
  DiscoveredBatch,
  DiscoveryStore,
} from "../runtime/discovery-store.js";

export interface DiscoveryStep {
  label: string;
  collect: () => Promise<DiscoveredBatch>;
}

export interface DiscoveryJob {
  source: CollectorRunSource;
  jobType: string;
  country: CountryCode;
  locale: string;
  steps: DiscoveryStep[];
}

export interface DiscoveryJobResult {
  runId: string | null;
  source: CollectorRunSource;
  jobType: string;
  country: CountryCode;
  status: CollectorRunFinalStatus;
  discoveredCount: number;
  changedCount: number;
  chartEntriesWritten: number;
  errorCount: number;
  errorSample: string | null;
}

export interface DiscoveryFilter {
  source?: CollectorRunSource;
  country?: CountryCode;
}

export interface DiscoveryCollectors {
  apple: Pick<AppleSearchCollector, "searchGames">;
  googlePlay: Pick<GooglePlayCollector, "discoverTopGameEntries">;
}

export const APPLE_SEARCH_JOB = "discovery.search";
export const GOOGLE_CHART_JOB = "discovery.chart";
const GOOGLE_CHART_CATEGORY = "GAME";
const ERROR_SAMPLE_MAX_LENGTH = 300;

export function buildDiscoveryJobs(
  collectors: DiscoveryCollectors,
  seeds: DiscoverySeeds,
  countries: EnabledCountries,
  filter: DiscoveryFilter = {},
): DiscoveryJob[] {
  const jobs: DiscoveryJob[] = [];

  for (const [country, { locale }] of Object.entries(countries.countries) as Array<
    [CountryCode, { locale: string }]
  >) {
    if (filter.country && filter.country !== country) continue;

    if (!filter.source || filter.source === "app_store") {
      jobs.push({
        source: "app_store",
        jobType: APPLE_SEARCH_JOB,
        country,
        locale,
        steps: seeds.appleSearchTerms.map((term) => ({
          label: `search:${term}`,
          collect: async () => ({
            apps: await collectors.apple.searchGames({
              term,
              country,
              locale,
              limit: seeds.limit,
            }),
          }),
        })),
      });
    }

    if (!filter.source || filter.source === "google_play") {
      jobs.push({
        source: "google_play",
        jobType: GOOGLE_CHART_JOB,
        country,
        locale,
        steps: seeds.googleCharts.map((collection) => ({
          label: `chart:${collection}`,
          collect: async () => {
            const entries = await collectors.googlePlay.discoverTopGameEntries({
              country,
              locale,
              collection,
              limit: seeds.limit,
            });
            return {
              apps: entries.map((entry) => entry.app),
              chart: {
                chartType: collection,
                category: GOOGLE_CHART_CATEGORY,
                entries,
              },
            };
          },
        })),
      });
    }
  }

  return jobs;
}

export async function runDiscoveryJob(
  job: DiscoveryJob,
  store: DiscoveryStore,
  now: () => Date = () => new Date(),
): Promise<DiscoveryJobResult> {
  const runId = await store.startRun({
    source: job.source,
    jobType: job.jobType,
    country: job.country,
    locale: job.locale,
    startedAt: now(),
    metadata: { steps: job.steps.map((step) => step.label) },
  });

  const discovered = new Set<string>();
  let changedCount = 0;
  let chartEntriesWritten = 0;
  const errors: string[] = [];

  for (const step of job.steps) {
    try {
      const batch = await step.collect();
      const summary = await store.persistBatch(batch, job.country);
      for (const app of batch.apps) {
        discovered.add(storeListingKey(app));
      }
      changedCount += summary.changed;
      chartEntriesWritten += summary.chartEntriesWritten;
    } catch (error) {
      errors.push(`${step.label}: ${describeError(error)}`);
    }
  }

  const status = resolveStatus(job.steps.length, errors.length, discovered.size);
  const errorSample = resolveErrorSample(errors, discovered.size, errors.length);

  await store.finishRun(runId, {
    status,
    finishedAt: now(),
    discoveredCount: discovered.size,
    changedCount,
    retryCount: 0,
    errorCount: errors.length,
    errorSample,
    metadata: {
      steps: job.steps.map((step) => step.label),
      chartEntriesWritten,
      zeroResults: discovered.size === 0,
    },
  });

  return {
    runId,
    source: job.source,
    jobType: job.jobType,
    country: job.country,
    status,
    discoveredCount: discovered.size,
    changedCount,
    chartEntriesWritten,
    errorCount: errors.length,
    errorSample,
  };
}

/** A run that found nothing is `partial`, not `succeeded`, so an empty source stays visible. */
function resolveStatus(
  stepCount: number,
  errorCount: number,
  discoveredCount: number,
): CollectorRunFinalStatus {
  if (errorCount >= stepCount) return "failed";
  if (errorCount > 0 || discoveredCount === 0) return "partial";
  return "succeeded";
}

function resolveErrorSample(
  errors: string[],
  discoveredCount: number,
  errorCount: number,
): string | null {
  if (errorCount > 0) {
    return errors.join("; ").slice(0, ERROR_SAMPLE_MAX_LENGTH);
  }
  return discoveredCount === 0 ? "Discovery returned no games" : null;
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
}
