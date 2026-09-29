---
name: database-migration
description: Design, implement, review, or apply PostgreSQL and Drizzle schema changes for analytic-dashboard snapshots, jobs, analytics, and classification data.
---

# Database Migration

Read `docs/MVP_IMPLEMENTATION_PLAN.md` and existing migrations/schema first.

## Rules

- Use an additive, reviewable migration when possible.
- Preserve source, country/locale, captured time, score version, and classification provenance.
- Add database uniqueness for idempotency rather than relying only on application checks.
- Distinguish nullable/missing metrics from numeric zero.
- Store timestamps in UTC.
- Add indexes based on actual query and job-leasing paths; avoid speculative indexes.
- Plan backfill and deployment order for non-null or semantic changes.
- Do not expose internal/raw/job tables to browser roles.
- Apply Row Level Security before granting browser access through Supabase.
- Never embed credentials or project-specific secrets in migrations.

## Verification

- Apply migrations to an empty database.
- When relevant, test upgrade from the prior schema with representative rows.
- Verify constraints, indexes, rollback/recovery approach, and key analytical queries.
- Report destructive or long-locking operations before execution.
