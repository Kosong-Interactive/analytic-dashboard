import { steamListingSchema, steamObservationSchema } from "@analytic-dashboard/shared";

import { SteamCollector } from "./steam-collector.js";

/**
 * Manual, low-volume live contract check (about 9 requests). Needs STEAM_WEB_API_KEY in the
 * environment; prints counts and sample values only, never the key.
 */
const apiKey = process.env.STEAM_WEB_API_KEY;
if (!apiKey) {
  console.error("Set STEAM_WEB_API_KEY to run the Steam smoke test.");
  process.exit(1);
}

const steam = new SteamCollector({ apiKey });
const mostPlayed = (await steam.getMostPlayed()).slice(0, 3);
const topSellers = await steam.getTopSellers({ limit: 3 });
const ids = [...new Set([...mostPlayed, ...topSellers].map((entry) => entry.externalId))].slice(0, 2);
const { listings, prices, missing } = await steam.getListings({ externalIds: ids, country: "us" });
for (const listing of listings) steamListingSchema.parse(listing);

const sample = listings[0];
const observation = sample
  ? steamObservationSchema.parse({
      platform: "steam",
      externalId: sample.externalId,
      market: "global",
      assembledAt: new Date().toISOString(),
      reviews: await steam.getReviewSummary(sample.externalId),
      players: await steam.getCurrentPlayers(sample.externalId),
      charts: [],
      prices: prices.has(sample.externalId) ? [prices.get(sample.externalId)] : [],
    })
  : null;

console.info(
  JSON.stringify({
    source: "steam",
    mostPlayed: mostPlayed.map((entry) => `${entry.rank}:${entry.externalId}`),
    topSellers: topSellers.map((entry) => `${entry.rank}:${entry.externalId}`),
    listings: listings.map((listing) => ({
      externalId: listing.externalId,
      title: listing.title,
      releaseState: listing.releaseState,
      sampleTags: listing.tags.slice(0, 5),
      tagCount: listing.tags.length,
      isFree: listing.isFree,
      price: prices.get(listing.externalId) ?? null,
    })),
    missing,
    observation: observation
      ? {
          externalId: observation.externalId,
          reviews: observation.reviews?.lifetime ?? null,
          currentPlayers: observation.players?.currentPlayers ?? null,
        }
      : null,
  }),
);
