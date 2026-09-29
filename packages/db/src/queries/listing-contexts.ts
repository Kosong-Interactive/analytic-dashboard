import { inArray } from "drizzle-orm";

import { storeApps, type StoreId } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export interface ListingContextRow {
  storeAppId: string;
  store: StoreId;
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
