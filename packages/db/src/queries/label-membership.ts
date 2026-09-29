import { and, eq, gte, inArray, or } from "drizzle-orm";

import { appLabels, storeApps, taxonomyLabels } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";
import type { LabelType } from "../repositories/classification";

export interface LabelMembershipQuery {
  stores: ReadonlyArray<"app_store" | "google_play">;
  country: string;
  taxonomyVersion: string;
  types: readonly LabelType[];
  /** Labels below this confidence are treated as not assigned. Manual labels always count. */
  minConfidence: number;
}

export interface LabelMembershipRow {
  storeAppId: string;
  type: LabelType;
  slug: string;
  displayName: string;
  confidence: number;
  source: "rule" | "ai" | "manual";
}

const SOURCE_PRIORITY = { manual: 3, ai: 2, rule: 1 } as const;

/**
 * Which listings of one storefront carry which labels. Labels belong to the canonical app, so
 * every listing of that app inherits them. One row per (listing, label): a manual label wins,
 * otherwise the most confident automated one. A manual rejection removes the label.
 */
export async function loadLabelMembership(
  db: DatabaseExecutor,
  query: LabelMembershipQuery,
): Promise<LabelMembershipRow[]> {
  if (query.stores.length === 0 || query.types.length === 0) return [];

  const rows = await db
    .select({
      storeAppId: storeApps.id,
      labelId: taxonomyLabels.id,
      type: taxonomyLabels.type,
      slug: taxonomyLabels.slug,
      displayName: taxonomyLabels.displayName,
      confidence: appLabels.confidence,
      source: appLabels.source,
    })
    .from(appLabels)
    .innerJoin(taxonomyLabels, eq(taxonomyLabels.id, appLabels.labelId))
    .innerJoin(storeApps, eq(storeApps.appId, appLabels.appId))
    .where(
      and(
        inArray(storeApps.store, [...query.stores]),
        eq(storeApps.country, query.country),
        eq(appLabels.taxonomyVersion, query.taxonomyVersion),
        eq(taxonomyLabels.isActive, true),
        inArray(taxonomyLabels.type, [...query.types]),
        or(eq(appLabels.source, "manual"), gte(appLabels.confidence, query.minConfidence.toFixed(3))),
      ),
    );

  const best = new Map<string, LabelMembershipRow>();
  for (const row of rows) {
    const candidate: LabelMembershipRow = {
      storeAppId: row.storeAppId,
      type: row.type,
      slug: row.slug,
      displayName: row.displayName,
      confidence: Number(row.confidence),
      source: row.source,
    };
    const key = `${row.storeAppId}:${row.labelId}`;
    const current = best.get(key);
    if (
      !current ||
      SOURCE_PRIORITY[candidate.source] > SOURCE_PRIORITY[current.source] ||
      (candidate.source === current.source && candidate.confidence > current.confidence)
    ) {
      best.set(key, candidate);
    }
  }
  // A manual rejection (confidence 0) is a decision that the label does not apply.
  return [...best.values()].filter((row) => !(row.source === "manual" && row.confidence === 0));
}
