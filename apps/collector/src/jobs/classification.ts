import {
  applyRules,
  classificationInputHash,
  hasLabel,
  listTaxonomyLabels,
  RULES_VERSION,
  type ClassificationInput,
  type Taxonomy,
} from "@analytic-dashboard/classifier";
import type { RuleLabelRow, TaxonomyLabelInput } from "@analytic-dashboard/db";

import { forEachConcurrent } from "../runtime/concurrency.js";

/** Everything the rule classification job needs from storage, so it is testable without a database. */
export interface ClassificationStore {
  syncTaxonomy(taxonomyVersion: string, labels: TaxonomyLabelInput[]): Promise<Map<string, string>>;
  loadInputs(): Promise<ClassificationInput[]>;
  loadRuleInputHashes(taxonomyVersion: string): Promise<Map<string, string>>;
  replaceRuleLabels(input: {
    appId: string;
    taxonomyVersion: string;
    rulesVersion: string;
    inputHash: string;
    labels: RuleLabelRow[];
  }): Promise<{ written: number; removed: number }>;
}

export interface ClassificationSummary {
  taxonomyVersion: string;
  rulesVersion: string;
  apps: number;
  /** Apps whose input hash matched the stored one, so nothing was recomputed or written. */
  unchanged: number;
  classified: number;
  labelsWritten: number;
  labelsRemoved: number;
  /** Apps where no rule matched; the empty result is cached by input hash like any other. */
  withoutLabels: number;
  errorCount: number;
  errorSample: string | null;
}

const ERROR_SAMPLE_MAX_LENGTH = 300;

/** Matches the default connection pool, so overlapping writes never wait for a connection. */
const WRITE_CONCURRENCY = 3;

/** How many finished writes pass between progress reports. */
export const PROGRESS_EVERY = 500;

/**
 * Deterministic rule labels for every canonical app. Rerunnable: an unchanged input hash is
 * skipped, and a changed one replaces only that app's previous rule labels.
 */
export async function runRuleClassification(
  taxonomy: Taxonomy,
  store: ClassificationStore,
  options: {
    /** Called every `PROGRESS_EVERY` finished writes, so a long or stalled run is visible in the log. */
    onProgress?: (progress: { done: number; total: number }) => void;
  } = {},
): Promise<ClassificationSummary> {
  const labelIds = await store.syncTaxonomy(taxonomy.version, listTaxonomyLabels(taxonomy));
  const [inputs, storedHashes] = await Promise.all([
    store.loadInputs(),
    store.loadRuleInputHashes(taxonomy.version),
  ]);

  const summary: ClassificationSummary = {
    taxonomyVersion: taxonomy.version,
    rulesVersion: RULES_VERSION,
    apps: inputs.length,
    unchanged: 0,
    classified: 0,
    labelsWritten: 0,
    labelsRemoved: 0,
    withoutLabels: 0,
    errorCount: 0,
    errorSample: null,
  };
  const errors: string[] = [];

  const pending: Array<{ input: ClassificationInput; inputHash: string }> = [];
  for (const input of inputs) {
    const inputHash = classificationInputHash(input, {
      taxonomyVersion: taxonomy.version,
      classifierVersion: RULES_VERSION,
    });
    if (storedHashes.get(input.appId) === inputHash) {
      summary.unchanged += 1;
    } else {
      pending.push({ input, inputHash });
    }
  }

  let finished = 0;
  // Each app is its own transaction, so over a high-latency link the writes dominate; overlap them.
  await forEachConcurrent(pending, WRITE_CONCURRENCY, async ({ input, inputHash }) => {
    const labels: RuleLabelRow[] = applyRules(input).flatMap((label) => {
      const labelId = labelIds.get(`${label.type}:${label.slug}`);
      // A rule may only emit labels of the controlled vocabulary.
      if (!labelId || !hasLabel(taxonomy, label.type, label.slug)) return [];
      return [{ labelId, confidence: label.confidence, evidence: label.evidence }];
    });

    try {
      const result = await store.replaceRuleLabels({
        appId: input.appId,
        taxonomyVersion: taxonomy.version,
        rulesVersion: RULES_VERSION,
        inputHash,
        labels,
      });
      summary.classified += 1;
      summary.labelsWritten += result.written;
      summary.labelsRemoved += result.removed;
      if (labels.length === 0) summary.withoutLabels += 1;
    } catch (error) {
      errors.push(`${input.appId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    finished += 1;
    if (finished % PROGRESS_EVERY === 0) options.onProgress?.({ done: finished, total: pending.length });
  });

  summary.errorCount = errors.length;
  summary.errorSample = errors.length > 0 ? errors.join("; ").slice(0, ERROR_SAMPLE_MAX_LENGTH) : null;
  return summary;
}
