# Handoff

Updated: 2026-09-30

The single handoff for every coding agent working on this repository (Codex, Claude Code, or
another AGENTS.md-compatible tool). It describes the current state, not session history. Update it
in the same change whenever you finish or change a feature, and keep it tool-neutral.

## Read first

1. `AGENTS.md` (project instructions).
2. `.claude/rules/*.md` — the canonical project rules for **every** agent, not only Claude:
   architecture, conventions, code standards, tech stack, folder structure, product context.
3. `docs/MVP_IMPLEMENTATION_PLAN.md` (accepted scope) and `docs/NEXT_DEVELOPMENT_PLAN.md`
   (approved roadmap: Automated Game Research, Steam and cross-platform, World market).
4. `docs/OPERATIONS.md` (commands), `docs/DEPLOYMENT_VERCEL.md`, `docs/SUPABASE_SETUP.md`.

Project skills exist twice and must stay in sync: `.claude/skills/` (Claude Code) and
`.agents/skills/` (Codex and other tools). `.codex/agents/` holds Codex reviewer agents.

Do not assume the working tree is clean: more than one agent session may work in this checkout at
the same time. Never revert, stage, or commit changes you did not make.

## Working agreements with the user

- The user writes in Indonesian; reply in Indonesian.
- Work on `development`. Changes reach `main` through a GitHub pull request
  (`gh pr create --base main --head development`), merged with a merge commit; `development` is
  never deleted. `main` is what Vercel deploys to production and what the scheduled workflows run.
- Commit and push only when the user asks. Stage explicit files, one logical change per
  conventional commit.
- **No AI attribution anywhere**: no `Co-Authored-By` trailer for an assistant, no "Generated
  with …" footer, no assistant listed as collaborator (`.claude/rules/conventions.md`).
- Ask before anything outward-facing or hard to reverse: applying a migration to Supabase, a merge
  to `main`, triggering workflows, sending data to Gemini beyond the scheduled classifier.
- Never print, paste, or commit secret values (`.env.local`, API keys, connection strings).

## Repository and runtime

- GitHub: `Kosong-Interactive/analytic-dashboard`. Production: `https://analytic.kosonginteractive.id`
  (Vercel, functions pinned to `sin1` next to Supabase `ap-southeast-1` via `apps/web/vercel.json`).
- npm workspaces + Turborepo, one root `package-lock.json`; never pnpm. Node `22.23.3` (`.nvmrc`),
  minimum `22.12.0`; run `nvm use` first.
- Next.js App Router (Server Components by default), strict TypeScript, Tailwind, Base UI,
  ECharts, Zod, Supabase PostgreSQL via Drizzle.
- Workspaces: `apps/web`, `apps/collector`, `packages/{shared,collectors,db,analytics,classifier}`.

### Environment variables (names only)

Local values live in the repository root `.env.local` (the web app loads it on demand).

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | web, collector | Supabase session pooler, port 5432 (not the 6543 transaction pooler; see Known pitfalls) |
| `DIRECT_URL` | migrations | Currently unreachable (ENOTFOUND); `db:migrate` falls back to `DATABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web auth | Publishable key only |
| `GEMINI_API_KEY` | collector | AI classification and research briefs |
| `STEAM_WEB_API_KEY` | collectors, collector | Steam Web API |
| `TEST_DATABASE_URL` | db integration tests | Disposable database only; CI provides one |

GitHub Actions secrets present: `DATABASE_URL`, `GEMINI_API_KEY`, `STEAM_WEB_API_KEY`.
`ENABLE_RESEARCH_BRIEFS` gates the AI research-brief step and must stay off until the user
approves sending opportunity evidence to Gemini.

## Product semantics that must not drift

- Sampled market research, not a complete catalogue; never claim full coverage.
- "Newly discovered" = first observed by this system; "newly released" needs a provider date.
- Trend Score, Opportunity Score, and Studio Fit are internal versioned scores, not store labels.
- Google Play installs are ranges, never exact downloads. No revenue or download estimates.
- Missing values stay missing (`null`); never coerce them to zero.
- AI and rule labels are inferences with confidence, evidence, source, versions, and model.
  Manual Confirm/Reject always wins and is never overwritten.
- Dashboard reads never trigger collection, classification, or AI calls.
- **Platforms are grouped Mobile (App Store, Google Play; per country) and Desktop (Steam;
  Global).** Raw metrics are never combined across the groups; cross-platform comparison only
  uses normalized scores (Steam stage 6).

## Current state

Everything below is merged to `main` (latest `29b1746`, PR #7) unless marked otherwise.

### Collection and schedule

- Mobile adapters in `packages/collectors`: Apple (iTunes Search/Lookup; no chart path yet, so
  Apple has no rank gain) and Google Play (`@mradex77/google-play-scraper`, collector-only).
  Markets `id` and `us`; the UI calls `us` "Global (US store)", which is a proxy, not global data.
- Discovery seeds are versioned; active `config/discovery-seeds/mvp-v2.json` (22 Apple terms × 50,
  Google TOP_FREE/TOP_PAID/GROSSING × 25). Taxonomy `config/taxonomy/v1.json`.
- `.github/workflows/collect.yml` runs every 6 hours at minute 17 on `main`: discovery → rule
  classification → AI classification (≤200 changed apps) → Steam discovery.
  `.github/workflows/research.yml` runs daily at 01:43 UTC.
- Steam (desktop, Global): `SteamCollector` (`packages/collectors/src/steam/`) uses only the
  official Web API — most played, global top sellers, `IStoreBrowseService/GetItems` listings with
  `us`/`id` prices, `IUserReviewsService/GetAppReviews` totals (review text never kept), current
  players. `npm run discover-steam --workspace @analytic-dashboard/collector` stores ~200 chart
  games per run (~410 requests, ~7 min; Web API limit 100,000/day). Steam genres stay empty on
  purpose (no official genres in these responses; user tags were too noisy); tags are kept. A 404
  from the optional current-player endpoint is stored as unavailable (`null`) rather than making
  the run partial; other endpoint failures still make the command fail.

### Database

- Migrations `0000`–`0007` are all applied to Supabase; `npm run db:verify` last reported 21 tables,
  RLS on every table, 8 migrations, no public policies.
- Mobile: `apps`, `store_apps`, `app_snapshots` (change-only + 24 h heartbeat), `chart_entries`,
  `collector_runs`. Classification: `taxonomy_labels`, `app_labels`, `classification_runs`
  (input-hash cache). Team: `watchlist_entries`, `studio_profiles`. Research: `research_runs`,
  `market_opportunities`, `opportunity_decisions`, `opportunity_research_briefs`.
- Steam (`0007`): `steam_apps`, `steam_snapshots`, `steam_chart_entries`, `steam_prices`,
  `steam_collector_runs`. The `store` enum deliberately has **no** `steam` value: adding it rippled
  into 16+ mobile code paths. A shared `mobile | desktop` platform type is planned for Steam stage 5.

### Analytics and research

- `trend_score_v1` (30% rank gain, 25% review velocity, 15% rating-count velocity, 15% country
  breadth, 10% discovery recency, 5% rating momentum; missing components excluded and weights
  rescaled; withheld below 40% measurable weight).
- Automated Game Research stages 1–5 are done: `opportunity_score_v1` with separate Research
  Confidence, `/research/[id]` with Shortlist/Reject/Prototype history, `studio_fit_v1` and
  `/settings/studio-fit`, cited AI research briefs (gated), and `opportunity_history_v1`
  (30/90-day durability, acceleration, material-change alerts).

### Classification

- Rules (`rules-v1`) and Gemini (`ai-v2`, model rotation via `models.list`, SDK retries disabled,
  `maxOutputTokens` capped, evidence must quote the input). Resolution manual > AI > rule; once an
  app has an AI run its rule labels are ignored. Roll-ups hide automated labels below 0.6.
- Steam games are not classified yet.

### Dashboard

- Pages: Overview (`/`), Trending, New Releases, Games (Explorer, Watchlist, Compare tabs),
  Game Detail (`/games/[id]`, with manual label overrides), Genres, Mechanics, Search (⌘K and
  `/search`), Research detail, Settings › Studio Fit, Login (Supabase email/password; sign-up off).
- Overview Data coverage shows mobile sources plus a separate **Desktop · Steam (Global)** row.
  There are no Steam filters or pages yet.
- Upfront price (mobile only, no in-app purchases): Game Detail "Upfront price" panel with
  store, country, snapshot time and price changes; a Price column in Games/Trending/New Releases
  and a Semua/Gratis/Berbayar `price` URL filter on Games and Trending. `0` shows "Gratis", `null`
  shows "—" and matches neither filter. Formatter: `apps/web/lib/format/price.ts`.
- Design reference: `https://claude.ai/artifact/FmXb2bJ9ViYy9S9p5NyGNy` (read with the Artifact
  tool in Claude; it has been intermittently unavailable).

## Known pitfalls

- **Use the Supabase session pooler (port 5432) for `DATABASE_URL`.** Through the transaction
  pooler (port 6543), postgres.js queries pipelined on a busy connection stall until the 2-minute
  statement timeout (error `57014`) whenever concurrent reads outnumber the connections; the
  Overview hung this way. Verified 2026-09-30: 15 concurrent reads over 3 connections hung on 6543
  and finished in about 1 s on 5432, where transactions also work. `max_pipeline: 0` avoids the
  stall but breaks `sql.begin` (drizzle transactions, migrations), so do not use it.
- A long-running `next dev` keeps its database connection. After applying a migration or after a
  burst of failed queries, restart the dev server before judging a page.
- Raw `sql` fragments must pass dates as ISO strings with `::timestamptz`.
- Gemini: `gemini-2.5-flash-lite` is listed by `models.list` but returns 404 for this key. The SDK's
  own retries waited minutes on 429 and are disabled in favour of model rotation.
- Steam top sellers return nothing for `country_code: "ID"`; the adapter uses the global chart.
- The web app's Server Components need `DATABASE_URL`; Next.js only reads `apps/web/.env*`, so
  `lib/root-env.ts` loads the root file (dotenv, because `@next/env` caches the first directory).

## Waiting on data or manual checks

- Trend Scores (and therefore opportunities) need about 3.5 days of history; first expected around
  2026-10-02/03. Then review scored opportunities and the Overview cards with real data.
- Durability needs 30/90 days of daily research results.
- Manual checks not yet done: a real Shortlist/Reject/Prototype save, a real Studio Fit profile
  version (enter only the team's real capabilities), the Watchlist note save, login and Overview
  info popovers on a phone, and one live research brief (needs the user's approval and scored
  opportunities).
- Steam: the Desktop coverage row has not been seen in a browser yet. The first scheduled Steam
  step on `main` (run 36695320984) collected 150 listings but failed because five valid games
  returned 404 for optional current-player data. The adapter fix is on `development`, and a
  read-only live smoke against affected App ID `2288340` returned `currentPlayers: null`; it still
  needs merge to `main` and a workflow rerun before the schedule can be called healthy.

## Next work (recommended order)

1. **Steam stage 5 — Desktop UI.** Introduce the shared `mobile | desktop` platform type, add the
   Mobile/Desktop grouping to navigation and filters, and a Steam section: charts (most played, top
   sellers), game detail (review positive/negative and ratio, current players, regional prices,
   history), freshness. Get the user to approve the navigation design before building it.
2. **Steam classification** with the same taxonomy (tags + description; rules then AI), so Genres
   and Mechanics can offer a Desktop view.
3. **Apple chart path**, so App Store games get rank gain (30% of Trend Score).
4. **World market** from several countries for Mobile (team must choose countries; mind Google
   Play's worldwide metrics when aggregating).
5. **Steam stage 6** — cross-platform normalized scoring and Steam↔mobile opportunities.
6. Smaller: faster classification input loading (it transfers every description, ~75 s from a
   laptop), a dedicated new-release discovery path.

## Commands

```bash
nvm use
git status --short && git diff --check
npm run check                 # lint, typecheck, tests, build — before every commit
npm audit --omit=dev
npm run db:check              # migration metadata
npm run db:migrate            # applies to the database in DATABASE_URL (ask first for Supabase)
npm run db:verify             # tables, RLS, migration count
```

Live, low-volume, manual only (never in CI): `npm run smoke:apple|smoke:google-play|smoke:steam
--workspace @analytic-dashboard/collectors`, and `--dry-run` variants of `discover`,
`discover-steam`, `classify`, `classify-ai` in `@analytic-dashboard/collector`. See
`docs/OPERATIONS.md`. Database integration tests run in CI against a disposable database; never
point them at production.
