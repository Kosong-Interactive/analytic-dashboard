import { z } from "zod";

export const appleSoftwareResultSchema = z
  .object({
    wrapperType: z.literal("software"),
    kind: z.literal("software"),
    trackId: z.number().int().positive(),
    trackName: z.string().trim().min(1),
    bundleId: z.string().trim().min(1).optional(),
    sellerName: z.string().trim().min(1).optional(),
    artistName: z.string().trim().min(1).optional(),
    sellerId: z.number().int().positive().optional(),
    artistId: z.number().int().positive().optional(),
    primaryGenreName: z.string().trim().min(1).optional(),
    genres: z.array(z.string()).optional(),
    genreIds: z.array(z.string()).optional(),
    releaseDate: z.iso.datetime({ offset: true }).optional(),
    currentVersionReleaseDate: z.iso.datetime({ offset: true }).optional(),
    version: z.string().trim().min(1).optional(),
    averageUserRating: z.number().min(0).max(5).optional(),
    userRatingCount: z.number().int().nonnegative().optional(),
    price: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    formattedPrice: z.string().optional(),
    artworkUrl512: z.url().optional(),
    artworkUrl100: z.url().optional(),
    trackViewUrl: z.url(),
    description: z.string().optional(),
  })
  .loose();

export const appleSearchResponseSchema = z.object({
  resultCount: z.number().int().nonnegative(),
  results: z.array(appleSoftwareResultSchema),
});

export type AppleSoftwareResult = z.infer<typeof appleSoftwareResultSchema>;
