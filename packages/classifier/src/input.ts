import { createHash } from "node:crypto";

/** One store listing of a canonical app, reduced to the fields classification may read. */
export interface ClassificationListing {
  store: "app_store" | "google_play";
  country: string;
  title: string;
  description: string | null;
  /** Store-declared genres: Apple `genres`, Google `genreId` (e.g. GAME_PUZZLE). */
  storeGenres: string[];
  price: number | null;
}

export interface ClassificationInput {
  appId: string;
  listings: ClassificationListing[];
}

/**
 * Hash of everything a classifier reads plus the versions that interpret it. Same hash means
 * the result can be reused; a new taxonomy or rule version produces a new hash.
 */
export function classificationInputHash(
  input: ClassificationInput,
  versions: { taxonomyVersion: string; classifierVersion: string },
): string {
  const listings = [...input.listings]
    .sort((a, b) => `${a.store}:${a.country}`.localeCompare(`${b.store}:${b.country}`))
    .map((listing) => ({
      store: listing.store,
      country: listing.country,
      title: listing.title.trim(),
      description: listing.description?.trim() ?? null,
      storeGenres: [...listing.storeGenres].sort(),
      price: listing.price,
    }));

  return createHash("sha256")
    .update(JSON.stringify({ ...versions, listings }))
    .digest("hex");
}
