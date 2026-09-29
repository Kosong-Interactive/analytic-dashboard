import { and, eq, ne, sql } from "drizzle-orm";

import { appLabels, classificationRuns, taxonomyLabels } from "../schema/index";
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

export type AutomatedSource = "rule" | "ai";

/**
 * Input hashes already classified by one automated source, per app, for one taxonomy version.
 * Read from the run record, so an app whose last result had no labels is still skipped.
 */
export async function loadInputHashes(
  db: DatabaseExecutor,
  source: AutomatedSource,
  taxonomyVersion: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ appId: classificationRuns.appId, inputHash: classificationRuns.inputHash })
    .from(classificationRuns)
    .where(and(eq(classificationRuns.source, source), eq(classificationRuns.taxonomyVersion, taxonomyVersion)));
  return new Map(rows.map((row) => [row.appId, row.inputHash]));
}

export function loadRuleInputHashes(db: DatabaseExecutor, taxonomyVersion: string): Promise<Map<string, string>> {
  return loadInputHashes(db, "rule", taxonomyVersion);
}

export interface RuleLabelRow {
  labelId: string;
  confidence: number;
  evidence: unknown[];
}

export type AutomatedLabelRow = RuleLabelRow;

/**
 * Automated labels are derived data: when an app's input changes, its previous labels from the
 * same source and taxonomy version are replaced. Other sources, and manual labels in particular,
 * are never touched here, so a manual decision always survives reclassification. The run record
 * is written in the same transaction, including for an empty result, so it is cached too.
 */
export async function replaceAutomatedLabels(
  db: DatabaseExecutor,
  input: {
    source: AutomatedSource;
    appId: string;
    taxonomyVersion: string;
    /** Rules version or prompt version that produced the labels. */
    classifierVersion: string;
    model: string | null;
    inputHash: string;
    labels: readonly AutomatedLabelRow[];
  },
): Promise<{ written: number; removed: number }> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(appLabels)
      .where(
        and(
          eq(appLabels.appId, input.appId),
          eq(appLabels.source, input.source),
          eq(appLabels.taxonomyVersion, input.taxonomyVersion),
          ne(appLabels.inputHash, input.inputHash),
        ),
      )
      .returning({ id: appLabels.id });

    const run = {
      classifierVersion: input.classifierVersion,
      model: input.model,
      inputHash: input.inputHash,
      labelCount: input.labels.length,
      classifiedAt: sql`now()`,
    };
    await tx
      .insert(classificationRuns)
      .values({ appId: input.appId, source: input.source, taxonomyVersion: input.taxonomyVersion, ...run })
      .onConflictDoUpdate({
        target: [classificationRuns.appId, classificationRuns.source, classificationRuns.taxonomyVersion],
        set: run,
      });

    if (input.labels.length === 0) return { written: 0, removed: removed.length };

    const written = await tx
      .insert(appLabels)
      .values(
        input.labels.map((label) => ({
          appId: input.appId,
          labelId: label.labelId,
          source: input.source,
          confidence: label.confidence.toFixed(3),
          evidence: label.evidence,
          taxonomyVersion: input.taxonomyVersion,
          promptVersion: input.classifierVersion,
          model: input.model,
          inputHash: input.inputHash,
          isManualOverride: false,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: appLabels.id });

    return { written: written.length, removed: removed.length };
  });
}

export function replaceRuleLabels(
  db: DatabaseExecutor,
  input: {
    appId: string;
    taxonomyVersion: string;
    rulesVersion: string;
    inputHash: string;
    labels: readonly RuleLabelRow[];
  },
): Promise<{ written: number; removed: number }> {
  return replaceAutomatedLabels(db, {
    source: "rule",
    appId: input.appId,
    taxonomyVersion: input.taxonomyVersion,
    classifierVersion: input.rulesVersion,
    model: null,
    inputHash: input.inputHash,
    labels: input.labels,
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
