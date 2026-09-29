import { AppleSearchCollector } from "./apple-search-collector.js";

const collector = new AppleSearchCollector();
const results = await collector.searchGames({
  term: "puzzle",
  country: "us",
  locale: "en_US",
  limit: 1,
});

console.info(
  JSON.stringify({
    source: "app_store",
    resultCount: results.length,
    sample: results[0]
      ? {
          externalId: results[0].externalId,
          title: results[0].title,
          country: results[0].country,
          rating: results[0].snapshot.rating,
          capturedAt: results[0].snapshot.capturedAt,
        }
      : null,
  }),
);
