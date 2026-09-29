import { GooglePlayCollector } from "./google-play-collector.js";

const results = await new GooglePlayCollector().searchGames({
  term: "puzzle",
  country: "us",
  locale: "en_US",
  limit: 1,
});
const first = results[0];

console.info(
  JSON.stringify({
    source: "google_play",
    resultCount: results.length,
    sample: first
      ? {
          externalId: first.externalId,
          title: first.title,
          country: first.country,
          rating: first.snapshot.rating,
          reviewCount: first.snapshot.reviewCount,
          capturedAt: first.snapshot.capturedAt,
        }
      : null,
  }),
);
