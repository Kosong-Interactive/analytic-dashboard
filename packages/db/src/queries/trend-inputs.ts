import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import {
  appSnapshots,
  chartEntries,
  storeApps,
} from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

// Dates inside raw sql fragments are passed as ISO strings with an explicit cast; the driver rejects Date objects there.
const DAY_MS = 86_400_000;

export interface TrendInputsQuery {
  store: "app_store" | "google_play";
  country: string;
  asOf: Date;
  /** Analysis window; history is loaded for twice this so a baseline reading exists. */
  windowDays: number;
  /** Restrict rank observations to one chart, e.g. `TOP_FREE`. */
  chartType?: string;
}

export interface TrendSnapshotReading {
  capturedAt: Date;
  rating: number | null;
  ratingCount: number | null;
  reviewCount: number | null;
  minInstalls: number | null;
  maxInstalls: number | null;
}

export interface TrendRankReading {
  chartType: string;
  capturedAt: Date;
  rank: number;
}

/** Everything the analytics package needs about one store listing, with provenance kept. */
export interface TrendCandidateRow {
  storeAppId: string;
  appId: string;
  store: "app_store" | "google_play";
  externalId: string;
  country: string;
  locale: string;
  title: string;
  iconUrl: string | null;
  storeUrl: string;
  storeCategory: string | null;
  releaseDate: Date | null;
  /** First observed by this system, not the store release date. */
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Oldest first. Snapshots are stored on change, so gaps mean "unchanged", not "missing". */
  snapshots: TrendSnapshotReading[];
  /** Oldest first. */
  ranks: TrendRankReading[];
  /** Storefronts in which this same store listing was first observed, now vs. one window ago. */
  countryBreadth: { current: number; previous: number };
}

/**
 * Loads observation history for every listing of one store and country in a constant
 * number of queries (no per-game lookups).
 */
export async function loadTrendCandidates(
  db: DatabaseExecutor,
  query: TrendInputsQuery,
): Promise<TrendCandidateRow[]> {
  const historyStart = new Date(query.asOf.getTime() - 2 * query.windowDays * DAY_MS);
  const windowStart = new Date(query.asOf.getTime() - query.windowDays * DAY_MS);

  const listings = await db
    .select()
    .from(storeApps)
    .where(
      and(
        eq(storeApps.store, query.store),
        eq(storeApps.country, query.country),
        lte(storeApps.firstSeenAt, query.asOf),
      ),
    )
    .orderBy(asc(storeApps.id));
  if (listings.length === 0) return [];

  const ids = listings.map((listing) => listing.id);

  const [inWindow, baseline, ranks, breadth] = await Promise.all([
    db
      .select()
      .from(appSnapshots)
      .where(
        and(
          inArray(appSnapshots.storeAppId, ids),
          gte(appSnapshots.capturedAt, historyStart),
          lte(appSnapshots.capturedAt, query.asOf),
        ),
      )
      .orderBy(asc(appSnapshots.capturedAt)),
    // Change-only storage means the reading in force at the window start may be older than the window.
    db
      .selectDistinctOn([appSnapshots.storeAppId])
      .from(appSnapshots)
      .where(
        and(
          inArray(appSnapshots.storeAppId, ids),
          sql`${appSnapshots.capturedAt} < ${historyStart.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(appSnapshots.storeAppId, desc(appSnapshots.capturedAt)),
    db
      .select()
      .from(chartEntries)
      .where(
        and(
          inArray(chartEntries.storeAppId, ids),
          gte(chartEntries.capturedAt, historyStart),
          lte(chartEntries.capturedAt, query.asOf),
          query.chartType ? eq(chartEntries.chartType, query.chartType) : undefined,
        ),
      )
      .orderBy(asc(chartEntries.capturedAt)),
    db
      .select({
        externalId: storeApps.externalId,
        current: sql<number>`count(distinct ${storeApps.country}) filter (where ${storeApps.firstSeenAt} <= ${query.asOf.toISOString()}::timestamptz)`.mapWith(
          Number,
        ),
        previous: sql<number>`count(distinct ${storeApps.country}) filter (where ${storeApps.firstSeenAt} <= ${windowStart.toISOString()}::timestamptz)`.mapWith(
          Number,
        ),
      })
      .from(storeApps)
      .where(
        and(
          eq(storeApps.store, query.store),
          inArray(
            storeApps.externalId,
            listings.map((listing) => listing.externalId),
          ),
        ),
      )
      .groupBy(storeApps.externalId),
  ]);

  const snapshotsById = groupById([...baseline, ...inWindow], (row) => row.storeAppId);
  const ranksById = groupById(ranks, (row) => row.storeAppId);
  const breadthByExternalId = new Map(breadth.map((row) => [row.externalId, row]));

  return listings.map((listing) => ({
    storeAppId: listing.id,
    appId: listing.appId,
    store: listing.store,
    externalId: listing.externalId,
    country: listing.country,
    locale: listing.locale,
    title: listing.title,
    iconUrl: listing.iconUrl,
    storeUrl: listing.storeUrl,
    storeCategory: listing.storeCategory,
    releaseDate: listing.releaseDate,
    firstSeenAt: listing.firstSeenAt,
    lastSeenAt: listing.lastSeenAt,
    snapshots: (snapshotsById.get(listing.id) ?? [])
      .map((row) => ({
        capturedAt: row.capturedAt,
        rating: row.rating === null ? null : Number(row.rating),
        ratingCount: row.ratingCount,
        reviewCount: row.reviewCount,
        minInstalls: row.minInstalls,
        maxInstalls: row.maxInstalls,
      }))
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()),
    ranks: (ranksById.get(listing.id) ?? []).map((row) => ({
      chartType: row.chartType,
      capturedAt: row.capturedAt,
      rank: row.rank,
    })),
    countryBreadth: {
      current: breadthByExternalId.get(listing.externalId)?.current ?? 1,
      previous: breadthByExternalId.get(listing.externalId)?.previous ?? 0,
    },
  }));
}

function groupById<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(key(row));
    if (bucket) bucket.push(row);
    else grouped.set(key(row), [row]);
  }
  return grouped;
}
