import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";

import { appSnapshots, chartEntries, storeApps } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export interface GameHistoryQuery {
  storeAppId: string;
  /** Oldest observation to return; the reading in force at this time is included too. */
  since: Date;
}

export interface GameSnapshotRow {
  capturedAt: Date;
  rating: number | null;
  ratingCount: number | null;
  reviewCount: number | null;
  minInstalls: number | null;
  maxInstalls: number | null;
  price: number | null;
  currency: string | null;
  version: string | null;
}

export interface GameChartRow {
  chartType: string;
  category: string;
  capturedAt: Date;
  rank: number;
}

export interface GameSiblingListing {
  storeAppId: string;
  store: "app_store" | "google_play";
  country: string;
  title: string;
}

export interface GameHistory {
  listing: {
    storeAppId: string;
    appId: string;
    store: "app_store" | "google_play";
    externalId: string;
    country: string;
    locale: string;
    title: string;
    description: string | null;
    developerName: string | null;
    storeCategory: string | null;
    releaseDate: Date | null;
    currentVersion: string | null;
    iconUrl: string | null;
    storeUrl: string;
    firstSeenAt: Date;
    lastSeenAt: Date;
  };
  /** Oldest first. Stored on change only, so a gap means "unchanged", not "missing". */
  snapshots: GameSnapshotRow[];
  /** Oldest first. */
  ranks: GameChartRow[];
  /** Other storefront listings grouped under the same canonical app. */
  siblings: GameSiblingListing[];
}

/** Everything the game detail page shows, in a constant number of queries. */
export async function loadGameHistory(
  db: DatabaseExecutor,
  query: GameHistoryQuery,
): Promise<GameHistory | null> {
  const [listing] = await db
    .select()
    .from(storeApps)
    .where(eq(storeApps.id, query.storeAppId))
    .limit(1);
  if (!listing) return null;

  const [inRange, baseline, ranks, siblings] = await Promise.all([
    db
      .select()
      .from(appSnapshots)
      .where(
        and(
          eq(appSnapshots.storeAppId, listing.id),
          gte(appSnapshots.capturedAt, query.since),
        ),
      )
      .orderBy(asc(appSnapshots.capturedAt)),
    db
      .select()
      .from(appSnapshots)
      .where(
        and(
          eq(appSnapshots.storeAppId, listing.id),
          lt(appSnapshots.capturedAt, query.since),
        ),
      )
      .orderBy(desc(appSnapshots.capturedAt))
      .limit(1),
    db
      .select()
      .from(chartEntries)
      .where(
        and(
          eq(chartEntries.storeAppId, listing.id),
          gte(chartEntries.capturedAt, query.since),
        ),
      )
      .orderBy(asc(chartEntries.capturedAt)),
    db
      .select({
        storeAppId: storeApps.id,
        store: storeApps.store,
        country: storeApps.country,
        title: storeApps.title,
      })
      .from(storeApps)
      .where(and(eq(storeApps.appId, listing.appId), ne(storeApps.id, listing.id)))
      .orderBy(asc(storeApps.store), asc(storeApps.country)),
  ]);

  return {
    listing: {
      storeAppId: listing.id,
      appId: listing.appId,
      store: listing.store,
      externalId: listing.externalId,
      country: listing.country,
      locale: listing.locale,
      title: listing.title,
      description: listing.description,
      developerName: listing.developerName,
      storeCategory: listing.storeCategory,
      releaseDate: listing.releaseDate,
      currentVersion: listing.currentVersion,
      iconUrl: listing.iconUrl,
      storeUrl: listing.storeUrl,
      firstSeenAt: listing.firstSeenAt,
      lastSeenAt: listing.lastSeenAt,
    },
    snapshots: [...baseline, ...inRange].map((row) => ({
      capturedAt: row.capturedAt,
      rating: row.rating === null ? null : Number(row.rating),
      ratingCount: row.ratingCount,
      reviewCount: row.reviewCount,
      minInstalls: row.minInstalls,
      maxInstalls: row.maxInstalls,
      price: row.price === null ? null : Number(row.price),
      currency: row.currency,
      version: row.version,
    })),
    ranks: ranks.map((row) => ({
      chartType: row.chartType,
      category: row.category,
      capturedAt: row.capturedAt,
      rank: row.rank,
    })),
    siblings,
  };
}
