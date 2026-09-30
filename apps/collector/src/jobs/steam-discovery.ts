import type {
  SteamChartEntry,
  SteamListingsResult,
  SteamPriceCountry,
} from "@analytic-dashboard/collectors";
import type {
  CollectorRunFinalStatus,
  PersistableSteamListing,
  SteamChartEntryInput,
  SteamPriceInput,
  SteamSnapshotInput,
} from "@analytic-dashboard/db";
import type { SteamPlayerObservation, SteamReviewObservation } from "@analytic-dashboard/shared";

export const STEAM_DISCOVERY_JOB = "steam.discovery";
const ERROR_SAMPLE_MAX_LENGTH = 300;

/** The Steam adapter calls the job needs; `SteamCollector` satisfies it. */
export interface SteamSource {
  getMostPlayed(): Promise<SteamChartEntry[]>;
  getTopSellers(input: { limit?: number }): Promise<SteamChartEntry[]>;
  getListings(input: { externalIds: string[]; country: SteamPriceCountry }): Promise<SteamListingsResult>;
  getReviewSummary(externalId: string): Promise<SteamReviewObservation | null>;
  getCurrentPlayers(externalId: string): Promise<SteamPlayerObservation | null>;
}

/** Everything the job needs from storage, so it is testable without a database. */
export interface SteamDiscoveryStore {
  startRun(input: { jobType: string; startedAt: Date; metadata: Record<string, unknown> }): Promise<string | null>;
  persistApps(listings: PersistableSteamListing[]): Promise<{ ids: Map<string, string>; created: number; metadataChanged: number }>;
  persistCharts(entries: SteamChartEntryInput[]): Promise<number>;
  persistSnapshots(inputs: SteamSnapshotInput[]): Promise<{ written: number }>;
  persistPrices(prices: SteamPriceInput[]): Promise<{ written: number }>;
  finishRun(
    runId: string | null,
    input: {
      status: CollectorRunFinalStatus;
      finishedAt: Date;
      discoveredCount: number;
      changedCount: number;
      retryCount: number;
      errorCount: number;
      errorSample: string | null;
      metadata: Record<string, unknown>;
    },
  ): Promise<void>;
}

export interface SteamDiscoveryOptions {
  /** Top sellers to read; most played is always the full chart Steam returns (up to 100). */
  topSellersLimit: number;
  /** Countries whose regional price is recorded. The listing itself is Global. */
  priceCountries: readonly SteamPriceCountry[];
  /** Upper bound on games per run, applied to the combined chart list in rank order. */
  maxGames: number;
}

export interface SteamDiscoveryResult {
  runId: string | null;
  status: CollectorRunFinalStatus;
  chartGames: number;
  listings: number;
  missing: number;
  created: number;
  metadataChanged: number;
  chartEntriesWritten: number;
  snapshotsWritten: number;
  pricesWritten: number;
  errorCount: number;
  errorSample: string | null;
}

/**
 * One sampled Steam collection: the global most-played and top-seller charts, their listings,
 * regional prices, review totals, and current players. Rerunnable: listings upsert by App ID,
 * chart rows are unique per capture, and snapshots and prices are stored only on change.
 */
export async function runSteamDiscovery(
  source: SteamSource,
  store: SteamDiscoveryStore,
  options: SteamDiscoveryOptions,
  now: () => Date = () => new Date(),
  retries: () => number = () => 0,
): Promise<SteamDiscoveryResult> {
  const capturedAt = now();
  const runId = await store.startRun({
    jobType: STEAM_DISCOVERY_JOB,
    startedAt: capturedAt,
    metadata: { market: "global", priceCountries: options.priceCountries },
  });
  const errors: string[] = [];
  const fail = (step: string, error: unknown) =>
    errors.push(`${step}: ${error instanceof Error ? error.message : "Unknown error"}`);

  let charts: SteamChartEntry[] = [];
  for (const [label, load] of [
    ["most played", () => source.getMostPlayed()],
    ["top sellers", () => source.getTopSellers({ limit: options.topSellersLimit })],
  ] as const) {
    try {
      charts = charts.concat(await load());
    } catch (error) {
      fail(label, error);
    }
  }

  // Interleave by rank so a cap keeps the head of both charts rather than one whole chart.
  const ordered = [...charts].sort((a, b) => a.rank - b.rank);
  const externalIds = [...new Set(ordered.map((entry) => entry.externalId))].slice(0, options.maxGames);

  const listingsByCountry = new Map<SteamPriceCountry, SteamListingsResult>();
  if (externalIds.length > 0) {
    for (const country of options.priceCountries) {
      try {
        listingsByCountry.set(country, await source.getListings({ externalIds, country }));
      } catch (error) {
        fail(`listings ${country}`, error);
      }
    }
  }

  // Listing metadata is Global; the first country that returned it provides it.
  const listings = new Map<string, PersistableSteamListing>();
  for (const result of listingsByCountry.values()) {
    for (const listing of result.listings) if (!listings.has(listing.externalId)) listings.set(listing.externalId, listing);
  }
  const missing = externalIds.filter((id) => !listings.has(id));

  let created = 0;
  let metadataChanged = 0;
  let chartEntriesWritten = 0;
  let snapshotsWritten = 0;
  let pricesWritten = 0;
  let ids = new Map<string, string>();

  if (listings.size > 0) {
    try {
      const stored = await store.persistApps([...listings.values()]);
      ids = stored.ids;
      created = stored.created;
      metadataChanged = stored.metadataChanged;
    } catch (error) {
      fail("persist listings", error);
    }
  }

  if (ids.size > 0) {
    try {
      chartEntriesWritten = await store.persistCharts(
        charts.flatMap((entry) => {
          const steamAppId = ids.get(entry.externalId);
          return steamAppId && externalIds.includes(entry.externalId)
            ? [{ steamAppId, chart: entry.chart, rank: entry.rank, lastWeekRank: entry.lastWeekRank, capturedAt }]
            : [];
        }),
      );
    } catch (error) {
      fail("persist charts", error);
    }

    const prices: SteamPriceInput[] = [];
    for (const result of listingsByCountry.values()) {
      for (const [externalId, price] of result.prices) {
        const steamAppId = ids.get(externalId);
        if (!steamAppId) continue;
        prices.push({
          steamAppId,
          country: price.country,
          currency: price.currency,
          initialPrice: price.initialPrice,
          finalPrice: price.finalPrice,
          discountPercent: price.discountPercent,
          capturedAt,
        });
      }
    }
    try {
      pricesWritten = (await store.persistPrices(prices)).written;
    } catch (error) {
      fail("persist prices", error);
    }

    const snapshots: SteamSnapshotInput[] = [];
    for (const [externalId, steamAppId] of ids) {
      let reviews: SteamReviewObservation | null = null;
      let players: SteamPlayerObservation | null = null;
      try {
        reviews = await source.getReviewSummary(externalId);
      } catch (error) {
        fail(`reviews ${externalId}`, error);
      }
      try {
        players = await source.getCurrentPlayers(externalId);
      } catch (error) {
        fail(`players ${externalId}`, error);
      }
      snapshots.push({
        steamAppId,
        capturedAt,
        reviews: reviews
          ? {
              capturedAt: reviews.capturedAt,
              purchaseScope: reviews.purchaseScope,
              languageScope: reviews.languageScope,
              offTopicActivityFiltered: reviews.offTopicActivityFiltered,
              positive: reviews.lifetime.positive,
              negative: reviews.lifetime.negative,
              total: reviews.lifetime.total,
            }
          : null,
        players: players ? { capturedAt: players.capturedAt, currentPlayers: players.currentPlayers } : null,
      });
    }
    try {
      snapshotsWritten = (await store.persistSnapshots(snapshots)).written;
    } catch (error) {
      fail("persist snapshots", error);
    }
  }

  const status = resolveStatus(externalIds.length, listings.size, errors.length);
  const errorSample = errors.length > 0 ? errors.join("; ").slice(0, ERROR_SAMPLE_MAX_LENGTH) : externalIds.length === 0 ? "Steam charts returned no games" : null;

  await store.finishRun(runId, {
    status,
    finishedAt: now(),
    discoveredCount: listings.size,
    changedCount: created + metadataChanged + snapshotsWritten + pricesWritten,
    retryCount: retries(),
    errorCount: errors.length,
    errorSample,
    metadata: {
      market: "global",
      chartGames: externalIds.length,
      missing: missing.length,
      chartEntriesWritten,
      snapshotsWritten,
      pricesWritten,
    },
  });

  return {
    runId,
    status,
    chartGames: externalIds.length,
    listings: listings.size,
    missing: missing.length,
    created,
    metadataChanged,
    chartEntriesWritten,
    snapshotsWritten,
    pricesWritten,
    errorCount: errors.length,
    errorSample,
  };
}

/** Nothing collected is a failure; errors or an empty chart make the run partial. */
function resolveStatus(chartGames: number, listings: number, errorCount: number): CollectorRunFinalStatus {
  if (listings === 0) return "failed";
  if (errorCount > 0 || chartGames === 0) return "partial";
  return "succeeded";
}
