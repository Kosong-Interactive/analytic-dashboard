# Claude Handoff

Updated: 2026-09-29

## Product context

This repository is an internal MVP for analysing mobile-game market signals. It is not a full store catalogue and must not present estimated revenue, download counts, or discovery coverage as facts. Trends derive from our own historical snapshots.

## Current state

- Phase 0 is complete: Next.js workspace, Supabase schema/migrations, shared Zod contracts, collector scaffold, CI, logo/favicon.
- Phase 1.1 is complete: `AppleSearchCollector` uses the official iTunes Search and Lookup APIs.
- Phase 1.2 is complete: `GooglePlayCollector` is collector-only, validates normalized output with Zod, filters to `GAME*` categories, has search, detail lookup, and top-chart discovery paths, plus cache, low request rate, and transient-only retry behavior.
- No dashboard UI implementation has begun. The user’s design handoff is the Claude design artifact linked below.

## Runtime and package decisions

- Use `npm`, never pnpm, with the one root `package-lock.json`.
- Node baseline is `22.23.3` in `.nvmrc` (minimum `22.12.0`). Run `nvm use` before local work.
- Google Play uses `@mradex77/google-play-scraper@1.3.0`. The earlier Node-20-compatible `google-play-scraper` was rejected because a live smoke test returned zero records, indicating parser drift.
- Keep all scraper interactions inside `packages/collectors`; no scraper import in `apps/web`, `packages/db`, or `packages/shared`.
- No Redis or external queue: the PostgreSQL `jobs` table remains the MVP queue.

## Important locations

- `packages/collectors/src/apple/` — official Apple adapter and smoke test.
- `packages/collectors/src/google-play/` — Google adapter, fixture test, smoke test.
- `packages/collectors/src/contracts.ts` — output boundary all adapters must return.
- `packages/db/src/schema/` — persisted model and historical snapshots.
- `.claude/rules/` — mandatory architecture, safety, and product rules.
- `docs/MVP_IMPLEMENTATION_PLAN.md` — phase plan and acceptance checks.

## Validation commands

```bash
nvm use
npm run check
npm audit --omit=dev
npm run smoke:apple --workspace @analytic-dashboard/collectors
npm run smoke:google-play --workspace @analytic-dashboard/collectors
```

The smoke commands make live public requests; keep them manual, low-volume, and outside CI. Unit tests must stay fixture-based.

## Phase 1.3 (complete)

- `packages/db/src/repositories/`: `persistStoreApps` (listing upsert, change-only snapshots with a 24h heartbeat), `persistChartEntries`, and `startCollectorRun`/`finishCollectorRun`. DB integration tests need `TEST_DATABASE_URL` and run in CI after migrations; they roll back.
- `apps/collector`: `npm run discover --workspace @analytic-dashboard/collector -- [--dry-run] [--source app_store|google_play] [--country id|us]`. Seeds and countries live in `config/`. Google chart rank is the provider position, kept when an earlier item is dropped. Apple has no chart path yet.
- Live run against Supabase verified: two consecutive runs; unchanged Apple listings wrote no new snapshots, changed Google counters wrote new ones.
- The collector app now runs through `tsx` and its `build` only typechecks, because `packages/db` exports TypeScript source.

## Phase 2 progress

- `packages/analytics`: `windowedChange`, `percentileRanks`, `trend_score_v1` (`computeRawComponents`, `scoreCohort`) and `scoreTrending` (cohorts default to store+country).
- `packages/db/src/queries/trend-inputs.ts`: `loadTrendCandidates` returns snapshots, chart ranks, and country breadth in a constant number of queries. Its integration test needs `TEST_DATABASE_URL` (runs in CI). Raw `sql` fragments must pass dates as ISO strings with `::timestamptz`.
- Live check: the query runs against Supabase, but no candidate is scored yet because history is under a day; velocity needs several days of scheduled collection.
- Overview page is built (`apps/web/app/page.tsx`, `components/overview/`, `lib/overview/`): KPI cards, trending table with score breakdown, newly discovered list, data coverage, filters via `?country=&platform=`. Genres/mechanics are an explicit "not available yet" panel until Phase 3; there is no Market Signals panel.
- The trending table stays empty ("No games scored yet") until about 3.5 days of history exist; verified live against Supabase and, for the populated state, with a temporary fixture page (removed).
- Web deploys to Vercel; steps for this monorepo are in `docs/DEPLOYMENT_VERCEL.md` (not yet run against a real project).
- Auth: Supabase Auth email + password. `proxy.ts` refreshes the session and redirects to `/login`; every page also calls `requireUser()`. Users are created in the Supabase dashboard (sign-ups off); no app table is needed. Not yet verified with a real sign-in.
- Trending Games page (`/trending`) is built with URL filters, sort, pagination; layouts are responsive (cards below `md`, mobile nav below `lg`).
- Game Detail (`/games/[id]`, id = `store_apps.id`): metrics, ECharts step charts (ratings, rank, rating) with text summaries, score breakdown, and the source observations table that traces every score to stored snapshots. Query: `loadGameHistory` in `packages/db`.
- New Releases (`/new-releases`): store release date inside a 7/30/90-day window (never discovery time); few rows today because discovery favours chart and keyword games.
- Store icons render through `next/image` (`*.mzstatic.com`, `play-lh.googleusercontent.com` in `next.config.ts`), falling back to initials.
- Discovery seeds `mvp-v2` (22 Apple terms × 50, Google TOP_FREE/TOP_PAID/GROSSING × 25): dry run for `id` found 801 Apple + 68 Google games in 77 s. Apple requests are spaced 3 s apart. Runs record `metadata.seedVersion`.
- Next: Phase 3 classification (taxonomy, rules, AI provider) to unlock Genres/Mechanics.

## Known gaps / next

- Adapters report skipped items (`invalid`, `non_game`) and Google retries through optional `CollectorEvents`; discovery records them as `retry_count` and `metadata.invalidSkipped`/`nonGameSkipped`. Cached responses do not re-emit skips.
- `.github/workflows/collect.yml` runs discovery every 6 hours (17 past). It needs the repository secret `DATABASE_URL`; it has not been run on GitHub yet.
- Phase 2 starts with `packages/analytics` (velocity, `trend_score_v1`). UI follows the design artifact `https://claude.ai/artifact/FmXb2bJ9ViYy9S9p5NyGNy` (Overview, Trending, NewReleases, GameDetail, Genres, Mechanics, TrendScore, Compare, Search, Watchlist).

## Checklist for the next agent

- [ ] Read `AGENTS.md` and every relevant `.claude/rules/*.md` before editing.
- [ ] Run `nvm use` and confirm Node is at least 22.12.
- [ ] Never print, commit, or paste `.env.local` values.
- [ ] Validate any external payload at the adapter boundary with Zod.
- [ ] Preserve install ranges as ranges; never label them exact downloads.
- [ ] Do not add UI until the user provides the design handoff.
- [ ] Run focused tests, then `npm run check`, then `npm audit --omit=dev`.
- [ ] Inspect `git diff --check` and `git status` before committing.
