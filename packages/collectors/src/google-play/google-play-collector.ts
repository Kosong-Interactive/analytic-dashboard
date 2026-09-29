import { createHash } from "node:crypto";

import {
  countryCodeSchema,
  localeSchema,
  type CountryCode,
} from "@analytic-dashboard/shared";
import googlePlayScraper from "@mradex77/google-play-scraper";
import { z } from "zod";

import {
  normalizedStoreAppSchema,
  type ChartObservation,
  type NormalizedStoreApp,
  type StoreCollectorAdapter,
} from "../contracts.js";

const searchInputSchema = z.object({
  term: z.string().trim().min(1).max(200),
  country: countryCodeSchema,
  locale: localeSchema,
  limit: z.number().int().min(1).max(25).default(10),
});

const lookupInputSchema = z.object({
  externalIds: z.array(z.string().trim().min(1).max(255)).min(1).max(25),
  country: countryCodeSchema,
  locale: localeSchema,
});

const chartInputSchema = z.object({
  country: countryCodeSchema,
  locale: localeSchema,
  limit: z.number().int().min(1).max(25).default(10),
  collection: z.enum(["TOP_FREE", "TOP_PAID", "GROSSING"]).default("TOP_FREE"),
});

const optionalText = z.string().trim().min(1).nullable().optional();
const optionalCount = z.number().int().nonnegative().nullable().optional();

const appSchema = z.object({
  appId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  developer: optionalText,
  developerId: optionalText,
  genre: optionalText,
  genreId: optionalText,
  released: z.string().nullable().optional(),
  version: optionalText,
  icon: z.url().nullable().optional(),
  url: z.url(),
  score: z.number().min(0).max(5).nullable().optional(),
  ratings: optionalCount,
  reviews: optionalCount,
  minInstalls: optionalCount,
  maxInstalls: optionalCount,
  price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
});

type ScraperCollection = "TOP_FREE" | "TOP_PAID" | "GROSSING";

export type GooglePlaySearchInput = z.input<typeof searchInputSchema>;
export type GooglePlayLookupInput = z.input<typeof lookupInputSchema>;
export type GooglePlayChartInput = z.input<typeof chartInputSchema>;

export interface GooglePlayScraperClient {
  app(input: {
    appId: string;
    country: string;
    lang: string;
    throttle?: number;
  }): Promise<unknown>;
  search(input: {
    term: string;
    country: string;
    lang: string;
    num: number;
    fullDetail: true;
    throttle?: number;
  }): Promise<unknown[]>;
  list(input: {
    category: "GAME";
    collection: ScraperCollection;
    country: string;
    lang: string;
    num: number;
    fullDetail: true;
    throttle?: number;
  }): Promise<unknown[]>;
}

export interface GooglePlayCollectorOptions {
  client?: GooglePlayScraperClient;
  now?: () => Date;
  cacheTtlMs?: number;
  minimumRequestIntervalMs?: number;
  retryAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class GooglePlayCollectorError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GooglePlayCollectorError";
  }
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

/** Collector-only boundary for the unofficial provider, so it can be replaced without changing consumers. */
export class GooglePlayCollector
  implements StoreCollectorAdapter<GooglePlaySearchInput, GooglePlayLookupInput>
{
  private readonly client: GooglePlayScraperClient;
  private readonly now: () => Date;
  private readonly cacheTtlMs: number;
  private readonly minimumRequestIntervalMs: number;
  private readonly retryAttempts: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly cache = new Map<string, CacheEntry>();
  private nextRequestAt = 0;

  constructor(options: GooglePlayCollectorOptions = {}) {
    this.client =
      options.client ?? (googlePlayScraper as GooglePlayScraperClient);
    this.now = options.now ?? (() => new Date());
    this.cacheTtlMs = options.cacheTtlMs ?? 21_600_000;
    this.minimumRequestIntervalMs = options.minimumRequestIntervalMs ?? 1_500;
    this.retryAttempts = options.retryAttempts ?? 2;
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async searchGames(input: GooglePlaySearchInput): Promise<NormalizedStoreApp[]> {
    const parsed = searchInputSchema.parse(input);

    return this.getOrFetch(`search:${JSON.stringify(parsed)}`, async () => {
      const results = await this.execute(() =>
        this.client.search({
          term: parsed.term,
          country: parsed.country,
          lang: toLanguage(parsed.locale),
          num: parsed.limit,
          fullDetail: true,
          throttle: 1,
        }),
      );
      return this.normalizeGames(results, parsed.country, parsed.locale);
    });
  }

  async lookupGames(input: GooglePlayLookupInput): Promise<NormalizedStoreApp[]> {
    const parsed = lookupInputSchema.parse(input);

    return this.getOrFetch(`lookup:${JSON.stringify(parsed)}`, async () => {
      const results: unknown[] = [];
      for (const appId of parsed.externalIds) {
        results.push(
          await this.execute(() =>
            this.client.app({
              appId,
              country: parsed.country,
              lang: toLanguage(parsed.locale),
              throttle: 1,
            }),
          ),
        );
      }
      return this.normalizeGames(results, parsed.country, parsed.locale);
    });
  }

  async discoverTopGames(input: GooglePlayChartInput): Promise<NormalizedStoreApp[]> {
    const entries = await this.discoverTopGameEntries(input);
    return entries.map((entry) => entry.app);
  }

  /** Ranks are the provider's 1-based list positions, kept even when an earlier item is dropped. */
  async discoverTopGameEntries(input: GooglePlayChartInput): Promise<ChartObservation[]> {
    const parsed = chartInputSchema.parse(input);

    return this.getOrFetch(`chart-entries:${JSON.stringify(parsed)}`, async () => {
      const results = await this.execute(() =>
        this.client.list({
          category: "GAME",
          collection: parsed.collection,
          country: parsed.country,
          lang: toLanguage(parsed.locale),
          num: parsed.limit,
          fullDetail: true,
          throttle: 1,
        }),
      );
      return this.normalizeEntries(results, parsed.country, parsed.locale);
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async getOrFetch<T>(key: string, request: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now().getTime()) {
      return cached.value as T;
    }

    const value = await request();
    this.cache.set(key, {
      value,
      expiresAt: this.now().getTime() + this.cacheTtlMs,
    });
    return value;
  }

  private async execute<T>(request: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt += 1) {
      await this.waitForTurn();
      try {
        return await request();
      } catch (error) {
        lastError = error;
        if (attempt === this.retryAttempts || !isRetryable(error)) {
          break;
        }
        await this.sleep(500 * 2 ** attempt);
      }
    }

    throw new GooglePlayCollectorError("Google Play request failed", lastError);
  }

  private async waitForTurn(): Promise<void> {
    const now = this.now().getTime();
    const waitMs = Math.max(0, this.nextRequestAt - now);
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
    this.nextRequestAt =
      Math.max(now, this.nextRequestAt) + this.minimumRequestIntervalMs;
  }

  private normalizeGames(
    results: unknown[],
    country: CountryCode,
    locale: string,
  ): NormalizedStoreApp[] {
    return this.normalizeEntries(results, country, locale).map(
      (entry) => entry.app,
    );
  }

  private normalizeEntries(
    results: unknown[],
    country: CountryCode,
    locale: string,
  ): ChartObservation[] {
    const capturedAt = this.now().toISOString();
    const entries: ChartObservation[] = [];

    results.forEach((result, index) => {
      const parsed = appSchema.safeParse(result);
      if (parsed.success && parsed.data.genreId?.startsWith("GAME") === true) {
        entries.push({
          rank: index + 1,
          app: normalizeGame(parsed.data, country, locale, capturedAt),
        });
      }
    });

    return entries;
  }
}

function toLanguage(locale: string): string {
  return locale.split("_")[0] ?? "en";
}

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate.?limit|timeout|network|socket|ECONN|fetch failed/i.test(
    message,
  );
}

function normalizeGame(
  result: z.output<typeof appSchema>,
  country: CountryCode,
  locale: string,
  capturedAt: string,
): NormalizedStoreApp {
  const metadata = {
    title: result.title,
    description: result.description ?? null,
    developerName: result.developer ?? null,
    developerExternalId: result.developerId ?? null,
    storeCategory: result.genre ?? result.genreId ?? null,
    releaseDate: toIsoDate(result.released),
    currentVersion: result.version ?? null,
    iconUrl: result.icon ?? null,
    storeUrl: result.url,
  };
  const metadataHash = createHash("sha256")
    .update(JSON.stringify(metadata))
    .digest("hex");

  return normalizedStoreAppSchema.parse({
    store: "google_play",
    externalId: result.appId,
    country,
    locale,
    ...metadata,
    metadataHash,
    rawMetadata: result,
    snapshot: {
      capturedAt,
      rating: result.score ?? null,
      ratingCount: result.ratings ?? null,
      reviewCount: result.reviews ?? null,
      minInstalls: result.minInstalls ?? null,
      maxInstalls: result.maxInstalls ?? null,
      price: result.price ?? null,
      currency: result.currency ?? null,
      version: result.version ?? null,
    },
  });
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
