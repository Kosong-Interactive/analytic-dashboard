import "server-only";

import { aggregateMarketGames, scoreTrending, type MarketCoverage, type TrendingScore } from "@analytic-dashboard/analytics";
import { loadSourceHealth, loadTrendCandidates, type TrendCandidateRow } from "@analytic-dashboard/db";
import { marketCountries, type CountryCode, type Market } from "@analytic-dashboard/shared";

import { createTtlCache } from "../cache/ttl-cache";
import { getDatabase } from "../database";
import type { OverviewFilters } from "../overview/filters";
import type { ScoredSelection } from "./load-scored";

const WINDOW_DAYS = 7;
const RANK_CHART = "TOP_FREE";

export interface MarketGameInfo {
  /** Storefronts of the market that track the game. */
  countriesObserved: string[];
  /** Storefronts that produced a score for it. */
  scoredCountries: number;
  /** The storefront whose listing and score are shown. */
  shownCountry: string;
}

export interface MarketSelection extends ScoredSelection {
  market: Market;
  coverage: MarketCoverage;
  /** Per shown listing id. */
  games: Map<string, MarketGameInfo>;
}

/** Collection runs once a day, so a combined market can be reused for a few minutes per instance. */
const MARKET_CACHE_MS = 5 * 60 * 1000;
const marketCache = createTtlCache<MarketSelection>(MARKET_CACHE_MS);

/**
 * SEA or World as one selection, cached for a few minutes per server instance. Each storefront is loaded and scored inside its own cohort first;
 * then a game seen in several storefronts is counted once and shown with the median storefront's
 * score. Raw counts are never summed. Reads stored observations only.
 */
export function loadMarketSelection(
  filters: OverviewFilters,
  market: Exclude<Market, "id">,
  asOf: Date,
): Promise<MarketSelection> {
  return marketCache.get(`${market}:${filters.platform}`, () => computeMarketSelection(filters, market, asOf));
}

async function computeMarketSelection(
  filters: OverviewFilters,
  market: Exclude<Market, "id">,
  asOf: Date,
): Promise<MarketSelection> {
  const db = getDatabase();
  const countries = marketCountries[market];
  const stores =
    filters.platform === "all"
      ? (["google_play", "app_store"] as const)
      : ([filters.platform] as const);

  const [loaded, health] = await Promise.all([
    Promise.all(
      countries.flatMap((country) =>
        stores.map(async (store) => ({
          country,
          candidates: await loadTrendCandidates(db, { store, country, asOf, windowDays: WINDOW_DAYS, chartType: RANK_CHART }),
        })),
      ),
    ),
    loadSourceHealth(db, [...countries]),
  ]);

  // A cohort is one store in one storefront, so scoring everything at once keeps cohorts separate.
  const everything: TrendCandidateRow[] = loaded.flatMap((entry) => entry.candidates);
  const scores = scoreTrending(everything, { asOf, rankChartType: RANK_CHART });
  const scoreById = new Map(scores.map((score) => [score.id, score]));

  const storefronts = countries.map((country) => {
    const candidates = loaded.filter((entry) => entry.country === country).flatMap((entry) => entry.candidates);
    return {
      country: country as CountryCode,
      candidates,
      scores: candidates.flatMap((candidate): TrendingScore[] => {
        const score = scoreById.get(candidate.storeAppId);
        return score ? [score] : [];
      }),
    };
  });

  const aggregate = aggregateMarketGames({ storefronts, priority: countries, idOf: (candidate) => candidate.storeAppId });
  return {
    asOf,
    market,
    coverage: aggregate.coverage,
    candidates: aggregate.games.map((game) => game.candidate),
    scores: aggregate.games.flatMap((game) => (game.score ? [game.score as TrendingScore] : [])),
    health: health.filter((row) => filters.platform === "all" || row.source === filters.platform),
    games: new Map(
      aggregate.games.map((game) => [
        game.candidate.storeAppId,
        { countriesObserved: game.countriesObserved, scoredCountries: game.scoredCountries, shownCountry: game.shownCountry },
      ]),
    ),
  };
}
