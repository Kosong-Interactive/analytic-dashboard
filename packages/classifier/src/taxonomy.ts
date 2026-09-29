import { taxonomyLabelTypes, type TaxonomyLabelType } from "@analytic-dashboard/shared";
import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, "Slugs are lower snake_case");
const labelMapSchema = z.record(slugSchema, z.string().trim().min(1));

export const taxonomySchema = z.object({
  version: z.string().regex(/^taxonomy-v\d+$/),
  labels: z.object(
    Object.fromEntries(taxonomyLabelTypes.map((type) => [type, labelMapSchema])) as Record<
      TaxonomyLabelType,
      typeof labelMapSchema
    >,
  ),
});

export type Taxonomy = z.infer<typeof taxonomySchema>;

export interface TaxonomyLabel {
  type: TaxonomyLabelType;
  slug: string;
  displayName: string;
}

/** The controlled vocabulary; nothing outside it may be assigned. */
export function parseTaxonomy(input: unknown): Taxonomy {
  return taxonomySchema.parse(input);
}

export function listTaxonomyLabels(taxonomy: Taxonomy): TaxonomyLabel[] {
  return taxonomyLabelTypes.flatMap((type) =>
    Object.entries(taxonomy.labels[type]).map(([slug, displayName]) => ({
      type,
      slug,
      displayName,
    })),
  );
}

export function hasLabel(taxonomy: Taxonomy, type: TaxonomyLabelType, slug: string): boolean {
  return Object.hasOwn(taxonomy.labels[type], slug);
}
