import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NormalizedStoreApp } from "@analytic-dashboard/collectors";

import { createCollectionTally } from "../runtime/collection-tally.js";
import type { DiscoverySeeds, EnabledCountries } from "../runtime/config.js";
import type {
  DiscoveredBatch,
  DiscoveryStore,
} from "../runtime/discovery-store.js";
import {
  buildDiscoveryJobs,
  runDiscoveryJob,
  type DiscoveryCollectors,
  type DiscoveryJob,
} from "./discovery.js";

const seeds: DiscoverySeeds = {
  version: "test",
  appleLimit: 5,
  googleLimit: 5,
  appleSearchTerms: ["puzzle", "idle"],
  googleCharts: ["TOP_FREE"],
};
const countries: EnabledCountries = {
  version: 1,
  countries: { id: { locale: "id_ID" }, us: { locale: "en_US" } },
};
const now = () => new Date("2026-09-29T10:00:00.000Z");

function app(externalId: string): NormalizedStoreApp {
  return {
    store: "google_play",
    externalId,
    country: "us",
    locale: "en_US",
    title: externalId,
    description: null,
    developerName: null,
    developerExternalId: null,
    storeCategory: null,
    releaseDate: null,
    currentVersion: null,
    iconUrl: null,
    storeUrl: `https://play.google.com/store/apps/details?id=${externalId}`,
    metadataHash: "a".repeat(64),
    rawMetadata: {},
    snapshot: {
      capturedAt: "2026-09-29T10:00:00.000Z",
      rating: null,
      ratingCount: null,
      reviewCount: null,
      minInstalls: null,
      maxInstalls: null,
      price: null,
      currency: null,
      version: null,
    },
  };
}

function recordingStore(failPersist = false) {
  const finished: Array<Parameters<DiscoveryStore["finishRun"]>[1]> = [];
  const batches: DiscoveredBatch[] = [];
  const store: DiscoveryStore = {
    startRun: async () => "run-1",
    persistBatch: async (batch) => {
      if (failPersist) throw new Error("database unavailable");
      batches.push(batch);
      return {
        processed: batch.apps.length,
        changed: batch.apps.length,
        chartEntriesWritten: batch.chart?.entries.length ?? 0,
      };
    },
    finishRun: async (_runId, input) => {
      finished.push(input);
    },
  };
  return { store, finished, batches };
}

function jobWithSteps(
  steps: Array<() => Promise<DiscoveredBatch>>,
): DiscoveryJob {
  return {
    source: "google_play",
    jobType: "discovery.chart",
    country: "us",
    locale: "en_US",
    seedVersion: "test",
    steps: steps.map((collect, index) => ({ label: `step-${index}`, collect })),
  };
}

describe("buildDiscoveryJobs", () => {
  const collectors: DiscoveryCollectors = {
    apple: { searchGames: async () => [] },
    googlePlay: { discoverTopGameEntries: async () => [] },
  };

  it("plans one Apple and one Google job per enabled country", () => {
    const jobs = buildDiscoveryJobs(collectors, seeds, countries);

    assert.deepEqual(
      jobs.map((job) => `${job.source}:${job.country}`),
      ["app_store:id", "google_play:id", "app_store:us", "google_play:us"],
    );
  });

  it("uses the per-store limits from the seed file", async () => {
    const requested: number[] = [];
    const jobs = buildDiscoveryJobs(
      {
        apple: {
          searchGames: async (input) => {
            requested.push(input.limit ?? -1);
            return [];
          },
        },
        googlePlay: {
          discoverTopGameEntries: async (input) => {
            requested.push(input.limit ?? -1);
            return [];
          },
        },
      },
      { ...seeds, appleLimit: 50, googleLimit: 25, appleSearchTerms: ["puzzle"] },
      countries,
      { country: "us" },
    );

    for (const job of jobs) await job.steps[0]?.collect();

    assert.deepEqual(requested, [50, 25]);
    assert.equal(jobs[0]?.seedVersion, "test");
  });

  it("filters by source and country", () => {
    const jobs = buildDiscoveryJobs(collectors, seeds, countries, {
      source: "google_play",
      country: "us",
    });

    assert.deepEqual(
      jobs.map((job) => `${job.source}:${job.country}`),
      ["google_play:us"],
    );
  });

  it("keeps chart ranks on the Google batch", async () => {
    const jobs = buildDiscoveryJobs(
      {
        ...collectors,
        googlePlay: {
          discoverTopGameEntries: async () => [
            { rank: 1, app: app("a") },
            { rank: 3, app: app("c") },
          ],
        },
      },
      seeds,
      countries,
      { source: "google_play", country: "us" },
    );

    const batch = await jobs[0]?.steps[0]?.collect();

    assert.equal(batch?.chart?.chartType, "TOP_FREE");
    assert.deepEqual(
      batch?.chart?.entries.map((entry) => entry.rank),
      [1, 3],
    );
  });
});

describe("runDiscoveryJob", () => {
  it("records a succeeded run with distinct discovered apps", async () => {
    const { store, finished } = recordingStore();
    const job = jobWithSteps([
      async () => ({ apps: [app("a"), app("b")] }),
      async () => ({ apps: [app("b"), app("c")] }),
    ]);

    const result = await runDiscoveryJob(job, store, now);

    assert.equal(result.status, "succeeded");
    assert.equal(result.discoveredCount, 3);
    assert.equal(finished[0]?.errorSample, null);
  });

  it("keeps partial results when one step fails", async () => {
    const { store, batches } = recordingStore();
    const job = jobWithSteps([
      async () => {
        throw new Error("Google Play request failed");
      },
      async () => ({ apps: [app("a")] }),
    ]);

    const result = await runDiscoveryJob(job, store, now);

    assert.equal(result.status, "partial");
    assert.equal(result.errorCount, 1);
    assert.equal(batches.length, 1);
    assert.match(result.errorSample ?? "", /Google Play request failed/);
  });

  it("fails the run when every step fails", async () => {
    const { store } = recordingStore();
    const job = jobWithSteps([
      async () => {
        throw new Error("blocked");
      },
    ]);

    assert.equal((await runDiscoveryJob(job, store, now)).status, "failed");
  });

  it("marks an empty result partial instead of succeeded", async () => {
    const { store, finished } = recordingStore();
    const result = await runDiscoveryJob(
      jobWithSteps([async () => ({ apps: [] })]),
      store,
      now,
    );

    assert.equal(result.status, "partial");
    assert.equal(finished[0]?.errorSample, "Discovery returned no games");
    assert.equal(finished[0]?.metadata?.zeroResults, true);
  });

  it("records skipped items and retries from the tally", async () => {
    const { store, finished } = recordingStore();
    const tally = createCollectionTally();
    tally.events.onSkipped?.("invalid");
    tally.events.onSkipped?.("non_game");
    tally.events.onRetry?.();
    const job = jobWithSteps([
      async () => {
        tally.events.onSkipped?.("invalid");
        tally.events.onSkipped?.("non_game");
        tally.events.onSkipped?.("non_game");
        tally.events.onRetry?.();
        return { apps: [app("a")] };
      },
    ]);

    await runDiscoveryJob(job, store, now, tally);

    assert.equal(finished[0]?.retryCount, 1);
    assert.equal(finished[0]?.metadata?.invalidSkipped, 1);
    assert.equal(finished[0]?.metadata?.nonGameSkipped, 2);
    assert.equal(finished[0]?.metadata?.seedVersion, "test");
  });

  it("records a persistence failure as a run error", async () => {
    const { store } = recordingStore(true);
    const result = await runDiscoveryJob(
      jobWithSteps([async () => ({ apps: [app("a")] })]),
      store,
      now,
    );

    assert.equal(result.status, "failed");
    assert.equal(result.discoveredCount, 0);
  });
});
