import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { appSnapshots, storeApps, watchlistEntries, type StoreId } from "../schema/index";
import type { DatabaseExecutor } from "./executor";

export type WatchlistStatus = (typeof watchlistEntries.$inferSelect)["status"];

export interface WatchlistEntryRow {
  id: string;
  storeAppId: string;
  status: WatchlistStatus;
  note: string | null;
  addedBy: string;
  addedAt: Date;
  updatedBy: string;
  updatedAt: Date;
  baselineCapturedAt: Date | null;
  baselineRating: number | null;
  baselineRatingCount: number | null;
  store: StoreId;
  country: string;
  title: string;
  developerName: string | null;
  iconUrl: string | null;
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Adds a listing with its latest observation as the baseline. Rerunning is safe: an existing
 * entry keeps its original baseline, status, and note. Returns whether a new entry was created.
 */
export async function addWatchlistEntry(
  db: DatabaseExecutor,
  input: { storeAppId: string; actor: string },
): Promise<boolean> {
  const [latest] = await db
    .select({
      capturedAt: appSnapshots.capturedAt,
      rating: appSnapshots.rating,
      ratingCount: appSnapshots.ratingCount,
    })
    .from(appSnapshots)
    .where(eq(appSnapshots.storeAppId, input.storeAppId))
    .orderBy(desc(appSnapshots.capturedAt))
    .limit(1);

  const inserted = await db
    .insert(watchlistEntries)
    .values({
      storeAppId: input.storeAppId,
      addedBy: input.actor,
      updatedBy: input.actor,
      baselineCapturedAt: latest?.capturedAt ?? null,
      baselineRating: latest?.rating ?? null,
      baselineRatingCount: latest?.ratingCount ?? null,
    })
    .onConflictDoNothing({ target: watchlistEntries.storeAppId })
    .returning({ id: watchlistEntries.id });
  return inserted.length > 0;
}

/** Changes status and/or note. Returns false when the listing is not on the watchlist. */
export async function updateWatchlistEntry(
  db: DatabaseExecutor,
  input: { storeAppId: string; actor: string; status?: WatchlistStatus; note?: string | null },
): Promise<boolean> {
  const updated = await db
    .update(watchlistEntries)
    .set({
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.note === undefined ? {} : { note: input.note }),
      updatedBy: input.actor,
      updatedAt: sql`now()`,
    })
    .where(eq(watchlistEntries.storeAppId, input.storeAppId))
    .returning({ id: watchlistEntries.id });
  return updated.length > 0;
}

export async function removeWatchlistEntry(db: DatabaseExecutor, storeAppId: string): Promise<boolean> {
  const removed = await db
    .delete(watchlistEntries)
    .where(eq(watchlistEntries.storeAppId, storeAppId))
    .returning({ id: watchlistEntries.id });
  return removed.length > 0;
}

/** Watchlist entries of the selected storefronts with listing context, most recently changed first. */
export async function loadWatchlist(
  db: DatabaseExecutor,
  query: { stores: ReadonlyArray<StoreId>; country: string },
): Promise<WatchlistEntryRow[]> {
  if (query.stores.length === 0) return [];
  const rows = await db
    .select({
      id: watchlistEntries.id,
      storeAppId: watchlistEntries.storeAppId,
      status: watchlistEntries.status,
      note: watchlistEntries.note,
      addedBy: watchlistEntries.addedBy,
      addedAt: watchlistEntries.addedAt,
      updatedBy: watchlistEntries.updatedBy,
      updatedAt: watchlistEntries.updatedAt,
      baselineCapturedAt: watchlistEntries.baselineCapturedAt,
      baselineRating: watchlistEntries.baselineRating,
      baselineRatingCount: watchlistEntries.baselineRatingCount,
      store: storeApps.store,
      country: storeApps.country,
      title: storeApps.title,
      developerName: storeApps.developerName,
      iconUrl: storeApps.iconUrl,
    })
    .from(watchlistEntries)
    .innerJoin(storeApps, eq(storeApps.id, watchlistEntries.storeAppId))
    .where(and(inArray(storeApps.store, [...query.stores]), eq(storeApps.country, query.country)))
    .orderBy(desc(watchlistEntries.updatedAt));
  return rows.map((row) => ({ ...row, baselineRating: toNumber(row.baselineRating) }));
}

/** The entry of one listing, for the game detail page; `null` when it is not watched. */
export async function findWatchlistEntry(
  db: DatabaseExecutor,
  storeAppId: string,
): Promise<{ status: WatchlistStatus; note: string | null; addedBy: string; addedAt: Date } | null> {
  const [row] = await db
    .select({
      status: watchlistEntries.status,
      note: watchlistEntries.note,
      addedBy: watchlistEntries.addedBy,
      addedAt: watchlistEntries.addedAt,
    })
    .from(watchlistEntries)
    .where(eq(watchlistEntries.storeAppId, storeAppId))
    .limit(1);
  return row ?? null;
}
