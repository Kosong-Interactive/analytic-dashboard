import { z } from "zod";

export const taxonomyLabelTypes = [
  "genre",
  "subgenre",
  "core_mechanic",
  "meta_mechanic",
  "theme",
  "multiplayer_mode",
  "monetization_clue",
] as const;

export const taxonomyLabelTypeSchema = z.enum(taxonomyLabelTypes);
export const labelSourceSchema = z.enum(["rule", "ai", "manual"]);

export const classificationEvidenceSchema = z.object({
  field: z.enum(["title", "description", "store_category", "metadata"]),
  excerpt: z.string().trim().min(1).max(500),
});

const assignmentBaseSchema = z.object({
  appId: z.uuid(),
  labelSlug: z.string().trim().min(1),
  labelType: taxonomyLabelTypeSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(classificationEvidenceSchema),
  taxonomyVersion: z.string().trim().min(1),
  inputHash: z.string().trim().min(1),
});

export const appLabelAssignmentSchema = z.discriminatedUnion("source", [
  assignmentBaseSchema.extend({
    source: z.literal("rule"),
    promptVersion: z.null(),
    model: z.null(),
    isManualOverride: z.literal(false),
  }),
  assignmentBaseSchema.extend({
    source: z.literal("ai"),
    promptVersion: z.string().trim().min(1),
    model: z.string().trim().min(1),
    isManualOverride: z.literal(false),
  }),
  assignmentBaseSchema.extend({
    source: z.literal("manual"),
    promptVersion: z.null(),
    model: z.null(),
    isManualOverride: z.literal(true),
  }),
]);

export type TaxonomyLabelType = z.infer<typeof taxonomyLabelTypeSchema>;
export type LabelSource = z.infer<typeof labelSourceSchema>;
export type AppLabelAssignment = z.infer<typeof appLabelAssignmentSchema>;
