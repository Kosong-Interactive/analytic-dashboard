import {
  AI_PROMPT_VERSION,
  AllModelsExhaustedError,
  classificationInputHash,
  GeminiFatalError,
  listTaxonomyLabels,
  type BatchResult,
  type ClassificationInput,
  type Taxonomy,
} from "@analytic-dashboard/classifier";
import type { AutomatedLabelRow, TaxonomyLabelInput } from "@analytic-dashboard/db";

export interface AiClassificationStore {
  syncTaxonomy(taxonomyVersion: string, labels: TaxonomyLabelInput[]): Promise<Map<string, string>>;
  loadInputs(): Promise<ClassificationInput[]>;
  loadAiInputHashes(taxonomyVersion: string): Promise<Map<string, string>>;
  replaceAiLabels(input: {
    appId: string;
    taxonomyVersion: string;
    promptVersion: string;
    model: string;
    inputHash: string;
    labels: AutomatedLabelRow[];
  }): Promise<{ written: number; removed: number }>;
}

export interface AiBatchClassifier {
  classifyBatch(inputs: readonly ClassificationInput[], taxonomy: Taxonomy): Promise<BatchResult>;
}

export interface AiClassificationOptions {
  /** Upper bound per run; the rest waits for the next run thanks to the input-hash cache. */
  maxApps: number;
  batchSize: number;
}

export interface AiClassificationSummary {
  taxonomyVersion: string;
  promptVersion: string;
  pending: number;
  attempted: number;
  classified: number;
  labelsWritten: number;
  /** Labels the model proposed but that failed taxonomy or evidence checks. */
  labelsRejected: number;
  /** Apps the model returned no usable label for; the empty result is cached by input hash. */
  emptyResults: number;
  remaining: number;
  modelsUsed: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  quotaExhausted: boolean;
  errorCount: number;
  errorSample: string | null;
}

const ERROR_SAMPLE_MAX_LENGTH = 300;

/**
 * AI labels for apps whose input changed since their last AI run. Stops cleanly when every model
 * is out of quota; a fatal provider error (e.g. an invalid key) is reported as an error.
 */
export async function runAiClassification(
  taxonomy: Taxonomy,
  classifier: AiBatchClassifier,
  store: AiClassificationStore,
  options: AiClassificationOptions,
): Promise<AiClassificationSummary> {
  const labelIds = await store.syncTaxonomy(taxonomy.version, listTaxonomyLabels(taxonomy));
  const [inputs, stored] = await Promise.all([store.loadInputs(), store.loadAiInputHashes(taxonomy.version)]);
  const versions = { taxonomyVersion: taxonomy.version, classifierVersion: AI_PROMPT_VERSION };
  const pending = inputs
    .map((input) => ({ input, inputHash: classificationInputHash(input, versions) }))
    .filter(({ input, inputHash }) => stored.get(input.appId) !== inputHash);
  const selected = pending.slice(0, options.maxApps);

  const summary: AiClassificationSummary = {
    taxonomyVersion: taxonomy.version,
    promptVersion: AI_PROMPT_VERSION,
    pending: pending.length,
    attempted: 0,
    classified: 0,
    labelsWritten: 0,
    labelsRejected: 0,
    emptyResults: 0,
    remaining: pending.length,
    modelsUsed: {},
    inputTokens: 0,
    outputTokens: 0,
    quotaExhausted: false,
    errorCount: 0,
    errorSample: null,
  };
  const errors: string[] = [];

  for (let start = 0; start < selected.length; start += options.batchSize) {
    const batch = selected.slice(start, start + options.batchSize);
    let result: BatchResult;
    summary.attempted += batch.length;
    try {
      result = await classifier.classifyBatch(batch.map((item) => item.input), taxonomy);
    } catch (error) {
      if (error instanceof AllModelsExhaustedError) {
        summary.quotaExhausted = true;
        summary.attempted -= batch.length;
        break;
      }
      errors.push(`batch ${start / options.batchSize + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
      if (error instanceof GeminiFatalError) break;
      continue;
    }

    summary.modelsUsed[result.model] = (summary.modelsUsed[result.model] ?? 0) + 1;
    summary.inputTokens += result.inputTokens;
    summary.outputTokens += result.outputTokens;

    for (const [index, appResult] of result.results.entries()) {
      const item = batch[index];
      if (!item) continue;
      summary.labelsRejected += appResult.rejected;
      const labels = appResult.labels.flatMap((label) => {
        const labelId = labelIds.get(`${label.type}:${label.slug}`);
        return labelId ? [{ labelId, confidence: label.confidence, evidence: label.evidence }] : [];
      });
      try {
        const written = await store.replaceAiLabels({
          appId: item.input.appId,
          taxonomyVersion: taxonomy.version,
          promptVersion: result.promptVersion,
          model: result.model,
          inputHash: item.inputHash,
          labels,
        });
        summary.classified += 1;
        summary.labelsWritten += written.written;
        if (labels.length === 0) summary.emptyResults += 1;
      } catch (error) {
        errors.push(`${item.input.appId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  summary.remaining = pending.length - summary.classified;
  summary.errorCount = errors.length;
  summary.errorSample = errors.length > 0 ? errors.join("; ").slice(0, ERROR_SAMPLE_MAX_LENGTH) : null;
  return summary;
}
