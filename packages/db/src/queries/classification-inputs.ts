import { asc, desc, sql } from "drizzle-orm";

import { appSnapshots, storeApps } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export interface ClassificationListingRow {
  store: "app_store" | "google_play";
  country: string;
  title: string;
  description: string | null;
  storeGenres: string[];
  price: number | null;
}

export interface ClassificationInputRow {
  appId: string;
  listings: ClassificationListingRow[];
}

/**
 * Every canonical app with the listing fields classification reads. Store genres are extracted in
 * SQL (Apple `genres`, Google `genreId`) so the full raw payload never leaves the database.
 */
export async function loadClassificationInputs(
  db: DatabaseExecutor,
): Promise<ClassificationInputRow[]> {
  const [listings, prices] = await Promise.all([
    db
      .select({
        id: storeApps.id,
        appId: storeApps.appId,
        store: storeApps.store,
        country: storeApps.country,
        title: storeApps.title,
        description: storeApps.description,
        appleGenres: sql<string[] | null>`case when jsonb_typeof(${storeApps.rawMetadata}->'genres') = 'array' then array(select jsonb_array_elements_text(${storeApps.rawMetadata}->'genres')) end`,
        googleGenreId: sql<string | null>`${storeApps.rawMetadata}->>'genreId'`,
      })
      .from(storeApps)
      .orderBy(asc(storeApps.appId), asc(storeApps.store), asc(storeApps.country)),
    db
      .selectDistinctOn([appSnapshots.storeAppId], {
        storeAppId: appSnapshots.storeAppId,
        price: appSnapshots.price,
      })
      .from(appSnapshots)
      .orderBy(appSnapshots.storeAppId, desc(appSnapshots.capturedAt)),
  ]);

  const priceById = new Map(prices.map((row) => [row.storeAppId, row.price]));
  const byApp = new Map<string, ClassificationListingRow[]>();
  for (const listing of listings) {
    const price = priceById.get(listing.id);
    const storeGenres =
      listing.store === "app_store"
        ? (listing.appleGenres ?? [])
        : listing.googleGenreId
          ? [listing.googleGenreId]
          : [];
    const row: ClassificationListingRow = {
      store: listing.store,
      country: listing.country,
      title: listing.title,
      description: listing.description,
      storeGenres,
      price: price === null || price === undefined ? null : Number(price),
    };
    const bucket = byApp.get(listing.appId);
    if (bucket) bucket.push(row);
    else byApp.set(listing.appId, [row]);
  }

  return [...byApp].map(([appId, rows]) => ({ appId, listings: rows }));
}

