import { and, asc, desc, eq } from "drizzle-orm";

import { appLabels, storeApps, taxonomyLabels } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";
import type { LabelType } from "../repositories/classification";

export interface ListingLabelRow {
  type: LabelType;
  slug: string;
  displayName: string;
  source: "rule" | "ai" | "manual";
  confidence: number;
  evidence: unknown;
  /** Rules or prompt version that produced the label; "none" for manual ones. */
  version: string;
  model: string | null;
  updatedAt: Date;
}

/** Every label of the listing's canonical app, strongest first, with full provenance. */
export async function loadListingLabels(
  db: DatabaseExecutor,
  query: { storeAppId: string; taxonomyVersion: string },
): Promise<ListingLabelRow[]> {
  const rows = await db
    .select({
      type: taxonomyLabels.type,
      slug: taxonomyLabels.slug,
      displayName: taxonomyLabels.displayName,
      source: appLabels.source,
      confidence: appLabels.confidence,
      evidence: appLabels.evidence,
      version: appLabels.promptVersion,
      model: appLabels.model,
      updatedAt: appLabels.updatedAt,
    })
    .from(appLabels)
    .innerJoin(taxonomyLabels, eq(taxonomyLabels.id, appLabels.labelId))
    .innerJoin(storeApps, eq(storeApps.appId, appLabels.appId))
    .where(and(eq(storeApps.id, query.storeAppId), eq(appLabels.taxonomyVersion, query.taxonomyVersion)))
    .orderBy(asc(taxonomyLabels.type), desc(appLabels.confidence), asc(taxonomyLabels.slug));

  return rows.map((row) => ({ ...row, confidence: Number(row.confidence) }));
}
