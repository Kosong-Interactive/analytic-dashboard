import { and, eq, ne, sql } from "drizzle-orm";

import { appLabels, taxonomyLabels } from "../schema/index";
import type { DatabaseExecutor } from "./executor";

export type LabelType = (typeof taxonomyLabels.$inferInsert)["type"];

export interface TaxonomyLabelInput {
  type: LabelType;
  slug: string;
  displayName: string;
}

/**
 * Upserts one taxonomy version's labels and returns their ids keyed by `type:slug`.
 * Safe to rerun; labels from other versions are never touched.
 */
export async function syncTaxonomyLabels(
  db: DatabaseExecutor,
  input: { taxonomyVersion: string; labels: readonly TaxonomyLabelInput[] },
): Promise<Map<string, string>> {
  if (input.labels.length > 0) {
    await db
      .insert(taxonomyLabels)
      .values(
        input.labels.map((label) => ({
          type: label.type,
          slug: label.slug,
          displayName: label.displayName,
          taxonomyVersion: input.taxonomyVersion,
        })),
      )
      .onConflictDoUpdate({
        target: [taxonomyLabels.taxonomyVersion, taxonomyLabels.type, taxonomyLabels.slug],
        set: { displayName: sql`excluded.display_name`, isActive: true, updatedAt: sql`now()` },
      });
  }

  const rows = await db
    .select({ id: taxonomyLabels.id, type: taxonomyLabels.type, slug: taxonomyLabels.slug })
    .from(taxonomyLabels)
    .where(eq(taxonomyLabels.taxonomyVersion, input.taxonomyVersion));
  return new Map(rows.map((row) => [`${row.type}:${row.slug}`, row.id]));
}

/** Input hashes already classified by rules, per app, for one taxonomy version. */
export async function loadRuleInputHashes(
  db: DatabaseExecutor,
  taxonomyVersion: string,
): Promise<Map<string, string>> {
  const rows = await db
    .selectDistinct({ appId: appLabels.appId, inputHash: appLabels.inputHash })
    .from(appLabels)
    .where(and(eq(appLabels.source, "rule"), eq(appLabels.taxonomyVersion, taxonomyVersion)));
  return new Map(rows.map((row) => [row.appId, row.inputHash]));
}

export interface RuleLabelRow {
  labelId: string;
  confidence: number;
  evidence: unknown[];
}

/**
 * Rule labels are derived data: when an app's input changes, its previous rule labels for the
 * same taxonomy version are replaced. AI and manual labels are never touched here, so a manual
 * decision always survives reclassification.
 */
export async function replaceRuleLabels(
  db: DatabaseExecutor,
  input: {
    appId: string;
    taxonomyVersion: string;
    rulesVersion: string;
    inputHash: string;
    labels: readonly RuleLabelRow[];
  },
): Promise<{ written: number; removed: number }> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(appLabels)
      .where(
        and(
          eq(appLabels.appId, input.appId),
          eq(appLabels.source, "rule"),
          eq(appLabels.taxonomyVersion, input.taxonomyVersion),
          ne(appLabels.inputHash, input.inputHash),
        ),
      )
      .returning({ id: appLabels.id });

    if (input.labels.length === 0) return { written: 0, removed: removed.length };

    const written = await tx
      .insert(appLabels)
      .values(
        input.labels.map((label) => ({
          appId: input.appId,
          labelId: label.labelId,
          source: "rule" as const,
          confidence: label.confidence.toFixed(3),
          evidence: label.evidence,
          taxonomyVersion: input.taxonomyVersion,
          promptVersion: input.rulesVersion,
          model: null,
          inputHash: input.inputHash,
          isManualOverride: false,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: appLabels.id });

    return { written: written.length, removed: removed.length };
  });
}


export type ManualDecision = "confirm" | "reject";

/** Manual labels live under a fixed provenance so there is at most one per app and label. */
const MANUAL_PROMPT_VERSION = "none";
const MANUAL_INPUT_HASH = "manual";

/**
 * Records a person's decision on one label. `confirm` asserts the label (confidence 1);
 * `reject` asserts it is wrong (confidence 0), which hides the automated label of the same slug.
 * Automated jobs never write manual rows, so the decision survives every reclassification.
 */
export async function setManualLabel(
  db: DatabaseExecutor,
  input: {
    appId: string;
    labelId: string;
    taxonomyVersion: string;
    decision: ManualDecision;
    actor: string;
    decidedAt: Date;
  },
): Promise<void> {
  const evidence = [
    {
      field: "metadata",
      excerpt: `${input.decision === "confirm" ? "Confirmed" : "Rejected"} by ${input.actor} at ${input.decidedAt.toISOString()}`,
    },
  ];
  const confidence = input.decision === "confirm" ? "1.000" : "0.000";

  await db
    .insert(appLabels)
    .values({
      appId: input.appId,
      labelId: input.labelId,
      source: "manual",
      confidence,
      evidence,
      taxonomyVersion: input.taxonomyVersion,
      promptVersion: MANUAL_PROMPT_VERSION,
      model: null,
      inputHash: MANUAL_INPUT_HASH,
      isManualOverride: true,
    })
    .onConflictDoUpdate({
      target: [
        appLabels.appId,
        appLabels.labelId,
        appLabels.source,
        appLabels.taxonomyVersion,
        appLabels.promptVersion,
        appLabels.inputHash,
      ],
      set: { confidence, evidence, updatedAt: sql`now()` },
    });
}

/** Removes a manual decision so the automated labels apply again. Returns whether one existed. */
export async function clearManualLabel(
  db: DatabaseExecutor,
  input: { appId: string; labelId: string; taxonomyVersion: string },
): Promise<boolean> {
  const removed = await db
    .delete(appLabels)
    .where(
      and(
        eq(appLabels.appId, input.appId),
        eq(appLabels.labelId, input.labelId),
        eq(appLabels.taxonomyVersion, input.taxonomyVersion),
        eq(appLabels.source, "manual"),
      ),
    )
    .returning({ id: appLabels.id });
  return removed.length > 0;
}

/** All labels of one taxonomy version, for pickers that add a label manually. */
export async function loadTaxonomyLabels(
  db: DatabaseExecutor,
  taxonomyVersion: string,
): Promise<Array<{ id: string; type: LabelType; slug: string; displayName: string }>> {
  return db
    .select({
      id: taxonomyLabels.id,
      type: taxonomyLabels.type,
      slug: taxonomyLabels.slug,
      displayName: taxonomyLabels.displayName,
    })
    .from(taxonomyLabels)
    .where(and(eq(taxonomyLabels.taxonomyVersion, taxonomyVersion), eq(taxonomyLabels.isActive, true)))
    .orderBy(taxonomyLabels.type, taxonomyLabels.displayName);
}
