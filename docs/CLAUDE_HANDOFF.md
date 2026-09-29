# Claude Handoff

Updated: 2026-09-29

## Product context

This repository is an internal MVP for analysing mobile-game market signals. It is not a full store catalogue and must not present estimated revenue, download counts, or discovery coverage as facts. Trends derive from our own historical snapshots.

## Current state

- Phase 0 is complete: Next.js workspace, Supabase schema/migrations, shared Zod contracts, collector scaffold, CI, logo/favicon.
- Phase 1.1 is complete: `AppleSearchCollector` uses the official iTunes Search and Lookup APIs.
- Phase 1.2 is complete: `GooglePlayCollector` is collector-only, validates normalized output with Zod, filters to `GAME*` categories, has search, detail lookup, and top-chart discovery paths, plus cache, low request rate, and transient-only retry behavior.
- No dashboard UI implementation has begun. Before starting UI, wait for the user’s design handoff.

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

## Next work: Phase 1.3

1. Add a collector-run service that records start/end/status/counts into `collector_runs`.
2. Add an idempotent persistence service that upserts `apps`/`store_apps` and creates `app_snapshots` and `chart_entries`.
3. Drive one small Apple and Google discovery flow for `id` and `us`; do not claim exhaustive coverage.
4. Add fixture tests for persistence/idempotency and a tiny manual end-to-end run against the configured Supabase project.
5. Record source, country, locale, collection, and captured time on every persisted result.

## Checklist for the next agent

- [ ] Read `AGENTS.md` and every relevant `.claude/rules/*.md` before editing.
- [ ] Run `nvm use` and confirm Node is at least 22.12.
- [ ] Never print, commit, or paste `.env.local` values.
- [ ] Validate any external payload at the adapter boundary with Zod.
- [ ] Preserve install ranges as ranges; never label them exact downloads.
- [ ] Do not add UI until the user provides the design handoff.
- [ ] Run focused tests, then `npm run check`, then `npm audit --omit=dev`.
- [ ] Inspect `git diff --check` and `git status` before committing.
- [ ] Commit Phase 1.2 only after the Google Play live smoke test returns a normalized game record; otherwise keep the failure visible and investigate parser/provider changes.
