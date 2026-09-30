import { z } from "zod";

/**
 * Provider response shapes for the Steam Web API. Most of these methods are marked undocumented by
 * Valve, so only the fields the adapter reads are declared; everything else is stripped.
 */

const appId = z.number().int().positive();

export const steamMostPlayedResponseSchema = z.object({
  response: z.object({
    rollup_date: z.number().int().optional(),
    ranks: z.array(
      z.object({
        rank: z.number().int().min(1),
        appid: appId,
        last_week_rank: z.number().int().optional(),
        peak_in_game: z.number().int().nonnegative().optional(),
      }),
    ),
  }),
});

export const steamTopSellersResponseSchema = z.object({
  response: z.object({
    start_date: z.number().int().optional(),
    ranks: z
      .array(
        z.object({
          rank: z.number().int().min(1),
          appid: appId,
          last_week_rank: z.number().int().optional(),
          consecutive_weeks: z.number().int().optional(),
        }),
      )
      .default([]),
    next_page_start: z.number().int().optional(),
  }),
});

const nameList = z.array(z.object({ name: z.string() })).optional();

export const steamPurchaseOptionSchema = z.object({
  final_price_in_cents: z.string().regex(/^\d+$/).optional(),
  original_price_in_cents: z.string().regex(/^\d+$/).optional(),
  formatted_final_price: z.string().optional(),
  discount_pct: z.number().int().min(0).max(100).optional(),
});

export const steamStoreItemSchema = z.object({
  success: z.number().int(),
  visible: z.boolean().optional(),
  appid: z.number().int().nonnegative().optional(),
  id: z.number().int().optional(),
  name: z.string().optional(),
  type: z.number().int().optional(),
  is_free: z.boolean().optional(),
  is_early_access: z.boolean().optional(),
  is_coming_soon: z.boolean().optional(),
  tagids: z.array(z.number().int()).optional(),
  categories: z
    .object({
      supported_player_categoryids: z.array(z.number().int()).optional(),
      feature_categoryids: z.array(z.number().int()).optional(),
      controller_categoryids: z.array(z.number().int()).optional(),
    })
    .optional(),
  basic_info: z
    .object({
      short_description: z.string().optional(),
      publishers: nameList,
      developers: nameList,
    })
    .optional(),
  release: z
    .object({
      steam_release_date: z.number().int().optional(),
      is_coming_soon: z.boolean().optional(),
      is_early_access: z.boolean().optional(),
    })
    .optional(),
  platforms: z
    .object({
      windows: z.boolean().optional(),
      mac: z.boolean().optional(),
      steamos_linux: z.boolean().optional(),
    })
    .optional(),
  assets: z
    .object({
      asset_url_format: z.string().optional(),
      header: z.string().optional(),
    })
    .optional(),
  best_purchase_option: steamPurchaseOptionSchema.optional(),
});

export const steamItemsResponseSchema = z.object({
  response: z.object({ store_items: z.array(steamStoreItemSchema).default([]) }),
});

export const steamTagListResponseSchema = z.object({
  response: z.object({
    tags: z.array(z.object({ tagid: z.number().int(), name: z.string() })),
  }),
});

export const steamCategoriesResponseSchema = z.object({
  response: z.object({
    categories: z.array(z.object({ categoryid: z.number().int(), display_name: z.string() })),
  }),
});

/** Only `query_summary` is read; review bodies in the same response are never kept. */
export const steamReviewsResponseSchema = z.object({
  response: z.object({
    query_summary: z.object({
      total_positive: z.number().int().nonnegative(),
      total_negative: z.number().int().nonnegative(),
      total_reviews: z.number().int().nonnegative(),
      review_score_desc: z.string().optional(),
    }),
  }),
});

export const steamPlayersResponseSchema = z.object({
  response: z.object({
    player_count: z.number().int().nonnegative().optional(),
    result: z.number().int(),
  }),
});

export type SteamStoreItem = z.infer<typeof steamStoreItemSchema>;
