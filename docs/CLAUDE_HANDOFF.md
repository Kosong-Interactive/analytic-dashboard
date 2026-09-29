# Claude Handoff

Updated: 2026-09-29

This is the bootstrap document for a new Claude session with no previous chat context. Read this
file, `AGENTS.md`, all relevant `.claude/rules/*.md`, and `docs/MVP_IMPLEMENTATION_PLAN.md` before
changing code. Do not assume the working tree is clean.

## Immediate instruction from the user

Finish every existing dashboard menu before starting the next-generation research features or
deploying to Vercel.

Work order:

1. Games / Explorer.
2. Watchlist.
3. Compare.
4. Search / command palette.
5. Final navigation, responsive, accessibility, and browser-flow pass.
6. Only then start Automated Game Research and Steam/cross-platform work.
7. Deploy to Vercel after the dashboard menus are complete.

The approved future product direction is documented in `docs/NEXT_DEVELOPMENT_PLAN.md`. Do not
implement that roadmap early. The product is now conceptually **Game Market Intelligence**, not a
mobile-only product, but Steam must not appear as an active filter before its collector and real
observations exist.

## Repository and runtime

- Repository: `git@github.com:Kosong-Interactive/analytic-dashboard.git`.
- Current branch: `main`, tracking `origin/main`.
- Package manager: npm with one root `package-lock.json`; never use pnpm.
- Node: `22.23.3` in `.nvmrc`, minimum `22.12.0`. Run `nvm use` first.
- Monorepo: npm workspaces + Turborepo.
- Database: Supabase PostgreSQL via Drizzle.
- Dashboard: Next.js App Router, Server Components by default.
- Deployment target: Vercel, intentionally deferred. Setup notes are in
  `docs/DEPLOYMENT_VERCEL.md`.
- Collection/classification schedule: GitHub Actions in `.github/workflows/collect.yml`.

Never print, paste, or commit `.env.local` values. Preserve unrelated user changes.

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

## Committed state on `main`

Latest committed feature commit at handoff: `1cdbe78 feat: add manual label overrides on game detail`.

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
- `/watchlist` — team-shared entries (`watchlist_entries`, migration `0002`, applied) with status,
  note, actor/timestamps, and movement since added. Game detail has Add to watchlist / Compare.
- `/compare` — up to four listings via `?ids=`, each storefront cohort loaded once, mixed-store
  cautions, shared-label highlighting, search to add.

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

### Agent/tooling files

`.agents/` and `.codex/` are untracked project skills and reviewer agent configuration. Decide
explicitly whether repository tooling should be versioned before committing them.

## Newly approved future roadmap

`docs/NEXT_DEVELOPMENT_PLAN.md` is new and uncommitted. It records two user-approved plans:

1. **Automated Game Research** — deterministic Opportunity Score, separate Research Confidence,
   comparable-game evidence, counter-signals, studio fit, internal Shortlist/Reject/Prototype
   decisions, and a constrained AI-authored research brief.
2. **Cross-platform / Steam readiness** — neutral Game Market Intelligence language, platform and
   market compatibility, Steam-specific observations, platform-level normalization, and
   Steam-to-mobile/mobile-to-Steam opportunity research.

The roadmap was also referenced from `docs/MVP_IMPLEMENTATION_PLAN.md`. These docs are intentional
changes requested by the user, but they have not been committed. Current dashboard completion takes
priority over implementing them.

## Next dashboard work

Games, Watchlist, and Compare are done. Remaining, in order:

1. **Search / command palette** — search stored games, developers, and taxonomy labels; navigate
   to existing pages; never start collectors or AI jobs.
2. Final navigation, responsive, accessibility, and browser-flow pass. The Games, Watchlist, and
   Compare pages were verified with unit tests, a production build, and read-only probes against
   Supabase, but not yet in a signed-in browser session.
3. Only then Automated Game Research / Steam, and the Vercel deployment.

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
