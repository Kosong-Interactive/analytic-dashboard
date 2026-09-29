import type { TaxonomyLabelType } from "@analytic-dashboard/shared";
import { z } from "zod";

import type { ClassificationInput } from "../input.js";
import { listTaxonomyLabels, type Taxonomy } from "../taxonomy.js";

/** Bump whenever the instructions, input shaping, or output contract below change. */
export const AI_PROMPT_VERSION = "ai-v1";

const DESCRIPTION_CHARS = 1_500;
const MAX_LABELS_PER_APP = 20;
const EXCERPT_MAX = 200;

export interface AiLabel {
  type: TaxonomyLabelType;
  slug: string;
  confidence: number;
  evidence: Array<{ field: "title" | "description" | "store_category"; excerpt: string }>;
}

export interface AiAppResult {
  appId: string;
  labels: AiLabel[];
  /** Labels dropped because they were outside the taxonomy or their evidence was not in the input. */
  rejected: number;
}

/** The text the model sees for one app, and the only text its evidence may quote. */
interface PromptApp {
  id: string;
  title: string;
  storeGenres: string[];
  description: string;
}

export function toPromptApps(inputs: readonly ClassificationInput[]): PromptApp[] {
  return inputs.map((input, index) => {
    // Prefer an English storefront; descriptions of the same app are usually near-identical.
    const listing =
      [...input.listings].sort((a, b) => rankListing(b) - rankListing(a))[0] ?? input.listings[0];
    const genres = [...new Set(input.listings.flatMap((l) => l.storeGenres))].filter(
      (genre) => !["Games", "Entertainment", "Family"].includes(genre),
    );
    return {
      id: `app${index + 1}`,
      title: listing?.title ?? "",
      storeGenres: genres,
      description: (listing?.description ?? "").replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_CHARS),
    };
  });
}

function rankListing(listing: ClassificationInput["listings"][number]): number {
  return (listing.country === "us" ? 2 : 0) + (listing.description ? 1 : 0);
}

export function buildSystemInstruction(taxonomy: Taxonomy): string {
  const vocabulary = listTaxonomyLabels(taxonomy)
    .map((label) => `${label.type}:${label.slug} (${label.displayName})`)
    .join("\n");
  return [
    "You label mobile games for market research using a fixed vocabulary.",
    "Rules:",
    "- Use only labels from the vocabulary below, written exactly as type:slug.",
    "- Only assign a label that the given title, store genres, or description clearly supports.",
    "- Every label needs at least one evidence item whose excerpt is copied verbatim (a short phrase) from that app's title, store genres, or description.",
    "- Confidence is 0 to 1: 0.9+ when stated explicitly, 0.6-0.8 when strongly implied, omit anything weaker.",
    "- Descriptions often advertise other games or list generic features; do not label from those.",
    "- Monetization labels need explicit wording (e.g. 'in-app purchases', 'ads'); do not guess.",
    "- Return every input app id exactly once, with an empty list if nothing applies.",
    "",
    "Vocabulary:",
    vocabulary,
  ].join("\n");
}

export function buildUserPrompt(apps: readonly PromptApp[]): string {
  return JSON.stringify({ apps: apps.map(({ id, title, storeGenres, description }) => ({ id, title, storeGenres, description })) });
}

/** JSON schema handed to the model; Zod below re-validates whatever comes back. */
export function responseJsonSchema(taxonomy: Taxonomy): Record<string, unknown> {
  const labels = listTaxonomyLabels(taxonomy).map((label) => `${label.type}:${label.slug}`);
  return {
    type: "object",
    properties: {
      apps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            labels: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", enum: labels },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  evidence: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field: { type: "string", enum: ["title", "description", "store_category"] },
                        excerpt: { type: "string" },
                      },
                      required: ["field", "excerpt"],
                    },
                  },
                },
                required: ["label", "confidence", "evidence"],
              },
            },
          },
          required: ["id", "labels"],
        },
      },
    },
    required: ["apps"],
  };
}

const responseSchema = z.object({
  apps: z.array(
    z.object({
      id: z.string(),
      labels: z.array(
        z.object({
          label: z.string(),
          confidence: z.number().min(0).max(1),
          evidence: z.array(z.object({ field: z.enum(["title", "description", "store_category"]), excerpt: z.string() })),
        }),
      ),
    }),
  ),
});

export class AiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiResponseError";
  }
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Validates model output against the schema, the taxonomy, and the input itself: evidence must
 * quote text the model was actually given. Labels failing any check are dropped and counted.
 */
export function parseAiResponse(
  raw: string,
  inputs: readonly ClassificationInput[],
  taxonomy: Taxonomy,
): AiAppResult[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiResponseError("Model output was not valid JSON");
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new AiResponseError("Model output did not match the response schema");

  const apps = toPromptApps(inputs);
  const byId = new Map(parsed.data.apps.map((app) => [app.id, app]));
  const allowed = new Set(listTaxonomyLabels(taxonomy).map((l) => `${l.type}:${l.slug}`));

  return apps.map((app, index): AiAppResult => {
    const input = inputs[index];
    if (!input) throw new AiResponseError("Input and prompt apps are out of sync");
    const answer = byId.get(app.id);
    if (!answer) return { appId: input.appId, labels: [], rejected: 0 };

    const sources = {
      title: normalize(app.title),
      description: normalize(app.description),
      store_category: normalize(app.storeGenres.join(" ")),
    };
    const labels = new Map<string, AiLabel>();
    let rejected = 0;

    for (const item of answer.labels.slice(0, MAX_LABELS_PER_APP)) {
      const [type, slug] = item.label.split(":") as [TaxonomyLabelType, string];
      const evidence = item.evidence
        .map((e) => ({ field: e.field, excerpt: e.excerpt.trim().slice(0, EXCERPT_MAX) }))
        .filter((e) => e.excerpt.length >= 3 && sources[e.field].includes(normalize(e.excerpt)));
      if (!allowed.has(item.label) || evidence.length === 0) {
        rejected += 1;
        continue;
      }
      const current = labels.get(item.label);
      if (!current || item.confidence > current.confidence) {
        labels.set(item.label, { type, slug, confidence: item.confidence, evidence: evidence.slice(0, 3) });
      }
    }
    return { appId: input.appId, labels: [...labels.values()], rejected };
  });
}
