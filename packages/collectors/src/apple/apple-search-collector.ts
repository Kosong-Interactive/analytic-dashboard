import { createHash } from "node:crypto";

import {
  countryCodeSchema,
  localeSchema,
  type CountryCode,
} from "@analytic-dashboard/shared";
import { z } from "zod";

import {
  normalizedStoreAppSchema,
  type NormalizedStoreApp,
  type StoreCollectorAdapter,
} from "../contracts.js";
import {
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

export type AppleSearchInput = z.input<typeof appleSearchInputSchema>;
export type AppleLookupInput = z.input<typeof appleLookupInputSchema>;

export interface AppleSearchCollectorOptions {
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
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

  constructor(options: AppleSearchCollectorOptions = {}) {
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

  private async requestAndNormalize(
    url: URL,
    country: CountryCode,
    locale: string,
  ): Promise<NormalizedStoreApp[]> {
    let response: Response;

    try {
      response = await this.fetchImplementation(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AppleSearchApiError(
        `Apple Search API request failed: ${
          error instanceof Error ? error.message : "unknown network error"
        }`,
      );
    }

    if (!response.ok) {
      throw new AppleSearchApiError(
        `Apple Search API returned HTTP ${response.status}`,
        response.status,
      );
    }

    const payload: unknown = await response.json();
    const parsedResponse = appleSearchResponseSchema.safeParse(payload);

    if (!parsedResponse.success) {
      throw new AppleSearchApiError(
        `Apple Search API response validation failed: ${z.prettifyError(
          parsedResponse.error,
        )}`,
      );
    }

    const capturedAt = this.now().toISOString();

    return parsedResponse.data.results
      .filter(isGame)
      .map((result) => normalizeAppleGame(result, country, locale, capturedAt));
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
