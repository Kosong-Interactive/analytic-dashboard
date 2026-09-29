# Project Decisions

## Confirmed

- Product: internal mobile-game analytics dashboard MVP.
- Initial stores: Apple App Store and Google Play.
- Initial storefronts: Indonesia and United States.
- Web: Next.js App Router with strict TypeScript.
- Package manager: npm workspaces with a single root `package-lock.json`.
- Database: user's existing Supabase account, using managed PostgreSQL.
- Database migrations: Drizzle code-first SQL migrations, validated against an empty PostgreSQL database in CI.
- Collector: separate Node.js/TypeScript worker with replaceable store adapters.
- Shared runtime contracts: Zod schemas in `packages/shared` for source, country, snapshot, and taxonomy boundaries.
- Apple collection: official iTunes Search/Lookup endpoints behind `AppleSearchCollector`; filter software results to Games and preserve missing review counts as `null`.
- Google Play collection: `@mradex77/google-play-scraper@1.3.0` is isolated behind `GooglePlayCollector` (Node baseline 22.12+); the Node-20-compatible `google-play-scraper` was rejected after a live smoke test returned zero records; source calls are throttled, cached, and retried only for transient failures.
- Historical snapshots are the basis for trends.
- Initial scheduler: GitHub Actions unless measured requirements justify another runtime.
- Initial queue: PostgreSQL jobs table; no Redis by default.
- AI classification: controlled/versioned taxonomy, provider adapter, structured output, and cache by input hash.
- Repository: `git@github.com:Kosong-Interactive/analytic-dashboard.git`.

## Pending implementation-time choices

- Exact Supabase project and region.
- AI provider/model for hosted classification.
- Final package versions after scaffolding.
- Authentication method if the internal dashboard must be access-controlled in the first release.

Do not turn a pending choice into an implicit dependency without confirmation.
