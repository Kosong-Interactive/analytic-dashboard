import { and, desc, eq, inArray } from "drizzle-orm";

import { desktopOpportunityDecisions } from "../schema/index";
import type { DatabaseExecutor } from "./executor";

export type DesktopOpportunityDecisionStatus =
  (typeof desktopOpportunityDecisions.$inferSelect)["status"];
export type DesktopOpportunityLabelType =
  (typeof desktopOpportunityDecisions.$inferSelect)["labelType"];

export interface DesktopOpportunityIdentity {
  country: string;
  labelType: DesktopOpportunityLabelType;
  labelSlug: string;
}

export interface DesktopOpportunityDecisionRow extends DesktopOpportunityIdentity {
  id: string;
  labelDisplayName: string;
  formulaVersion: string;
  steamTaxonomyVersion: string;
  mobileTaxonomyVersion: string;
  status: DesktopOpportunityDecisionStatus;
  note: string | null;
  owner: string | null;
  actor: string;
  evidence: unknown;
  createdAt: Date;
}

/** Appends a decision and its evidence snapshot; earlier team decisions remain unchanged. */
export async function recordDesktopOpportunityDecision(
  db: DatabaseExecutor,
  input: Omit<DesktopOpportunityDecisionRow, "id" | "createdAt"> & { createdAt?: Date },
): Promise<void> {
  await db.insert(desktopOpportunityDecisions).values(input);
}

/** Loads the complete audit history for one market and label, newest first. */
export async function loadDesktopOpportunityDecisions(
  db: DatabaseExecutor,
  identity: DesktopOpportunityIdentity,
): Promise<DesktopOpportunityDecisionRow[]> {
  return db
    .select()
    .from(desktopOpportunityDecisions)
    .where(
      and(
        eq(desktopOpportunityDecisions.country, identity.country),
        eq(desktopOpportunityDecisions.labelType, identity.labelType),
        eq(desktopOpportunityDecisions.labelSlug, identity.labelSlug),
      ),
    )
    .orderBy(desc(desktopOpportunityDecisions.createdAt));
}

/**
 * Loads the latest decision for each requested label. The query deliberately over-selects the
 * Cartesian type/slug set and filters exact identities in memory; opportunity lists are small and
 * this keeps one indexed database round trip.
 */
export async function loadLatestDesktopOpportunityDecisions(
  db: DatabaseExecutor,
  input: { country: string; labels: ReadonlyArray<Pick<DesktopOpportunityIdentity, "labelType" | "labelSlug">> },
): Promise<Map<string, DesktopOpportunityDecisionRow>> {
  if (input.labels.length === 0) return new Map();
  const types = [...new Set(input.labels.map((label) => label.labelType))];
  const slugs = [...new Set(input.labels.map((label) => label.labelSlug))];
  const requested = new Set(input.labels.map((label) => `${label.labelType}:${label.labelSlug}`));
  const rows = await db
    .select()
    .from(desktopOpportunityDecisions)
    .where(
      and(
        eq(desktopOpportunityDecisions.country, input.country),
        inArray(desktopOpportunityDecisions.labelType, types),
        inArray(desktopOpportunityDecisions.labelSlug, slugs),
      ),
    )
    .orderBy(desc(desktopOpportunityDecisions.createdAt));

  const latest = new Map<string, DesktopOpportunityDecisionRow>();
  for (const row of rows) {
    const key = `${row.labelType}:${row.labelSlug}`;
    if (requested.has(key) && !latest.has(key)) latest.set(key, row);
  }
  return latest;
}
