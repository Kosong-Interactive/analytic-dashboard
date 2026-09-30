import {
  steamAppIdSchema,
  steamListingSchema,
  steamPlayerObservationSchema,
  steamPriceObservationSchema,
  steamReviewObservationSchema,
  type SteamListing,
  type SteamPlayerObservation,
  type SteamPriceObservation,
  type SteamReviewObservation,
} from "@analytic-dashboard/shared";
import { z } from "zod";

import type { CollectorEvents } from "../contracts.js";
import {
  steamCategoriesResponseSchema,
  steamItemsResponseSchema,
  steamMostPlayedResponseSchema,
  steamPlayersResponseSchema,
  steamReviewsResponseSchema,
  steamTagListResponseSchema,
  steamTopSellersResponseSchema,
  type SteamStoreItem,
} from "./schemas.js";

const API_BASE = "https://api.steampowered.com";
const ASSET_BASE = "https://shared.akamai.steamstatic.com/store_item_assets/";
const LANGUAGE = "english";
const LOCALE = "en-US";
const ITEMS_PER_REQUEST = 50;
/** `success` values the store browse service returns for a visible app. */
const ITEM_OK = 1;

/**
 * The browse service reports prices in the requested country's currency but does not name it.
 * Only these countries are priced; `symbol` checks the formatted price so a changed currency is
 * skipped instead of mislabelled.
 */
export const STEAM_PRICE_COUNTRIES = {
  us: { currency: "USD", symbol: "$" },
  id: { currency: "IDR", symbol: "Rp" },
} as const;
export type SteamPriceCountry = keyof typeof STEAM_PRICE_COUNTRIES;

export interface SteamChartEntry {
  chart: "most_played" | "top_sellers";
  rank: number;
  externalId: string;
  lastWeekRank: number | null;
}

export interface SteamListingsResult {
  listings: SteamListing[];
  prices: Map<string, SteamPriceObservation>;
  /** Requested ids the store did not return as a visible app (removed, hidden, or not an app). */
  missing: string[];
}

export interface SteamCollectorOptions {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  /** One request at a time across every endpoint; Steam allows 100,000 Web API calls a day. */
  minimumRequestIntervalMs?: number;
  cacheTtlMs?: number;
  retryAttempts?: number;
  timeoutMs?: number;
  events?: CollectorEvents;
}

export class SteamApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SteamApiError";
  }
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const appIdList = z.array(steamAppIdSchema).min(1).max(500);
const priceCountrySchema = z.enum(Object.keys(STEAM_PRICE_COUNTRIES) as [SteamPriceCountry, ...SteamPriceCountry[]]);

/**
 * Collector-only Steam boundary over the official Web API. Each call returns normalized contracts
 * from `@analytic-dashboard/shared`; provider shapes never leave this module.
 */
export class SteamCollector {
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly minimumRequestIntervalMs: number;
  private readonly cacheTtlMs: number;
  private readonly retryAttempts: number;
  private readonly timeoutMs: number;
  private readonly events: CollectorEvents;
  private readonly cache = new Map<string, CacheEntry>();
  private nextRequestAt = 0;

  constructor(options: SteamCollectorOptions) {
    if (!options.apiKey) throw new SteamApiError("A Steam Web API key is required");
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.minimumRequestIntervalMs = options.minimumRequestIntervalMs ?? 1_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 6 * 60 * 60 * 1000;
    this.retryAttempts = options.retryAttempts ?? 2;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.events = options.events ?? {};
  }

  /** Weekly most-played chart (up to 100 games), global. */
  async getMostPlayed(): Promise<SteamChartEntry[]> {
    const body = await this.request("most played", "/ISteamChartsService/GetMostPlayedGames/v1/", {}, steamMostPlayedResponseSchema);
    return body.response.ranks.map((entry) => ({
      chart: "most_played",
      rank: entry.rank,
      externalId: String(entry.appid),
      lastWeekRank: entry.last_week_rank && entry.last_week_rank > 0 ? entry.last_week_rank : null,
    }));
  }

  /** Global weekly top sellers. Country charts are not used: Steam's market here is Global. */
  async getTopSellers(input: { limit?: number } = {}): Promise<SteamChartEntry[]> {
    const limit = z.number().int().min(1).max(100).parse(input.limit ?? 100);
    const body = await this.request(
      "top sellers",
      "/IStoreTopSellersService/GetWeeklyTopSellers/v1/",
      { input_json: { country_code: "", page_start: 0, page_count: limit, context: { language: LANGUAGE, country_code: "US" } } },
      steamTopSellersResponseSchema,
    );
    return body.response.ranks.map((entry) => ({
      chart: "top_sellers",
      rank: entry.rank,
      externalId: String(entry.appid),
      lastWeekRank: entry.last_week_rank && entry.last_week_rank > 0 ? entry.last_week_rank : null,
    }));
  }

  /**
   * Store metadata for many apps (50 per request) plus each app's price in `country`. Apps the store
   * does not return as visible are reported in `missing` rather than failing the batch.
   */
  async getListings(input: { externalIds: string[]; country: SteamPriceCountry }): Promise<SteamListingsResult> {
    const externalIds = [...new Set(appIdList.parse(input.externalIds))];
    const country = priceCountrySchema.parse(input.country);
    const [tagNames, categoryNames] = await Promise.all([this.tagNames(), this.categoryNames()]);
    const capturedAt = this.now().toISOString();

    const listings: SteamListing[] = [];
    const prices = new Map<string, SteamPriceObservation>();
    const found = new Set<string>();

    for (let start = 0; start < externalIds.length; start += ITEMS_PER_REQUEST) {
      const batch = externalIds.slice(start, start + ITEMS_PER_REQUEST);
      const body = await this.request(
        "store items",
        "/IStoreBrowseService/GetItems/v1/",
        {
          input_json: {
            ids: batch.map((id) => ({ appid: Number(id) })),
            context: { language: LANGUAGE, country_code: country.toUpperCase() },
            data_request: {
              include_basic_info: true,
              include_tag_count: 20,
              include_release: true,
              include_platforms: true,
              include_assets: true,
              include_best_purchase_option: true,
            },
          },
        },
        steamItemsResponseSchema,
      );

      for (const item of body.response.store_items) {
        if (item.success !== ITEM_OK || item.visible === false || !item.appid) continue;
        const externalId = String(item.appid);
        const listing = toListing(item, { tagNames, categoryNames, capturedAt });
        if (!listing) {
          this.events.onSkipped?.("invalid");
          continue;
        }
        found.add(externalId);
        listings.push(listing);
        const price = toPrice(item, country, capturedAt);
        if (price) prices.set(externalId, price);
      }
    }

    return { listings, prices, missing: externalIds.filter((id) => !found.has(id)) };
  }

  /** Lifetime review totals across every language and purchase type; review text is never kept. */
  async getReviewSummary(externalId: string): Promise<SteamReviewObservation | null> {
    const appid = Number(steamAppIdSchema.parse(externalId));
    const body = await this.request(
      "reviews",
      "/IUserReviewsService/GetAppReviews/v1/",
      { input_json: { appid, languages: ["all"], purchase_type: 1, num_per_page: 1, filter_offtopic_activity: true } },
      steamReviewsResponseSchema,
      { withKey: false },
    );
    const summary = body.response.query_summary;
    const total = summary.total_positive + summary.total_negative;
    const parsed = steamReviewObservationSchema.safeParse({
      source: "steam_user_reviews_service",
      capturedAt: this.now().toISOString(),
      purchaseScope: "all",
      languageScope: ["all"],
      offTopicActivityFiltered: true,
      lifetime: {
        positive: summary.total_positive,
        negative: summary.total_negative,
        total,
        positiveRatio: total === 0 ? null : summary.total_positive / total,
      },
      // The service has no reliable windowed totals; a recent window stays unavailable.
      recent: null,
    });
    return parsed.success ? parsed.data : null;
  }

  /**
   * Players connected to Steam right now. Steam notes this excludes people playing offline, and a
   * non-success result means unavailable, not zero players.
   */
  async getCurrentPlayers(externalId: string): Promise<SteamPlayerObservation | null> {
    const appid = steamAppIdSchema.parse(externalId);
    let body: z.infer<typeof steamPlayersResponseSchema>;
    try {
      body = await this.request(
        "current players",
        "/ISteamUserStats/GetNumberOfCurrentPlayers/v1/",
        { appid },
        steamPlayersResponseSchema,
        { withKey: false },
      );
    } catch (error) {
      // Steam returns 404 for valid store apps that do not expose player statistics. This is a
      // missing optional observation, not a failed collection run.
      if (error instanceof SteamApiError && error.status === 404) return null;
      throw error;
    }
    if (body.response.result !== 1 || body.response.player_count === undefined) return null;
    return steamPlayerObservationSchema.parse({
      source: "steam_user_stats",
      capturedAt: this.now().toISOString(),
      currentPlayers: body.response.player_count,
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async tagNames(): Promise<Map<number, string>> {
    const body = await this.request("tag list", "/IStoreService/GetTagList/v1/", { language: LANGUAGE }, steamTagListResponseSchema);
    return new Map(body.response.tags.map((tag) => [tag.tagid, tag.name]));
  }

  private async categoryNames(): Promise<Map<number, string>> {
    const body = await this.request(
      "categories",
      "/IStoreBrowseService/GetStoreCategories/v1/",
      { input_json: { language: LANGUAGE } },
      steamCategoriesResponseSchema,
    );
    return new Map(body.response.categories.map((category) => [category.categoryid, category.display_name]));
  }

  /**
   * Cached, throttled GET with bounded retries for transient failures. Errors name the endpoint and
   * status only: the request URL carries the key and is never included.
   */
  private async request<T>(
    label: string,
    path: string,
    params: Record<string, unknown>,
    schema: z.ZodType<T>,
    options: { withKey?: boolean } = {},
  ): Promise<T> {
    const url = new URL(path, API_BASE);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, typeof value === "string" ? value : JSON.stringify(value));
    }
    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now().getTime()) return cached.value as T;
    if (options.withKey !== false) url.searchParams.set("key", this.apiKey);

    let lastError: SteamApiError | undefined;
    for (let attempt = 0; attempt <= this.retryAttempts; attempt += 1) {
      await this.waitForTurn();
      let response: Response;
      try {
        response = await this.fetchImplementation(url, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch {
        lastError = new SteamApiError(`Steam ${label} request failed before a response`);
        if (attempt < this.retryAttempts) await this.backoff(attempt);
        continue;
      }

      if (!response.ok) {
        lastError = new SteamApiError(`Steam ${label} returned HTTP ${response.status}`, response.status);
        const transient = response.status === 429 || response.status >= 500;
        if (!transient) break;
        if (attempt < this.retryAttempts) await this.backoff(attempt);
        continue;
      }

      const payload: unknown = await response.json().catch(() => undefined);
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new SteamApiError(`Steam ${label} response did not match the expected shape`);
      }
      this.cache.set(cacheKey, { value: parsed.data, expiresAt: this.now().getTime() + this.cacheTtlMs });
      return parsed.data;
    }
    throw lastError ?? new SteamApiError(`Steam ${label} request failed`);
  }

  private async backoff(attempt: number): Promise<void> {
    this.events.onRetry?.();
    await this.sleep(1_000 * 2 ** attempt + Math.floor(Math.random() * 500));
  }

  private async waitForTurn(): Promise<void> {
    const now = this.now().getTime();
    const wait = Math.max(0, this.nextRequestAt - now);
    if (wait > 0) await this.sleep(wait);
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + this.minimumRequestIntervalMs;
  }
}

function uniqueNames(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function releaseState(item: SteamStoreItem): SteamListing["releaseState"] {
  if (item.is_coming_soon || item.release?.is_coming_soon) return "upcoming";
  if (item.is_early_access || item.release?.is_early_access) return "early_access";
  if (item.release?.steam_release_date) return "released";
  return "unknown";
}

function headerImageUrl(item: SteamStoreItem): string | null {
  const format = item.assets?.asset_url_format;
  const header = item.assets?.header;
  if (!format || !header) return null;
  return `${ASSET_BASE}${format.replace("${FILENAME}", header)}`;
}

function toListing(
  item: SteamStoreItem,
  context: { tagNames: Map<number, string>; categoryNames: Map<number, string>; capturedAt: string },
): SteamListing | null {
  const tags = uniqueNames((item.tagids ?? []).map((id) => context.tagNames.get(id)));
  const categoryIds = [
    ...(item.categories?.supported_player_categoryids ?? []),
    ...(item.categories?.feature_categoryids ?? []),
    ...(item.categories?.controller_categoryids ?? []),
  ];
  const releaseSeconds = item.release?.steam_release_date;
  const parsed = steamListingSchema.safeParse({
    platform: "steam",
    externalId: String(item.appid),
    market: "global",
    locale: LOCALE,
    title: item.name?.trim() ?? "",
    description: item.basic_info?.short_description?.trim() || null,
    developerNames: uniqueNames((item.basic_info?.developers ?? []).map((entry) => entry.name)),
    publisherNames: uniqueNames((item.basic_info?.publishers ?? []).map((entry) => entry.name)),
    // Steam's official genres are not in these Web API responses, and user tags are too noisy to
    // stand in for them (live check: Dota 2 carried "Simulation"). Genres stay unknown; the tags
    // are kept as tags for classification to weigh with confidence and evidence.
    genres: [],
    categories: uniqueNames(categoryIds.map((id) => context.categoryNames.get(id))),
    tags,
    releaseState: releaseState(item),
    releaseDate: releaseSeconds ? new Date(releaseSeconds * 1000).toISOString() : null,
    supportedOperatingSystems: {
      windows: item.platforms?.windows === true,
      macos: item.platforms?.mac === true,
      linux: item.platforms?.steamos_linux === true,
    },
    isFree: item.is_free === true,
    headerImageUrl: headerImageUrl(item),
    storeUrl: `https://store.steampowered.com/app/${item.appid}/`,
    capturedAt: context.capturedAt,
    source: "steam_web_api",
  });
  return parsed.success ? parsed.data : null;
}

function toPrice(item: SteamStoreItem, country: SteamPriceCountry, capturedAt: string): SteamPriceObservation | null {
  const option = item.best_purchase_option;
  if (!option?.final_price_in_cents) return null;
  const expected = STEAM_PRICE_COUNTRIES[country];
  if (option.formatted_final_price && !option.formatted_final_price.includes(expected.symbol)) return null;

  const finalPrice = Number(option.final_price_in_cents) / 100;
  const initialPrice = option.original_price_in_cents ? Number(option.original_price_in_cents) / 100 : finalPrice;
  const parsed = steamPriceObservationSchema.safeParse({
    source: "steam_store",
    capturedAt,
    country,
    currency: expected.currency,
    initialPrice,
    finalPrice,
    discountPercent: option.discount_pct ?? 0,
  });
  return parsed.success ? parsed.data : null;
}
