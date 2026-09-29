import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";

import { storeApps, taxonomyLabels } from "../schema/index";
import type { LabelType } from "../repositories/classification";
import type { DatabaseExecutor } from "../repositories/executor";

export interface CatalogSearchQuery {
  /** Already trimmed and length-checked by the caller. */
  text: string;
  taxonomyVersion: string;
  labelTypes: readonly LabelType[];
  limits: { games: number; developers: number; labels: number };
}

export interface CatalogGameHit {
  storeAppId: string;
  title: string;
  developerName: string | null;
  store: "app_store" | "google_play";
  country: string;
  iconUrl: string | null;
}

export interface CatalogDeveloperHit {
  developerName: string;
  listings: number;
}

export interface CatalogLabelHit {
  type: LabelType;
  slug: string;
  displayName: string;
}

export interface CatalogSearchResult {
  games: CatalogGameHit[];
  developers: CatalogDeveloperHit[];
  labels: CatalogLabelHit[];
}

/** `%`, `_`, and `\` are literal in a search, not LIKE wildcards. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Searches stored listings, developer names, and active taxonomy labels. Reads only; three
 * bounded queries regardless of how many rows match. Prefix matches rank before substrings.
 */
export async function searchCatalog(db: DatabaseExecutor, query: CatalogSearchQuery): Promise<CatalogSearchResult> {
  const escaped = escapeLikePattern(query.text);
  const contains = `%${escaped}%`;
  const prefix = `${escaped}%`;

  const [games, developers, labels] = await Promise.all([
    db
      .select({
        storeAppId: storeApps.id,
        title: storeApps.title,
        developerName: storeApps.developerName,
        store: storeApps.store,
        country: storeApps.country,
        iconUrl: storeApps.iconUrl,
      })
      .from(storeApps)
      .where(or(ilike(storeApps.title, contains), ilike(storeApps.developerName, contains)))
      .orderBy(
        sql`case when ${storeApps.title} ilike ${prefix} then 0 when ${storeApps.title} ilike ${contains} then 1 else 2 end`,
        asc(storeApps.title),
        asc(storeApps.country),
        asc(storeApps.store),
      )
      .limit(query.limits.games),
    db
      .select({ developerName: storeApps.developerName, listings: count() })
      .from(storeApps)
      .where(and(isNotNull(storeApps.developerName), ilike(storeApps.developerName, contains)))
      .groupBy(storeApps.developerName)
      .orderBy(desc(count()), asc(storeApps.developerName))
      .limit(query.limits.developers),
    query.labelTypes.length === 0
      ? Promise.resolve([])
      : db
          .select({ type: taxonomyLabels.type, slug: taxonomyLabels.slug, displayName: taxonomyLabels.displayName })
          .from(taxonomyLabels)
          .where(
            and(
              eq(taxonomyLabels.taxonomyVersion, query.taxonomyVersion),
              eq(taxonomyLabels.isActive, true),
              inArray(taxonomyLabels.type, [...query.labelTypes]),
              or(ilike(taxonomyLabels.displayName, contains), ilike(taxonomyLabels.slug, contains)),
            ),
          )
          .orderBy(
            sql`case when ${taxonomyLabels.displayName} ilike ${prefix} then 0 else 1 end`,
            asc(taxonomyLabels.displayName),
          )
          .limit(query.limits.labels),
  ]);

  return {
    games,
    developers: developers.flatMap((row) =>
      row.developerName ? [{ developerName: row.developerName, listings: row.listings }] : [],
    ),
    labels,
  };
}
