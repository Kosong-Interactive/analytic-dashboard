import "server-only";

import { cache } from "react";

import { loadLabelMembership, loadTrackedStorefronts } from "@analytic-dashboard/db";
import { marketCountries, marketOf } from "@analytic-dashboard/shared";

import { getDatabase } from "../database";
import { MIN_LABEL_CONFIDENCE, TAXONOMY_VERSION } from "../labels/constants";
import { loadScoredSelection } from "../scoring/load-scored";
import { getSteamTrendInputs } from "./get-steam";
import { toSteamCountry } from "./query";
import type { CompareQuery } from "./compare-query";
import type { SteamSourceStatus } from "../overview/view-model";
import { buildPlatformComparison, compareTypeValues, type ComparedPlatform, type PlatformDataset } from "./platform-compare";
import { buildSteamTrendList } from "./trend";

const emptyDataset: PlatformDataset = { games: [], membership: [], available: false };

/** One load of all three platforms. A platform that fails is reported as unavailable, not as an error. */
export const getPlatformDatasets = cache(async (country: CompareQuery["country"]) => {
  const db = getDatabase();
  const asOf = new Date();
  // The mobile side is a whole market: Indonesia, or SEA / World combined across their storefronts.
  const market = marketOf(country);
  const storefronts = marketCountries[market];

  async function mobile(store: "google_play" | "app_store"): Promise<PlatformDataset> {
    try {
      const [selection, membership] = await Promise.all([
        loadScoredSelection({ country, platform: store, market }, asOf),
        loadLabelMembership(db, {
          stores: [store],
          country,
          countries: storefronts,
          taxonomyVersion: TAXONOMY_VERSION,
          types: compareTypeValues,
          minConfidence: MIN_LABEL_CONFIDENCE,
        }),
      ]);
      const scoreById = new Map(selection.scores.map((score) => [score.id, score.score]));
      return {
        available: true,
        games: selection.candidates.map((candidate) => ({
          id: candidate.storeAppId,
          score: scoreById.get(candidate.storeAppId) ?? null,
          firstSeenAt: candidate.firstSeenAt,
        })),
        membership: membership.map((row) => ({ gameId: row.storeAppId, type: row.type, slug: row.slug, displayName: row.displayName })),
        details: new Map(selection.candidates.map((candidate) => [candidate.storeAppId, { title: candidate.title, href: `/games/${candidate.storeAppId}` }])),
      };
    } catch (error) {
      console.error(JSON.stringify({ event: "platform_compare.load_failed", store, message: error instanceof Error ? error.message : "unknown" }));
      return emptyDataset;
    }
  }

  async function steam(): Promise<{ dataset: PlatformDataset; source: SteamSourceStatus | null }> {
    try {
      const { catalog, history } = await getSteamTrendInputs(toSteamCountry(country));
      const trend = buildSteamTrendList({ games: catalog.games, history, asOf });
      const scoreById = new Map(trend.rows.map((row) => [row.game.steamAppId, row.score.score]));
      return {
        source: catalog.source,
        dataset: {
          available: true,
          games: catalog.games.map((game) => ({
            id: game.steamAppId,
            score: scoreById.get(game.steamAppId) ?? null,
            firstSeenAt: game.firstSeenAt,
          })),
          membership: catalog.membership.map((row) => ({ gameId: row.steamAppId, type: row.type, slug: row.slug, displayName: row.displayName })),
          details: new Map(catalog.games.map((game) => [game.steamAppId, { title: game.title, href: `/steam/games/${game.externalId}` }])),
        },
      };
    } catch (error) {
      console.error(JSON.stringify({ event: "platform_compare.load_failed", store: "steam", message: error instanceof Error ? error.message : "unknown" }));
      return { dataset: emptyDataset, source: null };
    }
  }

  const [steamResult, googlePlay, appStore, collected] = await Promise.all([
    steam(),
    mobile("google_play"),
    mobile("app_store"),
    loadTrackedStorefronts(db, storefronts).catch(() => [] as string[]),
  ]);
  return {
    asOf,
    market,
    /** How many of the market's storefronts have tracked games; never claimed as complete. */
    mobileCoverage: { collected: storefronts.filter((code) => collected.includes(code)), total: storefronts.length },
    steamSource: steamResult.source,
    datasets: { steam: steamResult.dataset, google_play: googlePlay, app_store: appStore } satisfies Record<ComparedPlatform, PlatformDataset>,
  };
});

/** Labels across Steam, Google Play, and App Store for one label type. */
export async function getPlatformComparison(query: CompareQuery) {
  const { datasets, asOf, market, mobileCoverage } = await getPlatformDatasets(query.country);
  return {
    asOf,
    market,
    mobileCoverage,
    comparison: buildPlatformComparison({ datasets, type: query.type, sort: query.sort, asOf, mode: query.mode }),
  };
}
