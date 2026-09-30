import { createHash } from "node:crypto";

import {
  countryCodeSchema,
  localeSchema,
  type CountryCode,
} from "@analytic-dashboard/shared";
import { z } from "zod";

import {
  normalizedStoreAppSchema,
  type ChartObservation,
  type CollectorEvents,
  type NormalizedStoreApp,
  type StoreCollectorAdapter,
} from "../contracts.js";
import {
  appleChartFeedSchema,
  appleSearchResponseSchema,
  type AppleSoftwareResult,
} from "./schemas.js";

const appleSearchInputSchema = z.object({
  term: z.string().trim().min(1).max(200),
  country: countryCodeSchema,
  locale: localeSchema,
  limit: z.number().int().min(1).max(200).default(50),
});

const appleLookupInputSchema = z.object({
  externalIds: z.array(z.string().regex(/^\d+$/)).min(1).max(200),
  country: countryCodeSchema,
  locale: localeSchema,
});

/** Chart names shared with Google Play, mapped to Apple's classic RSS feed names. */
export const APPLE_CHART_FEEDS = {
  TOP_FREE: "topfreeapplications",
  TOP_PAID: "toppaidapplications",
  GROSSING: "topgrossingapplications",
} as const;

const GAMES_GENRE_ID = "6014";

const appleChartInputSchema = z.object({
  collection: z.enum(["TOP_FREE", "TOP_PAID", "GROSSING"]).default("TOP_FREE"),
  country: countryCodeSchema,
  locale: localeSchema,
  limit: z.number().int().min(1).max(200).default(100),
});

export type AppleChartInput = z.input<typeof appleChartInputSchema>;
export type AppleSearchInput = z.input<typeof appleSearchInputSchema>;
export type AppleLookupInput = z.input<typeof appleLookupInputSchema>;

export interface AppleSearchCollectorOptions {
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  events?: CollectorEvents;
  /** Spacing between requests. Apple documents roughly 20 calls per minute for this API. */
  minimumRequestIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class AppleSearchApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AppleSearchApiError";
  }
}

export class AppleSearchCollector
  implements StoreCollectorAdapter<AppleSearchInput, AppleLookupInput>
{
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => Date;
  private readonly timeoutMs: number;
  private readonly events: CollectorEvents;
  private readonly minimumRequestIntervalMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private nextRequestAt = 0;

  constructor(options: AppleSearchCollectorOptions = {}) {
    this.events = options.events ?? {};
    this.minimumRequestIntervalMs = options.minimumRequestIntervalMs ?? 3_000;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.baseUrl = options.baseUrl ?? "https://itunes.apple.com";
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async searchGames(input: AppleSearchInput): Promise<NormalizedStoreApp[]> {
    const parsedInput = appleSearchInputSchema.parse(input);
    const url = new URL("/search", this.baseUrl);
    url.searchParams.set("term", parsedInput.term);
    url.searchParams.set("country", parsedInput.country);
    url.searchParams.set("media", "software");
    url.searchParams.set("entity", "software");
    url.searchParams.set("limit", String(parsedInput.limit));
    url.searchParams.set("explicit", "No");

    return this.requestAndNormalize(url, parsedInput.country, parsedInput.locale);
  }

  async lookupGames(input: AppleLookupInput): Promise<NormalizedStoreApp[]> {
    const parsedInput = appleLookupInputSchema.parse(input);
    const url = new URL("/lookup", this.baseUrl);
    url.searchParams.set("id", parsedInput.externalIds.join(","));
    url.searchParams.set("country", parsedInput.country);
    url.searchParams.set("entity", "software");

    return this.requestAndNormalize(url, parsedInput.country, parsedInput.locale);
  }

  /**
   * The Games chart of one storefront with each game's position. The RSS feed only lists ids and
   * order; details come from one lookup request. A game the lookup does not return is left out and
   * keeps no rank, so ranks may have gaps but are never reassigned.
   */
  async discoverTopGameEntries(input: AppleChartInput): Promise<ChartObservation[]> {
    const parsed = appleChartInputSchema.parse(input);
    const url = new URL(
      `/${parsed.country}/rss/${APPLE_CHART_FEEDS[parsed.collection]}/limit=${parsed.limit}/genre=${GAMES_GENRE_ID}/json`,
      this.baseUrl,
    );

    const payload = await this.requestJson(url, "Apple chart feed");
    const feed = appleChartFeedSchema.safeParse(payload);
    if (!feed.success) {
      throw new AppleSearchApiError(
        `Apple chart feed response validation failed: ${z.prettifyError(feed.error)}`,
      );
    }

    const orderedIds = [...new Set(feed.data.feed.entry.map((entry) => entry.id.attributes["im:id"]))];
    if (orderedIds.length === 0) return [];

    const apps = await this.lookupGames({
      externalIds: orderedIds,
      country: parsed.country,
      locale: parsed.locale,
    });
    const byId = new Map(apps.map((app) => [app.externalId, app]));
    return orderedIds.flatMap((externalId, index) => {
      const app = byId.get(externalId);
      return app ? [{ rank: index + 1, app }] : [];
    });
  }

  private async requestAndNormalize(
    url: URL,
    country: CountryCode,
    locale: string,
  ): Promise<NormalizedStoreApp[]> {
    const payload = await this.requestJson(url, "Apple Search API");
    const parsedResponse = appleSearchResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      throw new AppleSearchApiError(
        `Apple Search API response validation failed: ${z.prettifyError(
          parsedResponse.error,
        )}`,
      );
    }

    const capturedAt = this.now().toISOString();

    const games: NormalizedStoreApp[] = [];
    for (const result of parsedResponse.data.results) {
      if (isGame(result)) {
        games.push(normalizeAppleGame(result, country, locale, capturedAt));
      } else {
        this.events.onSkipped?.("non_game");
      }
    }
    return games;
  }

  private async requestJson(url: URL, label: string): Promise<unknown> {
    let response: Response;
    await this.waitForTurn();

    try {
      response = await this.fetchImplementation(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AppleSearchApiError(
        `${label} request failed: ${error instanceof Error ? error.message : "unknown network error"}`,
      );
    }

    if (!response.ok) {
      throw new AppleSearchApiError(`${label} returned HTTP ${response.status}`, response.status);
    }
    return response.json();
  }

  private async waitForTurn(): Promise<void> {
    const now = this.now().getTime();
    const waitMs = Math.max(0, this.nextRequestAt - now);
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + this.minimumRequestIntervalMs;
  }
}

function isGame(result: AppleSoftwareResult): boolean {
  return (
    result.primaryGenreName === "Games" ||
    result.genres?.includes("Games") === true ||
    result.genreIds?.includes("6014") === true
  );
}

function normalizeAppleGame(
  result: AppleSoftwareResult,
  country: CountryCode,
  locale: string,
  capturedAt: string,
): NormalizedStoreApp {
  const normalizedMetadata = {
    title: result.trackName,
    description: result.description ?? null,
    developerName: result.sellerName ?? result.artistName ?? null,
    developerExternalId:
      result.sellerId?.toString() ?? result.artistId?.toString() ?? null,
    storeCategory: result.primaryGenreName ?? null,
    releaseDate: result.releaseDate ?? null,
    currentVersion: result.version ?? null,
    iconUrl: result.artworkUrl512 ?? result.artworkUrl100 ?? null,
    storeUrl: result.trackViewUrl,
  };

  const metadataHash = createHash("sha256")
    .update(JSON.stringify(normalizedMetadata))
    .digest("hex");

  return normalizedStoreAppSchema.parse({
    store: "app_store",
    externalId: String(result.trackId),
    country,
    locale,
    ...normalizedMetadata,
    metadataHash,
    rawMetadata: result,
    snapshot: {
      capturedAt,
      rating: result.averageUserRating ?? null,
      ratingCount: result.userRatingCount ?? null,
      reviewCount: null,
      minInstalls: null,
      maxInstalls: null,
      price: result.price ?? null,
      currency: result.currency ?? null,
      version: result.version ?? null,
    },
  });
}
