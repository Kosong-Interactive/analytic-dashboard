import { z } from "zod";

export const steamMarketSchema = z.literal("global");
export const steamAppIdSchema = z.string().trim().regex(/^[1-9]\d*$/, "Invalid Steam App ID");

const capturedAtSchema = z.iso.datetime({ offset: true });
const uniqueTextList = z
  .array(z.string().trim().min(1))
  .max(100)
  .superRefine((values, context) => {
    if (new Set(values.map((value) => value.toLocaleLowerCase("en-US"))).size !== values.length) {
      context.addIssue({ code: "custom", message: "Values must be unique" });
    }
  });

/**
 * Platform-specific listing metadata. This intentionally stays separate from the current mobile
 * store contract until Steam persistence and its database enum are introduced together.
 */
export const steamListingSchema = z
  .object({
    platform: z.literal("steam"),
    externalId: steamAppIdSchema,
    market: steamMarketSchema,
    locale: z.string().trim().min(2).max(32),
    title: z.string().trim().min(1),
    description: z.string().nullable(),
    developerNames: uniqueTextList,
    publisherNames: uniqueTextList,
    genres: uniqueTextList,
    categories: uniqueTextList,
    tags: uniqueTextList,
    releaseState: z.enum(["released", "early_access", "upcoming", "unknown"]),
    releaseDate: capturedAtSchema.nullable(),
    supportedOperatingSystems: z
      .object({ windows: z.boolean(), macos: z.boolean(), linux: z.boolean() })
      .strict(),
    isFree: z.boolean(),
    headerImageUrl: z.url().nullable(),
    storeUrl: z.url(),
    capturedAt: capturedAtSchema,
    source: z.enum(["steam_store", "steam_web_api"]),
  })
  .strict();

const reviewTotalsSchema = z
  .object({
    positive: z.number().int().nonnegative(),
    negative: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    positiveRatio: z.number().min(0).max(1).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.positive + value.negative !== value.total) {
      context.addIssue({ code: "custom", message: "Review totals must add up", path: ["total"] });
    }

    const expectedRatio = value.total === 0 ? null : value.positive / value.total;
    if (expectedRatio === null && value.positiveRatio !== null) {
      context.addIssue({ code: "custom", message: "An empty review set has no ratio", path: ["positiveRatio"] });
    }
    if (expectedRatio !== null && (value.positiveRatio === null || Math.abs(expectedRatio - value.positiveRatio) > 0.0001)) {
      context.addIssue({ code: "custom", message: "positiveRatio must match the review totals", path: ["positiveRatio"] });
    }
  });

export const steamReviewObservationSchema = z
  .object({
    source: z.literal("steam_user_reviews_service"),
    capturedAt: capturedAtSchema,
    purchaseScope: z.enum(["steam_purchases", "all"]),
    languageScope: z.array(z.string().trim().min(1)).min(1).max(32),
    offTopicActivityFiltered: z.boolean(),
    lifetime: reviewTotalsSchema,
    recent: reviewTotalsSchema.safeExtend({ windowDays: z.number().int().min(1).max(365) }).nullable(),
  })
  .strict();

export const steamPlayerObservationSchema = z
  .object({
    source: z.literal("steam_user_stats"),
    capturedAt: capturedAtSchema,
    currentPlayers: z.number().int().nonnegative(),
  })
  .strict();

export const steamChartObservationSchema = z
  .object({
    source: z.literal("steam_charts"),
    capturedAt: capturedAtSchema,
    chart: z.enum(["top_sellers", "most_played", "steam_deck"]),
    rank: z.number().int().min(1).max(100),
  })
  .strict();

/** Steam prices are regional even though the platform-level research market is Global. */
export const steamPriceObservationSchema = z
  .object({
    source: z.literal("steam_store"),
    capturedAt: capturedAtSchema,
    country: z.string().trim().toLowerCase().regex(/^[a-z]{2}$/),
    currency: z.string().trim().toUpperCase().length(3),
    initialPrice: z.number().nonnegative(),
    finalPrice: z.number().nonnegative(),
    discountPercent: z.number().int().min(0).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.finalPrice > value.initialPrice) {
      context.addIssue({ code: "custom", message: "finalPrice cannot exceed initialPrice", path: ["finalPrice"] });
    }
  });

/**
 * One normalized Steam observation assembled from independently collected public signals. Null and
 * empty groups mean unavailable, never zero. Each group retains its own source and capture time.
 */
export const steamObservationSchema = z
  .object({
    platform: z.literal("steam"),
    externalId: steamAppIdSchema,
    market: steamMarketSchema,
    assembledAt: capturedAtSchema,
    reviews: steamReviewObservationSchema.nullable(),
    players: steamPlayerObservationSchema.nullable(),
    charts: z.array(steamChartObservationSchema).max(3),
    prices: z.array(steamPriceObservationSchema).max(32),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.reviews === null && value.players === null && value.charts.length === 0 && value.prices.length === 0) {
      context.addIssue({ code: "custom", message: "At least one observed Steam signal is required" });
    }

    const chartTypes = value.charts.map((entry) => entry.chart);
    if (new Set(chartTypes).size !== chartTypes.length) {
      context.addIssue({ code: "custom", message: "Chart observations must be unique per chart", path: ["charts"] });
    }

    const priceMarkets = value.prices.map((entry) => `${entry.country}:${entry.currency}`);
    if (new Set(priceMarkets).size !== priceMarkets.length) {
      context.addIssue({ code: "custom", message: "Price observations must be unique per country and currency", path: ["prices"] });
    }
  });

export type SteamListing = z.infer<typeof steamListingSchema>;
export type SteamReviewObservation = z.infer<typeof steamReviewObservationSchema>;
export type SteamPlayerObservation = z.infer<typeof steamPlayerObservationSchema>;
export type SteamChartObservation = z.infer<typeof steamChartObservationSchema>;
export type SteamPriceObservation = z.infer<typeof steamPriceObservationSchema>;
export type SteamObservation = z.infer<typeof steamObservationSchema>;
