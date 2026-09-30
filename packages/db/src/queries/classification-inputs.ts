import { asc, desc, eq, sql } from "drizzle-orm";

import { appSnapshots, steamApps, steamPrices, storeApps, type StoreId } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export interface ClassificationListingRow {
  store: StoreId;
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


export interface SteamClassificationInputRow {
  steamAppId: string;
  title: string;
  description: string | null;
  genres: string[];
  tags: string[];
  isFree: boolean;
  /** Latest US final price; null when Steam reported none. */
  usPrice: number | null;
}

/** Every Steam game with the fields classification reads. */
export async function loadSteamClassificationInputs(db: DatabaseExecutor): Promise<SteamClassificationInputRow[]> {
  const [apps, prices] = await Promise.all([
    db
      .select({
        id: steamApps.id,
        title: steamApps.title,
        description: steamApps.description,
        genres: steamApps.genres,
        tags: steamApps.tags,
        isFree: steamApps.isFree,
      })
      .from(steamApps)
      .orderBy(asc(steamApps.id)),
    db
      .selectDistinctOn([steamPrices.steamAppId], {
        steamAppId: steamPrices.steamAppId,
        finalPrice: steamPrices.finalPrice,
      })
      .from(steamPrices)
      .where(eq(steamPrices.country, "us"))
      .orderBy(steamPrices.steamAppId, desc(steamPrices.capturedAt)),
  ]);
  const priceById = new Map(prices.map((row) => [row.steamAppId, Number(row.finalPrice)]));
  return apps.map((app) => ({
    steamAppId: app.id,
    title: app.title,
    description: app.description,
    genres: app.genres,
    tags: app.tags,
    isFree: app.isFree,
    usPrice: priceById.get(app.id) ?? null,
  }));
}
