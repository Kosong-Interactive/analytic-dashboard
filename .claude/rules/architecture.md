# Architecture

## Boundaries

### `apps/web`

Owns presentation, authentication when introduced, and thin backend-for-frontend endpoints. It may call application/query services but must not import scraper implementations or run long collection/classification batches.

### `apps/collector`

Owns scheduled discovery, metadata refresh, review sampling, aggregation orchestration, job leasing, retries, and health records. Every command must be safe to rerun.

### `packages/collectors`

Defines store-neutral contracts and source-specific adapters. Normalize external payloads at this boundary and retain raw payloads only according to retention policy.

### `packages/db`

Owns schema, migrations, repositories, and database-specific queries. Prevent components and collector adapters from scattering SQL throughout the repository.

### `packages/analytics`

Contains pure, deterministic functions for deltas, velocity, cohort normalization, roll-ups, and versioned scores. No network or UI dependencies.

### `packages/classifier`

Owns taxonomy, deterministic labeling, provider adapters, schema validation, caching by input hash, and classification provenance.

## Data flow

```text
source -> adapter -> validation -> normalization -> idempotent persistence
       -> snapshots -> aggregates -> query service -> dashboard
       -> classification job -> labels with provenance
```

## Required invariants

- External IDs are scoped by store, country, and locale as defined by the schema.
- Canonical cross-store matching is reviewable and must not rely only on title similarity.
- Snapshot timestamps are stored consistently in UTC.
- Unique constraints are the last defense against duplicate runs.
- Jobs use idempotency keys, bounded attempts, leases, and retry delays.
- Formula and taxonomy changes create new versions instead of rewriting meaning silently.
