import { inArray } from "drizzle-orm";

import { storeApps } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export interface ListingContextRow {
  storeAppId: string;
  store: "app_store" | "google_play";
  country: string;
}

/** Store and country of each listing, so callers can load each storefront cohort once. */
export async function loadListingContexts(
  db: DatabaseExecutor,
  storeAppIds: readonly string[],
): Promise<ListingContextRow[]> {
  if (storeAppIds.length === 0) return [];
  return db
    .select({ storeAppId: storeApps.id, store: storeApps.store, country: storeApps.country })
    .from(storeApps)
    .where(inArray(storeApps.id, [...storeAppIds]));
}
