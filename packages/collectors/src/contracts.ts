import { countryCodeSchema, localeSchema, storeSchema } from "@analytic-dashboard/shared";
import { z } from "zod";

const nullableNonnegativeInteger = z.number().int().nonnegative().nullable();

export const normalizedStoreAppSchema = z.object({
  store: storeSchema,
  externalId: z.string().trim().min(1),
  country: countryCodeSchema,
  locale: localeSchema,
  title: z.string().trim().min(1),
  description: z.string().nullable(),
  developerName: z.string().trim().min(1).nullable(),
  developerExternalId: z.string().trim().min(1).nullable(),
  storeCategory: z.string().trim().min(1).nullable(),
  releaseDate: z.iso.datetime({ offset: true }).nullable(),
  currentVersion: z.string().trim().min(1).nullable(),
  iconUrl: z.url().nullable(),
  storeUrl: z.url(),
  metadataHash: z.string().regex(/^[a-f0-9]{64}$/),
  rawMetadata: z.record(z.string(), z.unknown()),
  snapshot: z.object({
    capturedAt: z.iso.datetime({ offset: true }),
    rating: z.number().min(0).max(5).nullable(),
    ratingCount: nullableNonnegativeInteger,
    reviewCount: nullableNonnegativeInteger,
    minInstalls: nullableNonnegativeInteger,
    maxInstalls: nullableNonnegativeInteger,
    price: z.number().nonnegative().nullable(),
    currency: z.string().length(3).toUpperCase().nullable(),
    version: z.string().trim().min(1).nullable(),
  }),
});

export type NormalizedStoreApp = z.infer<typeof normalizedStoreAppSchema>;

export interface ChartObservation {
  rank: number;
  app: NormalizedStoreApp;
}

export interface StoreCollectorAdapter<
  TSearchInput,
  TLookupInput = TSearchInput,
> {
  searchGames(input: TSearchInput): Promise<NormalizedStoreApp[]>;
  lookupGames(input: TLookupInput): Promise<NormalizedStoreApp[]>;
}

/** Why an upstream item was left out of a batch. Reported so runs can show what was dropped. */
export type CollectorSkipReason = "invalid" | "non_game";

/** Optional observability hooks; adapters call them but never depend on them. */
export interface CollectorEvents {
  onSkipped?(reason: CollectorSkipReason): void;
  onRetry?(): void;
}
