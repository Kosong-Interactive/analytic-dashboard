# Project Instructions

The canonical product and implementation plan is `docs/MVP_IMPLEMENTATION_PLAN.md`. Read it before changing architecture, data collection, storage, trend scoring, or AI classification.

Detailed project rules live in `.claude/rules/`. If this file and a focused rule disagree, follow the focused rule and flag the mismatch.

## Product

`analytic-dashboard` is a mobile-game market research dashboard. It collects public Apple App Store and Google Play observations, stores historical snapshots, calculates trends, and classifies game features and mechanics.

The product is a research signal, not a complete store catalog. Never present sampled discovery, install ranges, inferred labels, or trend scores as official download/revenue facts.

## Planned stack

- Next.js App Router and strict TypeScript
- Tailwind CSS and shadcn/ui
- TanStack Query and TanStack Table where client interactivity is needed
- Apache ECharts for analytical charts
- Supabase PostgreSQL with Drizzle ORM
- Node.js/TypeScript collector worker
- npm workspaces and Turborepo
- Zod at external and asynchronous boundaries

Do not introduce a different framework, database, queue, cache, or state library without a measured need and explicit approval.

## Architecture invariants

- Store collectors live behind source adapters; UI and analytics never import scraper libraries directly.
- Normalized domain data is separate from raw provider payloads.
- Historical trends come from persisted observations, not only the latest response.
- Dashboard requests never start large scrapes or AI batches.
- Collection, aggregation, and classification jobs are idempotent and retry-safe.
- Every metric retains store, country, capture time, and freshness context.
- AI labels retain confidence, evidence, input hash, taxonomy version, prompt version, and model.
- Manual classification overrides are never overwritten automatically.

## Repository shape

```text
apps/web/                 Next.js dashboard and backend-for-frontend routes
apps/collector/           scheduled Node.js collector and job worker
packages/db/              schema, migrations, repositories, analytical queries
packages/collectors/      Apple and Google Play adapters
packages/analytics/       velocity, aggregation, and versioned trend scoring
packages/classifier/      taxonomy, deterministic rules, and AI providers
packages/shared/          shared types, schemas, and utilities
packages/ui/              shared UI primitives
config/                   versioned countries, seeds, taxonomy, and scoring config
```

Until the monorepo is scaffolded, keep planning and agent configuration consistent with this target layout.

## Engineering expectations

- Preserve strict types; do not use `any` to bypass an uncertain payload.
- Validate store responses, job payloads, URL inputs, and AI output with Zod.
- Prefer server components for read-heavy pages; add client components only at interactive boundaries.
- Keep route handlers thin and put business rules in packages.
- Keep utilities pure and analytics formulas deterministic.
- Use explicit loading, empty, stale, partial-data, and error states.
- Write tests for normalization, deduplication, scoring, retry behavior, and classification validation.
- Make the smallest scoped change that fully satisfies the request.

## Verification

Run the narrowest relevant checks first, then the repository-wide checks available for the changed area. Do not claim a browser flow, collector, migration, or live store integration is verified unless it was actually exercised.

## Git

- Preserve unrelated user changes.
- Stage specific files.
- Use conventional commits.
- Never commit secrets or local environment files.
- GitHub pull requests target the repository default branch; determine it from Git instead of assuming a branch name.
