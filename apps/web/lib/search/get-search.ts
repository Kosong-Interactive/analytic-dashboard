import "server-only";

import { searchCatalog, type CatalogSearchResult } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { TAXONOMY_VERSION } from "../labels/constants";
import { searchLabelTypes } from "./results";

export const PALETTE_LIMITS = { games: 6, developers: 3, labels: 4 };
export const PAGE_LIMITS = { games: 50, developers: 20, labels: 20 };

/** Reads stored listings and taxonomy labels only; searching never starts collection or AI jobs. */
export function searchStoredCatalog(
  text: string,
  limits: typeof PALETTE_LIMITS = PALETTE_LIMITS,
): Promise<CatalogSearchResult> {
  return searchCatalog(getDatabase(), {
    text,
    taxonomyVersion: TAXONOMY_VERSION,
    labelTypes: searchLabelTypes,
    limits,
  });
}
