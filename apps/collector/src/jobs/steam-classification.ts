import {
  applyRules,
  classificationInputHash,
  hasLabel,
  listTaxonomyLabels,
  STEAM_RULES_VERSION,
  type ClassificationInput,
  type Taxonomy,
} from "@analytic-dashboard/classifier";
import type {
  AutomatedLabelRow,
  RuleLabelRow,
  SteamClassificationInputRow,
  TaxonomyLabelInput,
} from "@analytic-dashboard/db";

import type { AiClassificationStore } from "./ai-classification.js";
import type { ClassificationSummary } from "./classification.js";

/** Everything the Steam rule classification job needs from storage, so it is testable without a database. */
export interface SteamClassificationStore {
  syncTaxonomy(taxonomyVersion: string, labels: TaxonomyLabelInput[]): Promise<Map<string, string>>;
  loadInputs(): Promise<SteamClassificationInputRow[]>;
  loadRuleInputHashes(taxonomyVersion: string): Promise<Map<string, string>>;
  replaceRuleLabels(input: {
    steamAppId: string;
    taxonomyVersion: string;
    rulesVersion: string;
    inputHash: string;
    labels: RuleLabelRow[];
  }): Promise<{ written: number; removed: number }>;
}

const ERROR_SAMPLE_MAX_LENGTH = 300;

export function toClassificationInput(row: SteamClassificationInputRow): ClassificationInput {
  return {
    appId: row.steamAppId,
    listings: [
      {
        store: "steam",
        country: "global",
        title: row.title,
        description: row.description,
        storeGenres: row.genres,
        storeTags: row.tags,
        // A free game is price 0; an unknown price stays null so it is never called free or paid.
        price: row.isFree ? 0 : row.usPrice,
      },
    ],
  };
}

/**
 * What the AI reads for one Steam game. The model only sees title, "store genres", and description,
 * and its evidence must quote one of them, so Steam's genres and user tags go in as store genres.
 */
export function toAiClassificationInput(row: SteamClassificationInputRow): ClassificationInput {
  return {
    appId: row.steamAppId,
    listings: [
      {
        store: "steam",
        country: "global",
        title: row.title,
        description: row.description,
        storeGenres: [...new Set([...row.genres, ...row.tags])],
        price: row.isFree ? 0 : row.usPrice,
      },
    ],
  };
}

/** Storage the Steam AI job needs; the generic AI job sees it as `appId` = Steam game id. */
export interface SteamAiBackend {
  syncTaxonomy(taxonomyVersion: string, labels: TaxonomyLabelInput[]): Promise<Map<string, string>>;
  loadInputs(): Promise<SteamClassificationInputRow[]>;
  loadAiInputHashes(taxonomyVersion: string): Promise<Map<string, string>>;
  replaceAiLabels(input: {
    steamAppId: string;
    taxonomyVersion: string;
    promptVersion: string;
    model: string;
    inputHash: string;
    labels: AutomatedLabelRow[];
  }): Promise<{ written: number; removed: number }>;
}

/** Lets the shared AI classification job run over Steam games without knowing about Steam. */
export function toAiClassificationStore(backend: SteamAiBackend): AiClassificationStore {
  return {
    syncTaxonomy: (version, labels) => backend.syncTaxonomy(version, labels),
    loadInputs: async () => (await backend.loadInputs()).map(toAiClassificationInput),
    loadAiInputHashes: (version) => backend.loadAiInputHashes(version),
    replaceAiLabels: ({ appId, ...rest }) => backend.replaceAiLabels({ steamAppId: appId, ...rest }),
  };
}

/**
 * Deterministic rule labels for every Steam game. Rerunnable: an unchanged input hash is skipped,
 * and a changed one replaces only that game's previous rule labels.
 */
export async function runSteamRuleClassification(
  taxonomy: Taxonomy,
  store: SteamClassificationStore,
): Promise<ClassificationSummary> {
  const labelIds = await store.syncTaxonomy(taxonomy.version, listTaxonomyLabels(taxonomy));
  const [rows, storedHashes] = await Promise.all([
    store.loadInputs(),
    store.loadRuleInputHashes(taxonomy.version),
  ]);

  const summary: ClassificationSummary = {
    taxonomyVersion: taxonomy.version,
    rulesVersion: STEAM_RULES_VERSION,
    apps: rows.length,
    unchanged: 0,
    classified: 0,
    labelsWritten: 0,
    labelsRemoved: 0,
    withoutLabels: 0,
    errorCount: 0,
    errorSample: null,
  };
  const errors: string[] = [];

  for (const row of rows) {
    const input = toClassificationInput(row);
    const inputHash = classificationInputHash(input, {
      taxonomyVersion: taxonomy.version,
      classifierVersion: STEAM_RULES_VERSION,
    });
    if (storedHashes.get(row.steamAppId) === inputHash) {
      summary.unchanged += 1;
      continue;
    }

    const labels: RuleLabelRow[] = applyRules(input).flatMap((label) => {
      const labelId = labelIds.get(`${label.type}:${label.slug}`);
      if (!labelId || !hasLabel(taxonomy, label.type, label.slug)) return [];
      return [{ labelId, confidence: label.confidence, evidence: label.evidence }];
    });

    try {
      const result = await store.replaceRuleLabels({
        steamAppId: row.steamAppId,
        taxonomyVersion: taxonomy.version,
        rulesVersion: STEAM_RULES_VERSION,
        inputHash,
        labels,
      });
      summary.classified += 1;
      summary.labelsWritten += result.written;
      summary.labelsRemoved += result.removed;
      if (labels.length === 0) summary.withoutLabels += 1;
    } catch (error) {
      errors.push(`${row.steamAppId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  summary.errorCount = errors.length;
  summary.errorSample = errors.length > 0 ? errors.join("; ").slice(0, ERROR_SAMPLE_MAX_LENGTH) : null;
  return summary;
}
