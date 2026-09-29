# Mobile Game Analytics Dashboard — MVP Implementation Plan

Status: Draft for review

Repository: `git@github.com:Kosong-Interactive/analytic-dashboard.git`

Target users: internal product/game research team
Initial markets: Indonesia (`id`) and United States (`us`)

## 1. Product goal

Build a low-cost dashboard that helps the team discover and analyze:

- newly released mobile games;
- games whose ranking, rating count, or review count is accelerating;
- genres and gameplay mechanics gaining momentum;
- historical rating, review, and chart movement;
- AI-generated feature and mechanic classifications with traceable evidence.

The MVP is a research signal, not a complete copy of either store catalog. Every result must retain its source, country, collection method, and last collection time so users can judge coverage and freshness.

## 2. MVP scope

### Included

- Apple public metadata through the iTunes Search API.
- Google Play public metadata through a replaceable open-source scraper adapter.
- Discovery and snapshot collection for Indonesia and the United States.
- Historical snapshots for rank, rating, rating count, review count, price, installs range, and version where available.
- New-release, trending-game, genre-trend, and mechanic-trend views.
- Game explorer and game detail pages.
- Rule-based plus AI-assisted classification.
- Internal collector-health view.
- Scheduled collection with retry, throttling, caching, and idempotent writes.

### Excluded from the first MVP

- Revenue or download estimates presented as factual store data.
- A claim of complete coverage of all new App Store releases.
- Full historical backfill before the product starts collecting data.
- Collection of every review for every game.
- More than two countries.
- Public accounts, subscriptions, billing, or team management.
- Redis, Kafka, a separate search engine, or a microservice fleet.
- Native mobile application.

## 3. Recommended stack

| Layer | Primary choice | Reason |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Familiar TypeScript workflow and shared packages |
| Web | Next.js App Router + TypeScript | React-first UI plus a lightweight backend-for-frontend |
| UI | Tailwind CSS + shadcn/ui | Fast dashboard delivery with maintainable primitives |
| Charts | Apache ECharts | Strong time-series, ranking, heatmap, and tooltip support |
| Interactive data | TanStack Query + TanStack Table | Cache, pagination, filtering, and table ergonomics |
| Validation | Zod | Shared runtime contracts across collectors, API, and AI output |
| Database | Supabase PostgreSQL | Managed Postgres, low-cost start, SQL analytics, auth available later |
| SQL/ORM | Drizzle ORM + SQL migrations | Typed access without hiding analytical SQL |
| Worker runtime | Node.js + TypeScript | Best compatibility with scraper libraries |
| Initial scheduler | GitHub Actions | Fast and inexpensive for non-time-critical MVP jobs |
| Initial queue | PostgreSQL jobs table | Avoid extra infrastructure during MVP |
| AI classification | Provider adapter using structured JSON output | Model/provider can change without changing domain code |
| Web deployment | Vercel | Simple Next.js deployment |
| Error tracking | Structured logs + Sentry optional | Enough visibility without a large monitoring stack |

## 4. System architecture

```text
Apple Search API          Google Play public pages
       |                            |
       +------------+---------------+
                    v
             Collector adapters
       discovery -> detail -> reviews
                    |
                    v
       normalize, validate, deduplicate
                    |
          +---------+----------+
          |                    |
          v                    v
   PostgreSQL snapshots   classification jobs
          |                    |
          |                    v
          |              AI classifier
          |                    |
          +---------+----------+
                    v
       aggregates and trend scores
                    |
                    v
          Next.js API and dashboard
```

The dashboard must never trigger a large scrape as part of a normal page request. Long-running collection and classification remain worker responsibilities.

## 5. Proposed monorepo

```text
analytic-dashboard/
├── apps/
│   ├── web/                       # Next.js dashboard and BFF endpoints
│   └── collector/                 # Scheduled Node.js worker and CLI
├── packages/
│   ├── db/                        # schema, migrations, repositories
│   ├── collectors/
│   │   ├── apple/
│   │   └── google-play/
│   ├── analytics/                 # velocity, ranking, trend score
│   ├── classifier/                # taxonomy, rules, prompts, providers
│   ├── shared/                    # shared types and Zod contracts
│   └── ui/                        # reusable dashboard components
├── config/
│   ├── countries/
│   ├── discovery-seeds/
│   └── taxonomy/
├── docs/
├── .github/workflows/
├── turbo.json
└── pnpm-workspace.yaml
```

## 6. Data model

### Core tables

#### `apps`

Canonical cross-store game identity.

- `id`
- `canonical_name`
- `normalized_name`
- `developer_name`
- `first_seen_at`
- `created_at`

Cross-store matching must start as an explicit/manual-capable mapping. Title similarity alone must not silently merge games.

#### `store_apps`

One store listing per store, external ID, country, and locale.

- `id`, `app_id`
- `store`, `external_id`, `country`, `locale`
- `title`, `description`, `developer_name`, `developer_external_id`
- `store_category`, `release_date`, `current_version`
- `icon_url`, `store_url`
- `metadata_hash`, `raw_metadata`
- `first_seen_at`, `last_seen_at`

Unique key: `(store, external_id, country, locale)`.

#### `app_snapshots`

- `store_app_id`, `captured_at`
- `rating`, `rating_count`, `review_count`
- `min_installs`, `max_installs`
- `price`, `currency`, `version`

Only write a snapshot when tracked values change, plus one daily heartbeat snapshot.

#### `chart_entries`

- `store_app_id`, `chart_type`, `category`, `country`
- `rank`, `captured_at`

#### `reviews`

- `store_app_id`, `external_review_id`
- `rating`, `review_text`, `review_date`
- `locale`, `collected_at`

The MVP stores recent samples, not an exhaustive review archive.

#### `taxonomy_labels` and `app_labels`

Labels cover genre, subgenre, core mechanic, meta mechanic, theme, multiplayer mode, and monetization clues. Each assignment stores:

- `source`: `rule`, `ai`, or `manual`;
- confidence;
- evidence;
- taxonomy, prompt, and model versions where applicable.

#### `collector_runs`

Stores source, job type, country, timestamps, status, counts, duration, and an error sample. This is the base for internal health monitoring.

#### `jobs`

Initial durable task queue with type, payload, status, attempts, `available_at`, lock fields, idempotency key, and last error.

## 7. Collection strategy

### Apple

- Maintain seed terms for genre, theme, and mechanic discovery.
- Query each seed per supported storefront.
- Look up known app IDs separately for metadata refresh.
- Filter release dates locally.
- Cache identical searches for 12–24 hours.
- Keep an internal request budget below the documented external limit.
- Mark discovery coverage clearly because search results do not represent the entire store catalog.

### Google Play

- Hide the selected scraper behind `GooglePlayCollector`.
- Discover from chart/list, category, keyword, developer, and similar-game paths.
- Fetch lightweight lists first; enqueue details separately.
- Start with concurrency 1–2 and randomized delay.
- Cache detail responses for 6–24 hours.
- Pin the scraper version and add a daily contract test against known games.
- Stop collection automatically after repeated parser or access failures.
- Preserve a path to a maintained fork or licensed provider later.

### Initial schedule

| Job | Frequency |
|---|---:|
| Google chart/category discovery | Every 6 hours |
| Apple keyword discovery | Every 12 hours |
| Trending-game detail refresh | Every 6 hours |
| Normal-game detail refresh | Daily |
| Trending-game review sample | Every 12 hours |
| Normal-game review sample | Every 2–3 days |
| Classification | On new or materially changed metadata |
| Trend aggregation | After collection batches |
| Retention and roll-up | Weekly |

Scheduled jobs should use non-round minutes to reduce shared-runner congestion.

## 8. Trending and analytics

The first score is versioned as `trend_score_v1`:

```text
0.30 * normalized rank gain over 7 days
+ 0.25 * normalized review velocity over 7 days
+ 0.15 * normalized rating-count velocity over 7 days
+ 0.15 * country breadth growth
+ 0.10 * discovery recency
+ 0.05 * rating momentum
```

Rules:

- Calculate within comparable cohorts such as store, country, and category.
- Retain component scores so the UI can explain why a game is trending.
- Do not equate estimated install buckets with exact downloads.
- Genre and mechanic momentum aggregate the game scores of their members.
- Version every formula change so historical results remain interpretable.

## 9. AI classification

Pipeline:

1. Normalize title, description, store features, and selected metadata.
2. Apply deterministic keyword/rule labels.
3. Calculate an input hash.
4. Skip AI when the same hash and taxonomy version already have a result.
5. Send unresolved fields to a small model using a strict JSON schema.
6. Validate with Zod.
7. Store confidence, evidence, model, prompt version, taxonomy version, and usage.
8. Allow a manual override that is never overwritten automatically.

AI must classify only against a controlled taxonomy. Free-form labels would fragment analytics and make trends unreliable.

## 10. Rate limiting, retries, and caching

- Per-source and per-country token buckets.
- Exponential backoff with jitter for `429`, `403`, and transient `5xx` responses.
- Low concurrency for Google Play.
- No repeated retries for confirmed missing apps.
- Circuit breaker after repeated source failures.
- Global daily request budget and per-job maximum.
- Idempotent upserts and job keys.
- Database-backed response metadata and TTL initially; no Redis in MVP.

Redis or a managed queue is introduced only when multiple continuously running workers need shared rate-limit state or the PostgreSQL queue becomes a measured bottleneck.

## 11. Dashboard pages

### Overview

- Newly discovered and newly released games.
- Fastest risers.
- Review/rating velocity leaders.
- Rising genres and mechanics.
- Freshness and coverage indicators.

### Game explorer

- Store, country, category, genre, mechanic, release-date, rating, and monetization filters.
- Sort by trend score, velocity, release date, or rank movement.
- Server-side pagination.

### Game detail

- Store metadata and outbound store link.
- Rank, rating, and review history.
- Trend-score explanation.
- AI labels, confidence, evidence, and classification version.

### Trend explorer

- Seven-day versus thirty-day movement.
- Genre and mechanic share over time.
- Store and country comparison.

### Internal collector health

- Last success per job/source/country.
- Duration, items discovered, items changed, retry and error counts.
- Queue depth and oldest pending job.

## 12. Observability and quality gates

### Required signals

- Structured JSON logs with `run_id` and `job_id`.
- Request, success, retry, rate-limit, and parser-error counts.
- Collection duration and data freshness.
- Queue depth and oldest-job age.
- Classification validation and cost/usage metrics.

### Alerts

- Two consecutive collector failures.
- No successful data refresh in 24 hours.
- A normally populated discovery job returns zero results.
- Error rate exceeds 20%.
- AI schema validation fails repeatedly.

### CI gates

- Typecheck.
- Lint and formatting.
- Unit tests for normalization, scoring, and classification validation.
- Migration validation.
- Collector contract tests using fixtures.
- A small scheduled live smoke test kept separate from deterministic CI.

## 13. Data retention

- Raw source payloads: 7–14 days unless needed for an active parser incident.
- Detailed snapshots: 90 days.
- Older snapshots: daily roll-ups.
- Reviews: recent samples with deduplication.
- Collector errors: retain summarized records longer than large raw responses.

Before approaching the hosted database limit, the first actions are review pruning, raw-payload cleanup, and snapshot roll-up—not adding another database technology.

## 14. Security and configuration

- Keep service-role database keys and AI keys server-side only.
- Protect manual collection and reclassification endpoints with admin authentication and a shared internal authorization layer.
- Validate every collector payload before persistence.
- Use least-privilege database roles where practical.
- Never expose raw provider errors or secrets through public API responses.
- Store country lists, seeds, taxonomy, scoring versions, and rate-limit settings as versioned configuration.

## 15. Delivery phases

### Phase 0 — Foundation

- Initialize monorepo and shared TypeScript configuration.
- Set up Supabase project, Drizzle schema, migrations, and local environment.
- Add CI for lint, typecheck, and tests.
- Define country, source, snapshot, and taxonomy contracts.

Exit criteria: both applications build; migrations work from an empty database; CI passes.

### Phase 1 — Collection vertical slice

- Implement Apple and Google Play adapters.
- Add discovery, detail refresh, throttling, caching, and collector-run logging.
- Store normalized apps and snapshots.
- Add fixture-based and small live contract tests.

Exit criteria: scheduled collection for `id` and `us` runs idempotently and exposes failures clearly.

### Phase 2 — Analytics dashboard

- Implement velocity calculations and `trend_score_v1`.
- Add Overview, Explorer, and Game Detail.
- Display freshness, coverage, and score explanations.

Exit criteria: a user can trace every trend result to historical observations and source data.

### Phase 3 — Classification and trend explorer

- Lock taxonomy v1.
- Add rule engine, AI provider adapter, classification jobs, caching, and manual overrides.
- Add genre/mechanic trend views.

Exit criteria: classifications are validated, versioned, explainable, and never overwrite manual decisions.

### Phase 4 — Hardening and deployment

- Configure production schedules, retention, monitoring, and alerts.
- Load-test representative dashboard queries.
- Review scraper failure behavior and kill switches.
- Document backup, restore, and scraper-replacement procedures.

Exit criteria: the MVP can run unattended for seven days with visible health and bounded costs.

## 16. MVP acceptance criteria

- Supports Apple and Google Play data for Indonesia and the United States.
- Shows new discoveries, trending games, rank movement, and review/rating velocity.
- Shows genre and mechanic momentum using versioned classification data.
- Stores historical snapshots and never derives trends only from the current response.
- Every page exposes data freshness and relevant source/country context.
- Duplicate runs do not create duplicate store apps, reviews, or jobs.
- Collector failures do not break dashboard reads.
- AI is not called again for unchanged metadata and taxonomy.
- Manual classifications take precedence over automated labels.
- Automated checks pass before deployment.

## 17. Main risks and mitigations

| Risk | Mitigation |
|---|---|
| Google Play markup changes | Adapter boundary, pinned dependency, fixtures, daily smoke test, kill switch |
| Apple discovery is incomplete | Explicit coverage labels, diverse seed strategy, no completeness claim |
| Hosted database fills quickly | Change-only snapshots, review sampling, retention, daily roll-ups |
| AI taxonomy drifts | Controlled taxonomy, versioning, schema validation, manual overrides |
| Trending score favors large incumbents | Cohort normalization and separate velocity/recency components |
| Scheduled jobs run late | Treat GitHub Actions as non-precise; migrate collectors when timing becomes material |
| Store access blocks collectors | Low concurrency, caching, backoff, request budget, provider replacement path |

## 18. Decisions to confirm before Phase 0

1. Is this dashboard internal-only for the MVP?
2. Are Indonesia and the United States the correct first storefronts?
3. Should the MVP support only games, excluding non-game applications at ingestion time?
4. Which AI provider should production use, or should the first version keep AI disabled behind an interface?

Supabase-managed PostgreSQL is confirmed. Select the project and region during Phase 0 using `docs/SUPABASE_SETUP.md`.

Unless changed during review, the remaining assumptions are: internal-only, `id` and `us`, games-only, and provider-agnostic AI with a local development option.
