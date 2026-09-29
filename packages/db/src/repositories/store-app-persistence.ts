import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  appSnapshots,
  apps,
  chartEntries,
  storeApps,
  type StoreId,
} from "../schema/index";
import type { DatabaseExecutor } from "./executor";
import {
  decideSnapshotWrite,
  roundToStoredScale,
  toTrackedValues,
  type SnapshotObservation,
} from "./snapshot-policy";

/** Store-neutral shape of a collector's normalized output, kept structural so db never imports a collector. */
export interface PersistableStoreApp {
  store: StoreId;
  externalId: string;
  country: string;
  locale: string;
  title: string;
  description: string | null;
  developerName: string | null;
  developerExternalId: string | null;
  storeCategory: string | null;
  releaseDate: string | null;
  currentVersion: string | null;
  iconUrl: string | null;
  storeUrl: string;
  metadataHash: string;
  rawMetadata: Record<string, unknown>;
  snapshot: {
    capturedAt: string;
    rating: number | null;
    ratingCount: number | null;
    reviewCount: number | null;
    minInstalls: number | null;
    maxInstalls: number | null;
    price: number | null;
    currency: string | null;
    version: string | null;
  };
}

export interface PersistStoreAppsResult {
  processed: number;
  newStoreApps: number;
  metadataUpdated: number;
  snapshotsWritten: number;
  snapshotsSkipped: number;
  storeAppIds: ReadonlyMap<string, string>;
}

export interface ChartEntryInput {
  storeAppId: string;
  rank: number;
}

export interface PersistChartEntriesInput {
  chartType: string;
  category: string;
  country: string;
  capturedAt: Date;
  entries: ChartEntryInput[];
}

export function storeListingKey(
  listing: Pick<
    PersistableStoreApp,
    "store" | "externalId" | "country" | "locale"
  >,
): string {
  return [listing.store, listing.country, listing.locale, listing.externalId].join(
    ":",
  );
}

export function normalizeAppName(title: string): string {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Upserts store listings and writes change-only snapshots. Safe to rerun:
 * listings are keyed by (store, external id, country, locale) and a snapshot is
 * only added when a tracked value changed or the daily heartbeat is due.
 */
export async function persistStoreApps(
  db: DatabaseExecutor,
  input: readonly PersistableStoreApp[],
): Promise<PersistStoreAppsResult> {
  const uniqueApps = [
    ...new Map(input.map((app) => [storeListingKey(app), app])).values(),
  ];
  if (uniqueApps.length === 0) {
    return {
      processed: 0,
      newStoreApps: 0,
      metadataUpdated: 0,
      snapshotsWritten: 0,
      snapshotsSkipped: 0,
      storeAppIds: new Map(),
    };
  }

  return db.transaction(async (tx) => {
    const existing = await findExistingListings(tx, uniqueApps);
    const storeAppIds = new Map<string, string>();
    for (const [key, row] of existing) {
      storeAppIds.set(key, row.id);
    }

    const created = uniqueApps.filter(
      (app) => !existing.has(storeListingKey(app)),
    );
    const changed = uniqueApps.filter((app) => {
      const row = existing.get(storeListingKey(app));
      return row !== undefined && row.metadataHash !== app.metadataHash;
    });
    const unchanged = uniqueApps.filter((app) => {
      const row = existing.get(storeListingKey(app));
      return row !== undefined && row.metadataHash === app.metadataHash;
    });

    const appIdByExternalId = await resolveAppIds(tx, created);
    const upserted = await upsertListings(
      tx,
      [...created, ...changed],
      appIdByExternalId,
      existing,
    );
    for (const [key, id] of upserted) {
      storeAppIds.set(key, id);
    }
    await touchLastSeen(tx, unchanged, storeAppIds);

    const snapshots = await writeSnapshots(tx, uniqueApps, storeAppIds);

    return {
      processed: uniqueApps.length,
      newStoreApps: created.length,
      metadataUpdated: changed.length,
      snapshotsWritten: snapshots.written,
      snapshotsSkipped: snapshots.skipped,
      storeAppIds,
    };
  });
}

/** One row per (listing, chart, category, captured time); a repeated observation is ignored. */
export async function persistChartEntries(
  db: DatabaseExecutor,
  input: PersistChartEntriesInput,
): Promise<number> {
  if (input.entries.length === 0) {
    return 0;
  }

  const inserted = await db
    .insert(chartEntries)
    .values(
      input.entries.map((entry) => ({
        storeAppId: entry.storeAppId,
        chartType: input.chartType,
        category: input.category,
        country: input.country,
        rank: entry.rank,
        capturedAt: input.capturedAt,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: chartEntries.id });

  return inserted.length;
}

interface ExistingListing {
  id: string;
  appId: string;
  metadataHash: string;
}

async function findExistingListings(
  db: DatabaseExecutor,
  input: readonly PersistableStoreApp[],
): Promise<Map<string, ExistingListing>> {
  const groups = groupBy(
    input,
    (app) => `${app.store}:${app.country}:${app.locale}`,
  );
  const existing = new Map<string, ExistingListing>();

  for (const group of groups.values()) {
    const [first] = group;
    if (!first) continue;
    const rows = await db
      .select({
        id: storeApps.id,
        appId: storeApps.appId,
        externalId: storeApps.externalId,
        metadataHash: storeApps.metadataHash,
      })
      .from(storeApps)
      .where(
        and(
          eq(storeApps.store, first.store),
          eq(storeApps.country, first.country),
          eq(storeApps.locale, first.locale),
          inArray(
            storeApps.externalId,
            group.map((app) => app.externalId),
          ),
        ),
      );
    for (const row of rows) {
      existing.set(storeListingKey({ ...first, externalId: row.externalId }), {
        id: row.id,
        appId: row.appId,
        metadataHash: row.metadataHash,
      });
    }
  }

  return existing;
}

/**
 * A listing in a new country reuses the canonical app of the same store and
 * external id, which is the same product. Nothing is matched by title, so
 * cross-store matching stays a separate, reviewable step.
 */
async function resolveAppIds(
  db: DatabaseExecutor,
  created: readonly PersistableStoreApp[],
): Promise<Map<string, string>> {
  const appIdByStoreExternalId = new Map<string, string>();
  if (created.length === 0) {
    return appIdByStoreExternalId;
  }

  for (const [store, group] of groupBy(created, (app) => app.store)) {
    const [first] = group;
    if (!first) continue;
    const rows = await db
      .selectDistinctOn([storeApps.externalId], {
        externalId: storeApps.externalId,
        appId: storeApps.appId,
      })
      .from(storeApps)
      .where(
        and(
          eq(storeApps.store, first.store),
          inArray(
            storeApps.externalId,
            group.map((app) => app.externalId),
          ),
        ),
      )
      .orderBy(storeApps.externalId, storeApps.firstSeenAt);
    for (const row of rows) {
      appIdByStoreExternalId.set(`${store}:${row.externalId}`, row.appId);
    }
  }

  const missing = new Map<string, PersistableStoreApp>();
  for (const app of created) {
    const key = `${app.store}:${app.externalId}`;
    if (!appIdByStoreExternalId.has(key) && !missing.has(key)) {
      missing.set(key, app);
    }
  }

  if (missing.size > 0) {
    const inserted = await db
      .insert(apps)
      .values(
        [...missing.values()].map((app) => ({
          canonicalName: app.title,
          normalizedName: normalizeAppName(app.title),
          developerName: app.developerName,
          firstSeenAt: new Date(app.snapshot.capturedAt),
        })),
      )
      .returning({ id: apps.id });

    // RETURNING preserves VALUES order for a single-statement insert.
    [...missing.keys()].forEach((key, index) => {
      const row = inserted[index];
      if (!row) throw new Error("Canonical app was not created");
      appIdByStoreExternalId.set(key, row.id);
    });
  }

  return appIdByStoreExternalId;
}

async function upsertListings(
  db: DatabaseExecutor,
  listings: readonly PersistableStoreApp[],
  appIdByStoreExternalId: ReadonlyMap<string, string>,
  existing: ReadonlyMap<string, ExistingListing>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (listings.length === 0) {
    return ids;
  }

  const rows = await db
    .insert(storeApps)
    .values(
      listings.map((app) => {
        const appId =
          existing.get(storeListingKey(app))?.appId ??
          appIdByStoreExternalId.get(`${app.store}:${app.externalId}`);
        if (!appId) throw new Error("Canonical app was not resolved");
        const capturedAt = new Date(app.snapshot.capturedAt);
        return {
          appId,
          store: app.store,
          externalId: app.externalId,
          country: app.country,
          locale: app.locale,
          title: app.title,
          description: app.description,
          developerName: app.developerName,
          developerExternalId: app.developerExternalId,
          storeCategory: app.storeCategory,
          releaseDate: app.releaseDate ? new Date(app.releaseDate) : null,
          currentVersion: app.currentVersion,
          iconUrl: app.iconUrl,
          storeUrl: app.storeUrl,
          metadataHash: app.metadataHash,
          rawMetadata: app.rawMetadata,
          firstSeenAt: capturedAt,
          lastSeenAt: capturedAt,
        };
      }),
    )
    .onConflictDoUpdate({
      target: [
        storeApps.store,
        storeApps.externalId,
        storeApps.country,
        storeApps.locale,
      ],
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        developerName: sql`excluded.developer_name`,
        developerExternalId: sql`excluded.developer_external_id`,
        storeCategory: sql`excluded.store_category`,
        releaseDate: sql`excluded.release_date`,
        currentVersion: sql`excluded.current_version`,
        iconUrl: sql`excluded.icon_url`,
        storeUrl: sql`excluded.store_url`,
        metadataHash: sql`excluded.metadata_hash`,
        rawMetadata: sql`excluded.raw_metadata`,
        lastSeenAt: sql`greatest(${storeApps.lastSeenAt}, excluded.last_seen_at)`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: storeApps.id,
      store: storeApps.store,
      externalId: storeApps.externalId,
      country: storeApps.country,
      locale: storeApps.locale,
    });

  for (const row of rows) {
    ids.set(storeListingKey(row), row.id);
  }
  return ids;
}

async function touchLastSeen(
  db: DatabaseExecutor,
  listings: readonly PersistableStoreApp[],
  storeAppIds: ReadonlyMap<string, string>,
): Promise<void> {
  // Group by observation time so each distinct time is one UPDATE, not one per listing.
  const byCapturedAt = groupBy(listings, (app) => app.snapshot.capturedAt);
  for (const [capturedAt, group] of byCapturedAt) {
    const ids = group
      .map((app) => storeAppIds.get(storeListingKey(app)))
      .filter((id): id is string => id !== undefined);
    if (ids.length === 0) continue;
    await db
      .update(storeApps)
      .set({
        lastSeenAt: sql`greatest(${storeApps.lastSeenAt}, ${capturedAt}::timestamptz)`,
        updatedAt: sql`now()`,
      })
      .where(inArray(storeApps.id, ids));
  }
}

async function writeSnapshots(
  db: DatabaseExecutor,
  listings: readonly PersistableStoreApp[],
  storeAppIds: ReadonlyMap<string, string>,
): Promise<{ written: number; skipped: number }> {
  const ids = [...storeAppIds.values()];
  const latestRows = await db
    .selectDistinctOn([appSnapshots.storeAppId])
    .from(appSnapshots)
    .where(inArray(appSnapshots.storeAppId, ids))
    .orderBy(appSnapshots.storeAppId, desc(appSnapshots.capturedAt));
  const latestByStoreApp = new Map(
    latestRows.map((row) => [row.storeAppId, toObservation(row)]),
  );

  const toInsert: Array<typeof appSnapshots.$inferInsert> = [];
  for (const app of listings) {
    const storeAppId = storeAppIds.get(storeListingKey(app));
    if (!storeAppId) throw new Error("Store listing id was not resolved");

    const incoming: SnapshotObservation = {
      ...toTrackedValues(app.snapshot),
      capturedAt: new Date(app.snapshot.capturedAt),
    };
    const decision = decideSnapshotWrite(
      latestByStoreApp.get(storeAppId) ?? null,
      incoming,
    );
    if (decision === "unchanged" || decision === "stale") continue;

    toInsert.push({
      storeAppId,
      capturedAt: incoming.capturedAt,
      rating: toNumeric(incoming.rating),
      ratingCount: incoming.ratingCount,
      reviewCount: incoming.reviewCount,
      minInstalls: incoming.minInstalls,
      maxInstalls: incoming.maxInstalls,
      price: toNumeric(incoming.price),
      currency: incoming.currency,
      version: incoming.version,
    });
  }

  if (toInsert.length === 0) {
    return { written: 0, skipped: listings.length };
  }

  const inserted = await db
    .insert(appSnapshots)
    .values(toInsert)
    .onConflictDoNothing()
    .returning({ id: appSnapshots.id });

  return {
    written: inserted.length,
    skipped: listings.length - inserted.length,
  };
}

function toObservation(
  row: typeof appSnapshots.$inferSelect,
): SnapshotObservation {
  return {
    capturedAt: row.capturedAt,
    rating: row.rating === null ? null : Number(row.rating),
    ratingCount: row.ratingCount,
    reviewCount: row.reviewCount,
    minInstalls: row.minInstalls,
    maxInstalls: row.maxInstalls,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    version: row.version,
  };
}

function toNumeric(value: number | null): string | null {
  const rounded = roundToStoredScale(value);
  return rounded === null ? null : rounded.toFixed(2);
}

function groupBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
