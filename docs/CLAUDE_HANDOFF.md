# Claude Handoff

Updated: 2026-09-30

This is the bootstrap document for a new Claude session with no previous chat context. Read this
file, `AGENTS.md`, all relevant `.claude/rules/*.md`, and `docs/MVP_IMPLEMENTATION_PLAN.md` before
changing code. Do not assume the working tree is clean.

## Immediate instruction from the user

The existing dashboard menus and Automated Game Research stages 1 through 5 are implemented on
`development`. Steam expansion Stage 2 is the current local work: listing and observation contracts
exist without activating Steam in storage or UI. Deployment to Vercel is handled separately by the
user.

The approved product direction is documented in `docs/NEXT_DEVELOPMENT_PLAN.md`. The product is
conceptually **Game Market Intelligence**, not mobile-only, but Steam must not appear as an active
filter before its collector and real observations exist.

## Repository and runtime

- Repository: `git@github.com:Kosong-Interactive/analytic-dashboard.git`.
- Current branch: `development`, tracking `origin/development`.
- Package manager: npm with one root `package-lock.json`; never use pnpm.
- Node: `22.23.3` in `.nvmrc`, minimum `22.12.0`. Run `nvm use` first.
- Monorepo: npm workspaces + Turborepo.
- Database: Supabase PostgreSQL via Drizzle.
- Dashboard: Next.js App Router, Server Components by default.
- Deployment target: Vercel, intentionally deferred. Setup notes are in
  `docs/DEPLOYMENT_VERCEL.md`.
- Collection/classification schedule: GitHub Actions in `.github/workflows/collect.yml`.

Never print, paste, or commit `.env.local` values. Preserve unrelated user changes.

## Platform registry

`packages/shared/src/platforms.ts` is the one place that says what each platform is and publishes
(label, kind, markets, rating scale, review count, install range, chart rank). UI and classifier
code read labels and capabilities from it; `packages/db` derives `StoreId` from the `store` enum.
Add Steam there, and to the database enum, only when its adapter and observation semantics exist.

## Product semantics that must not drift

- This is sampled market research, not a complete catalogue.
- “Newly discovered” means first observed by this system, not newly released.
- “Newly released” requires a provider release date.
- Trend Score is an internal versioned score, not a store label.
- Google install values are ranges, never exact downloads.
- AI/rule labels are inferred and retain confidence, evidence, source, versions, and model.
- Manual Confirm/Reject decisions always override automated labels and are never overwritten.
- Missing values remain missing; never turn them into zero.
- Dashboard reads never trigger collection or classification.

## Current committed baseline

Latest committed feature baseline before Stage 5:
`c36cdd6 feat: add studio fit and cited research briefs`.

### Collection and persistence

- Apple Search/Lookup adapter and Google Play adapter live in `packages/collectors`.
- Discovery targets Indonesia (`id`) and the United States (`us`). The UI currently labels the US
  storefront as “Global (US store)”; it is not true global coverage.
- Discovery seeds are versioned; active widened seeds are `config/discovery-seeds/mvp-v2.json`.
- Store listings are idempotently upserted. Snapshots are change-only with a 24-hour heartbeat.
- Chart entries retain provider positions. Apple does not yet have a chart path.
- Collector runs record success/partial/failure, retries, errors, and skipped invalid/non-game items.
- The scheduled GitHub workflow has been exercised successfully against Supabase. Discovery runs
  every six hours at minute 17 and then runs deterministic rule classification.

### Analytics

- `packages/analytics` contains windowed velocity, cohort percentile normalization,
  `trend_score_v1`, and score explanations.
- Formula:
  - 30% normalized rank gain over 7 days;
  - 25% normalized review velocity over 7 days;
  - 15% normalized rating-count velocity over 7 days;
  - 15% country breadth growth;
  - 10% discovery recency;
  - 5% rating momentum.
- Missing components are excluded and remaining weights are rescaled. A score is withheld when less
  than 40% of score weight is measurable.
- `loadTrendCandidates` retrieves snapshots, ranks, and country breadth without per-game queries.
- Live read-only queries against Supabase were verified. Meaningful velocity requires accumulated
  history; do not fake scores while history is short.

### Authentication

- Supabase Auth uses email + password.
- `proxy.ts` refreshes the session and redirects to `/login`.
- Every protected page also calls `requireUser()`.
- Users are created in Supabase; there is no application password table.
- Public sign-up should remain disabled.
- A real end-to-end sign-in has not yet been verified in this handoff.

### Dashboard pages already built

- `/` — Overview: KPI cards, trending summary, classification links, newly discovered games, source
  freshness/coverage.
- `/trending` — URL filters, sorting, pagination, responsive table/cards, score breakdown.
- `/new-releases` — actual store release dates over 7/30/90 days; discovery time is not substituted.
- `/games/[id]` — listing metadata, ECharts history, accessible observation table, Trend Score
  evidence, classification labels, and manual Confirm/Reject/Undo.
- `/genres` — genre/subgenre roll-ups.
- `/mechanics` — core/meta/theme/multiplayer roll-ups.
- `/games` — Explorer: URL filters for text, store category, genre, core mechanic, release date,
  rating, momentum, and classification status; stable sorting, pagination, store freshness.
- `/games/watchlist` — team-shared entries (`watchlist_entries`, migration `0002`, applied) with status,
  note, actor/timestamps, and movement since added. Game detail has Add to watchlist / Compare.
- `/games/compare` — up to four listings via `?ids=`, each storefront cohort loaded once, mixed-store
  cautions, shared-label highlighting, search to add, Reset.
- Watchlist and Compare live inside Games (tabs All games / Watchlist / Compare, no sidebar items).
  Each Games row has a watchlist star (optimistic) and a Compare toggle; the selection is kept in
  `?compare=` and shown in a sticky tray.
- Search: Cmd/Ctrl+K palette in the top bar over `GET /api/search` (signed-in, no-store), plus
  `/search` for full results. Signed-out `/api/*` requests get 401 JSON.

Store icons use `next/image` with Apple and Google hosts allowed in `apps/web/next.config.ts`, with
initials fallback. Analytical charts have textual/tabular equivalents.

### Classification committed on `main`

- Controlled taxonomy: `config/taxonomy/v1.json`.
- Deterministic rules: `packages/classifier/src/rules.ts`.
- Command: `npm run classify --workspace @analytic-dashboard/collector`.
- Rule outputs retain taxonomy version, rules version, input hash, confidence, and evidence.
- Unchanged hashes are skipped. Changed rule labels are replaced without touching AI/manual labels.
- Label resolution is manual > AI > rule. Manual confidence 0 is an explicit rejection.
- UI roll-ups hide automated labels below confidence 0.6.
- Known false positives from description keywords exist; manual review or AI should correct them.

## AI classification (committed)

The Gemini AI classifier is committed (`npm run classify-ai --workspace @analytic-dashboard/collector`).
It uses the official `@google/genai` SDK, a strict JSON schema, Zod re-validation, evidence
verification against the supplied title/description/store category, bounded batches, request
spacing, model rotation, and token counts. Manual overrides are never touched.

- `classification_runs` (migration `0001`) records the last automated run per app, source, and
  taxonomy version. It is the input-hash cache, so empty results are cached too. Existing rule runs
  were backfilled; the migration has been applied to Supabase.
- `--dry-run` writes nothing, including the taxonomy sync.
- A live dry run of one batch (8 apps, `gemini-3.5-flash-lite`) succeeded: 38 labels, 1 rejected
  by evidence checks, ~6k tokens.
- The scheduled workflow runs `classify-ai --limit 200` (at most 25 requests per run). It skips with
  exit 0 until the `GEMINI_API_KEY` repository secret is added; that secret is not set yet.
- Database integration tests for AI persistence exist but need a disposable `TEST_DATABASE_URL`.
- AI is live: the `GEMINI_API_KEY` secret exists, and 32 apps were classified manually on
  2026-09-30 (two runs of 8 and 16, `gemini-3.5-flash-lite`, 18 s for 16 apps). The schedule
  continues at up to 200 apps per run.
- Once an app has an AI run for a taxonomy version, its rule labels are ignored by
  `loadLabelMembership` and `loadListingLabels` (`notSupersededByAi`); manual labels still win.
  Prompt `ai-v2` (platform-neutral wording, title/store genre words count as evidence, and a
  wrong evidence field is corrected to the field that contains the verbatim quote) re-queues every
  app. Known model inconsistency: Shadowgun Legends ("Online FPS") gets `shooting` when classified
  alone but not always in a batch; correct it with a manual Confirm.
- One early live run stalled with only an idle database socket open and was killed; it did not
  reproduce. The DB client now has `connect_timeout`, and the classification steps have
  `timeout-minutes`.

### Agent/tooling files

`.agents/skills/` holds the project skills for Codex and other AGENTS.md-compatible tools (it
replaced the old `.agent/` folder); Claude Code reads `.claude/`. Keep skill text in sync between
them. `.codex/` (reviewer agent configuration) is still untracked.

## Approved future roadmap

`docs/NEXT_DEVELOPMENT_PLAN.md` records two user-approved plans:

1. **Automated Game Research** — deterministic Opportunity Score, separate Research Confidence,
   comparable-game evidence, counter-signals, studio fit, internal Shortlist/Reject/Prototype
   decisions, and a constrained AI-authored research brief.
2. **Cross-platform / Steam readiness** — neutral Game Market Intelligence language, platform and
   market compatibility, Steam-specific observations, platform-level normalization, and
   Steam-to-mobile/mobile-to-Steam opportunity research.

The roadmap was also referenced from `docs/MVP_IMPLEMENTATION_PLAN.md`. These docs are intentional
changes requested by the user, but they have not been committed. Current dashboard completion takes
priority over implementing them.

## Automated Game Research (stage 1)

- `packages/analytics/src/opportunity.ts`: `opportunity_score_v1`, a pure, versioned formula over
  label cohorts (single genre/subgenre/core mechanic/theme, plus genre+mechanic and
  subgenre+mechanic pairs, at least 5 games). Components are percentiles across the cohorts of the
  same storefront; studio fit has no input yet, so its weight is redistributed. **Demand momentum
  is required**: without Trend Scores no opportunity is scored. Research Confidence is separate
  (cohort size, history, component coverage, freshness, label quality).
- Tables `research_runs` and `market_opportunities` (migration `0003`, applied). Runs are
  append-only; `input_hash` makes a rerun over identical results a no-op, and `asOf` is floored to
  the UTC hour so reruns within the hour match.
- `npm run research --workspace @analytic-dashboard/collector` and `.github/workflows/research.yml`
  (daily 01:43 UTC).
- Overview shows **Game Opportunities** after the KPI cards. As of 2026-09-29 no cohort is scored
  because history is under 1 day; 226 cohorts are tracked across the four storefronts. The card
  layout is covered by view-model tests but has not been seen with real scored data yet.
- Stage 2 is implemented: `/research/[id]` shows the validated calculation, market facts,
  comparable games, positive evidence, counter-signals, caveats, freshness, and formula/taxonomy
  versions. Overview cards and the unscored candidate preview link to it.
- Migration `0004` (applied) adds append-only `opportunity_decisions`. The authenticated decision
  form records Shortlist/Reject/Prototype, actor, optional owner, note, and timestamp; earlier
  decisions remain visible as history.
- Stage 3 is committed: `/settings/studio-fit` stores append-only
  profile versions and `/research/[id]` displays Market Opportunity, Studio Fit, and Recommendation
  Priority separately. `studio_fit_v1` scores only explicit platform support and preferred/avoided
  taxonomy matches; it does not guess production requirements from labels. Migration `0005` adds
  `studio_profiles` with RLS enabled and no browser policy; it has been applied and verified against
  Supabase.
- Stage 4 is committed. `research-brief-v1` gives Gemini only a
  bounded evidence registry and requires every statement/question to cite supplied evidence IDs.
  Invalid or unknown citations are rejected. Migration `0006` adds append-only
  `opportunity_research_briefs` with prompt/model/input-hash/token provenance and the exact evidence
  snapshot; it is applied and verified against Supabase (16 tables, 7 migrations, no public
  policies). Research Detail shows the brief, citation links, and expandable evidence registry.
  The daily workflow step is gated by `ENABLE_RESEARCH_BRIEFS=true`; do not enable it without
  explicit approval to send opportunity evidence to Gemini. Live `--plan` found 0 scored candidates,
  so no model was called and no brief was written.
- Stage 5 is implemented and verified. `opportunity_history_v1` derives 30/90-day
  durability, two-window 7-day acceleration, timeline points, and latest material-change alerts
  from existing append-only opportunity results. It compares only identical storefront/market,
  opportunity key, formula, and taxonomy versions. No migration or new scheduled job is required.
  Durability remains collecting until 80% of the requested time span exists; acceleration requires
  14 days; missing scores remain missing. Research Detail shows the full history state and Overview
  cards show the highest-priority latest change. Multiple reruns on one UTC day collapse to the
  latest selected daily point so manual reruns do not overweight durability.

## Next work

1. Done: Genres/Mechanics label names open `/games?label=type:slug` with the label's roll-up and
   each game's label source and confidence.
2. Research stage 1 follow-up: once Trend Scores exist (about 3.5 days of history, around
   2026-10-02/03), check that scored opportunities are sensible and review the card layout with
   real data.
3. Done: Research stage 2 detail and Shortlist/Reject/Prototype decision history.
   Remaining manual check: open one real detail page and save each decision state in the browser;
   automated tests and the production Webpack build pass, but the browser tool timed out at login.
4. Research stage 3 automated checks pass locally and migration `0005` is applied. The desktop and
   mobile Settings layout plus a real unscored Research Detail pending state were inspected in
   Chrome with no console warnings/errors. Remaining manual step: save one intentional profile
   version when the team is ready to enter real capabilities; no placeholder team profile was saved.
5. Research stage 4 automated checks and live read-only planning pass. The real unscored Research
   Detail empty state was inspected in Chrome at desktop and mobile sizes with no console
   warnings/errors. Remaining: wait for scored opportunities, obtain explicit approval for Gemini
   transmission, then run one low-volume live brief and inspect its citations in Chrome.
6. Done: Research stage 5 automated checks cover durability, missing scores,
   acceleration, alert thresholds, stored JSON validation, Overview alert projection, and the
   bounded history query. The real short-history collecting state was inspected in Chrome at
   desktop and mobile sizes with no console warnings/errors or mobile overflow. Remaining: wait for
   enough daily results before 30/90-day values can become measurable.
7. Planned: replace **Global (US store)** with a **World** market built from several countries
   (see `docs/NEXT_DEVELOPMENT_PLAN.md` → Requested dashboard additions). Mind the Google Play
   worldwide-metric double-counting note there.
8. Next major feature: **Steam** as a third platform (see `docs/NEXT_DEVELOPMENT_PLAN.md` →
   Steam as a data source, and the Steam delivery stages). Stages 1–3 are done. Stage 3 is
   `SteamCollector` in `packages/collectors/src/steam/`, over the official Web API: global
   most-played (`ISteamChartsService/GetMostPlayedGames`) and top sellers
   (`IStoreTopSellersService/GetWeeklyTopSellers`, `country_code: ""`; `ID` returns nothing),
   listings and regional prices via `IStoreBrowseService/GetItems` (50 per request; tag and
   category ids resolved with `GetTagList` / `GetStoreCategories`), lifetime review totals via
   `IUserReviewsService/GetAppReviews` (only `query_summary` is read; review text is never kept),
   and `ISteamUserStats/GetNumberOfCurrentPlayers`. One throttle for every endpoint (1 s), 6 h
   cache, retries only for 429/5xx/network, errors never contain the key. Decisions: `genres`
   stay empty because these responses carry no official genres and user tags were too noisy
   (live: Dota 2 tagged "Simulation"); prices only for `us`/`id`, with the currency checked
   against the formatted price; `recent` review window stays `null`. Fixtures and 16 tests are
   deterministic; `npm run smoke:steam` passed live on 2026-09-30. Web API terms: 100,000 calls a
   day and no implied Valve endorsement. Next: Stage 4 (database enum + persistence of Steam Global
   history, freshness/coverage). The user reports `STEAM_WEB_API_KEY` is configured locally and in
   GitHub Actions; do not expose or print it.
9. Remaining manual checks: the Watchlist note Save flow and the login page on a phone.

Design reference for current pages:

`https://claude.ai/artifact/FmXb2bJ9ViYy9S9p5NyGNy`

## Verification evidence at handoff

- `npm run check` (lint, typecheck, tests, build): passed after the AI fixes.
- Migration `0001_classification_runs` applied to Supabase; 1,320 rule runs backfilled.
- One live Gemini dry run succeeded and wrote no rows.

## Commands for a fresh session

```bash
nvm use
git status --short
git diff --check

# Focused classification checks
npm test --workspace @analytic-dashboard/classifier
npm test --workspace @analytic-dashboard/collector
npm run typecheck --workspace @analytic-dashboard/classifier
npm run typecheck --workspace @analytic-dashboard/collector

# Before any commit
npm run check
npm audit --omit=dev
```

Database integration tests need a migrated disposable `TEST_DATABASE_URL`; they roll back. Never
point integration tests at production. Store smoke tests and Gemini live checks are manual,
low-volume operations and require explicit awareness of external requests/quota.

## Commit discipline for the next session

- Keep each dashboard menu in its own focused conventional commit.
- Keep the roadmap/documentation changes in a separate docs commit unless the user asks otherwise.
- Keep future Games / Explorer work in its own feature commit.
- Stage explicit files; never include `.env.local` or unrelated managed
  agent files accidentally.
