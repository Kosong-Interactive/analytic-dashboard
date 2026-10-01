# Handoff

Updated: 2026-10-01

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

Branch state (2026-10-01): PR #9 (`development` → `main`) was merged as `fe5a85e`; `main` contains
mobile upfront price, Steam rule/AI classification (migration `0008`), Steam Desktop pages and the
Mobile|Desktop header, Desktop parity with Mobile, Apple game charts, the serverless pool change,
the session-pooler docs, and Steam stage 6 (`4aefb50`, `68d269e`). `development` remains at
`68d269e`; the one-commit difference is the merge commit on `main`, not missing feature work. No
post-merge `collect.yml` run had started when this was checked at 03:26 UTC, so the new scheduled
path still needs one green run on `main`.

**Production is deployed by hand with the Vercel CLI from the user's laptop** (deployments carry
no git metadata), not from `main`; check `vercel ls analytic-dashboard` for what is live. The
Vercel CLI works in this environment for reading (`vercel logs --project analytic-dashboard
--environment production --since 1h`, `vercel ls`, `vercel inspect`). Environment values are
type Sensitive and cannot be read back; to change one, overwrite it in the Vercel dashboard and
redeploy. Everything under "Current state" is on `development` unless it says otherwise.

Uncommitted changes from other tools or people may be in the working tree (`AGENTS.md`,
`README.md` pointer line, `docs/CLAUDE_HANDOFF.md`); leave them alone.

### Collection and schedule

- Mobile adapters in `packages/collectors`: Apple (iTunes Search/Lookup plus the classic RSS Games
  chart feeds `itunes.apple.com/{cc}/rss/top{free,paid,grossing}applications/limit=N/genre=6014/json`,
  which list ids and order only; details come from one lookup request; the newer
  `rss.marketingtools.apple.com` host was unreachable when checked, and the classic feed is
  Apple-deprecated, so watch for it disappearing) and Google Play (`@mradex77/google-play-scraper`, collector-only).
  Markets `id` and `us`; the UI calls `us` "Global (US store)", which is a proxy, not global data.
- Discovery seeds are versioned; active `config/discovery-seeds/mvp-v3.json` (22 Apple terms × 50, Apple
  TOP_FREE/TOP_PAID/GROSSING × 100, Google TOP_FREE/TOP_PAID/GROSSING × 25). Apple chart job:
  `discovery.chart` for `app_store`; Trend Score uses `TOP_FREE` only. Rank gain for Apple needs
  about 3.5 days of chart history after the first collection. Mobile taxonomy remains immutable
  `config/taxonomy/v1.json`; Steam uses the v1 superset `config/taxonomy/v2.json` in the current
  working-tree feature.
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

- Migrations `0000`–`0008` are all applied to Supabase; `npm run db:verify` last reported 21 tables,
  RLS on every table, 9 migrations, no public policies.
- Mobile: `apps`, `store_apps`, `app_snapshots` (change-only + 24 h heartbeat), `chart_entries`,
  `collector_runs`. Classification: `taxonomy_labels`, `app_labels`, `classification_runs`
  (input-hash cache). Team: `watchlist_entries`, `studio_profiles`. Research: `research_runs`,
  `market_opportunities`, `opportunity_decisions`, `opportunity_research_briefs`.
- Steam (`0007`): `steam_apps`, `steam_snapshots`, `steam_chart_entries`, `steam_prices`,
  `steam_collector_runs`. The `store` enum deliberately has **no** `steam` value: adding it rippled
  into 16+ mobile code paths. Desktop is a separate mode in the UI (`PlatformMode`), not a store.
  Migration `0008` adds `steam_app_labels` and `steam_classification_runs`.

### Analytics and research

- `trend_score_v1` (30% rank gain, 25% review velocity, 15% rating-count velocity, 15% country
  breadth, 10% discovery recency, 5% rating momentum; missing components excluded and weights
  rescaled; withheld below 40% measurable weight).
- Steam stage 6.1 (done): `steam_trend_v1` in `packages/analytics/src/steam-trend-score.ts`
  (30% chart rank gain from Steam's own last-week rank, 25% player growth 7d, 20% review velocity
  7d, 10% chart breadth, 10% discovery recency, 5% sentiment change 7d; percentile within the
  tracked Steam cohort; missing components excluded and weights rescaled; withheld below 40%
  measurable weight). Rank gain, breadth and recency exist from the first collection (about 50%
  coverage); the history components need about 3.5 days. Shown on `/steam/trending` and the
  `/steam` Overview with a breakdown and an "Early signal" tag below 75% coverage. It is a separate
  formula from `trend_score_v1` and the two scores are never compared directly.
- Steam stage 6.2 (done): `platform_label_v1` in `packages/analytics/src/platform-labels.ts`. Per
  platform (steam, google_play, app_store) and per taxonomy label: members, share, scored members,
  median trend score (momentum, only with at least 3 scored members), new entrants (first seen
  within 7 days), and percentiles against that platform's own labels (needs at least 5 labels).
  Scores of different platforms are never put on one scale; only the within-platform percentiles
  are shown side by side, and a platform with no data counts as missing in the "measured of total"
  coverage. Page `/steam/compare` (linked from Steam Genres/Mechanics, not in the sidebar;
  `noCounterpart`) loads all three platforms (about 1–3 s locally) and keeps partial results if one
  fails. Mobile columns stay "Not ranked yet" until mobile Trend Scores exist (about 3.5 days of
  history, first expected 2026-10-02/03).
- Steam stage 6.3 (done): `platform_opportunity_v1` in `packages/analytics/src/platform-opportunity.ts`.
  Each label on `/steam/compare` gets a mode from its within-platform momentum percentiles
  (strong at or above the 60th percentile, weak at or below the 40th), the number of tracked
  games, and share of the catalogue: confirmed on both, Steam → mobile, mobile → Steam,
  conflicting, Steam only, mobile only, or no clear signal. "Thin" on a platform means no games,
  fewer than 3, or a share under half the strong side's share (a small genre is not thin just
  because other genres are larger). A platform that is unavailable or not yet measurable is
  missing, never negative evidence; migration modes are not claimed without a measured strong
  side. Confidence is low/medium/high for 1/2/3 measured platforms. `/steam/compare` has a
  `mode` filter. Today only Steam has momentum, so labels show Steam → mobile with low
  confidence (1 of 3) or no clear signal until mobile Trend Scores exist.
- Steam stage 6.4 (done): Desktop **Game Opportunities** panel on `/steam` (after the KPI cards,
  inside Suspense so the page does not wait for the three platforms; loaded through
  `getPlatformDatasets` in `apps/web/lib/steam/get-compare.ts`, shared per request with
  `getSteamTrendInputs`) and an evidence page `/steam/opportunities/[type]/[slug]` (signals per
  platform, comparable games with links, risks and caveats, freshness). `selectOpportunities`
  (`lib/steam/opportunities.ts`) keeps only confirmed, Steam → mobile, and mobile → Steam labels,
  ranked by mode, confidence, strength, and backing games, up to 5 cards, each with caveats
  (unmeasured platforms, one-sided signal, small cohort, sampled catalogue). Cards from a single
  measured platform are marked "Early signal". Nothing is persisted: there is no Shortlist,
  Reject, or Prototype for Desktop signals yet (those tables are keyed to mobile). Loading all
  platforms takes about 2–3 s locally. Steam stage 6 is complete; the next product step is
  persisting Desktop decisions if the team wants them.
- Automated Game Research stages 1–5 are done: `opportunity_score_v1` with separate Research
  Confidence, `/research/[id]` with Shortlist/Reject/Prototype history, `studio_fit_v1` and
  `/settings/studio-fit`, cited AI research briefs (gated), and `opportunity_history_v1`
  (30/90-day durability, acceleration, material-change alerts).

### Classification

- Rules (`rules-v1`) and Gemini (`ai-v2`, model rotation via `models.list`, SDK retries disabled,
  `maxOutputTokens` capped, evidence must quote the input). Resolution manual > AI > rule; once an
  app has an AI run its rule labels are ignored. Roll-ups hide automated labels below 0.6.
- Steam games: rules (`steam-rules-v2`: Steam user tags at 0.75 confidence, keyword rules on
  title/description, price) and Gemini (`ai-v2`, same prompt and provider as mobile; Steam genres
  and tags are sent as "store genres", so evidence may quote a tag). Stored in `steam_app_labels` / `steam_classification_runs`; run
  `npm run classify-steam --workspace @analytic-dashboard/collector` (also a step in `collect.yml`).
  Resolution and the AI-over-rule rule are the same as mobile. Run
  `npm run classify-steam-ai --workspace @analytic-dashboard/collector -- --limit 200` (a step in
  `collect.yml`; `--dry-run` calls the model but writes nothing). Migration `0008` is applied. First
  runs on 2026-10-01: rules labelled 150 games (1,196 labels); AI labelled all 150 (973 labels, 3
  rejected by validation, 2 empty, about 100k tokens, no errors). AI still leans on noisy tags
  (Dota 2 keeps Simulation and Tower defense), so judge quality before trusting Steam labels.
  `taxonomy-v2` adds Survival, Sandbox, Colony simulation, Extraction, Automation, Factory
  building, Resource management, and Session-based progression only for Steam. Perspective,
  controller support, Early Access, and production scope remain outside gameplay taxonomy for a
  future structured-facet feature. The v2 code is implemented and tested in the working tree, but
  neither rule nor Gemini reclassification has been run against Supabase yet.

### Dashboard

- Pages: Overview (`/`), Trending, New Releases, Games (Explorer, Watchlist, Compare tabs),
  Game Detail (`/games/[id]`, with manual label overrides), Genres, Mechanics, Search (⌘K and
  `/search`), Research detail, Settings › Studio Fit, Login (Supabase email/password; sign-up off).
- Overview Data coverage shows mobile sources plus a separate **Desktop · Steam (Global)** row.
- Header: `[Mobile | Desktop]`, then country (`Indonesia | Global`), then `[All | Google Play | App
  Store]` on Mobile or `[Steam]` on Desktop. The sidebar and mobile drawer show only the active
  mode's menu (title Mobile or Desktop); the mode comes from the page (`platformModeOf` in
  `apps/web/lib/shell/navigation.ts`), never from client state. `platformSwitchHref` maps each
  menu to its counterpart and carries only `country`. Game detail, Watchlist, and Compare use the
  Games key, so they lead to the other mode's Games list; pages with no counterpart at all
  (Research, Studio Fit, Search, Steam Charts) pass `noCounterpart` to `AppShell` and lead to the
  other mode's Overview.
- Steam Trending and the Overview Trending panel now show `steam_trend_v1` (see Analytics).
- Game Opportunities CTAs on both Mobile and Desktop use accessible button styling while retaining
  link semantics. Mobile uses primary View evidence plus secondary Browse buttons; Desktop uses
  primary View evidence and a secondary Platform comparison button.
- Desktop pages mirror Mobile: `/steam` (Overview), `/steam/trending`, `/steam/new-releases`,
  `/steam/genres`, `/steam/mechanics`, `/steam/games`, `/steam/games/[id]`, plus Desktop-only
  `/steam/charts`. On Desktop the country only picks the regional price (IDR or USD); charts,
  players and reviews are global and labelled "Global". Steam review ratio is never shown as
  stars. Trending shows the Steam Trend Score plus rank movers from `last_week_rank` (labelled as
  rank change). No Watchlist, Compare, Research, or manual label
  editing on Steam. Games/detail are built from `loadSteamGameList` and `loadSteamGameDetail`
  (`packages/db`); tables are `SteamGamesTable`/`SteamChartTable` (Plan A: shared primitives
  `Panel`, `Pager`, `SegmentedLinks`, `KpiGrid`, `MetricCardGrid`, `ChartPanel`, `LabelsPanel`
  with `readOnly`, filter fields in `components/filters/fields.tsx`; row bodies are not shared
  with Mobile tables). Not yet checked in a browser by the agent (needs login).
- Upfront price (mobile only, no in-app purchases): Game Detail "Upfront price" panel with
  store, country, snapshot time and price changes; a Price column in Games/Trending/New Releases
  and a Semua/Gratis/Berbayar `price` URL filter on Games and Trending. `0` shows "Gratis", `null`
  shows "—" and matches neither filter. Formatter: `apps/web/lib/format/price.ts`.
- Design reference: `https://claude.ai/artifact/FmXb2bJ9ViYy9S9p5NyGNy` (read with the Artifact
  tool in Claude; it has been intermittently unavailable).

## Known pitfalls

- **Vercel `DATABASE_URL` must be the session pooler (port 5432).** On 2026-10-01 production
  pages hung until the 300 s function timeout (`canceling statement due to statement timeout`,
  process exit 128 in the logs) because it pointed at the transaction pooler; the user replaced
  it and `/`, `/trending`, `/games`, `/steam*` then answered in 0.15-1.2 s. The session pooler's
  pool is small and shared by every client (each serverless instance, `next dev`, the collector),
  so `apps/web/lib/database.ts` uses 2 connections per instance, closes idle ones after 10 s, and
  recycles them after 5 min (`idleTimeoutSeconds`, `maxLifetimeSeconds` in
  `packages/db/src/client.ts`; unset for the collector). If pages hang again, look at Function
  Logs and the Supabase pooler pool size first, and avoid firing many sequential requests at
  production while testing.
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

- Mobile Trend Scores need about 3.5 days of history; first expected around 2026-10-02/03. Apple
  charts were first collected on 2026-10-01 (297 Indonesia and 299 US chart entries), so Apple
  rank gain appears at about the same time. Then re-check `/steam/compare`, the Game
  Opportunities panel, and the Mobile Overview cards with real data: only Steam has momentum
  today, so every Desktop opportunity is a low-confidence "Early signal" (1 of 3 platforms).
- The user reported on 2026-10-01 that the deploy and the visual check are fine; the agent only
  ever verified response times and data, never screenshots of the Desktop pages.
- The working-tree `taxonomy-v2` and Game Opportunities button CTA changes passed `npm run check`
  on Node 22.23.3 (lint, all workspace typechecks/tests, and production build). A local browser
  reached the login page but had no authenticated session, so the new CTA styling was not visually
  checked on the protected Overview pages.
- Durability needs 30/90 days of daily research results.
- Manual checks not yet done: a real Shortlist/Reject/Prototype save, a real Studio Fit profile
  version (enter only the team's real capabilities), the Watchlist note save, login and Overview
  info popovers on a phone, and one live research brief (needs the user's approval and scored
  opportunities).
- Steam: the first scheduled Steam step on `main` (run 36695320984) collected 150 listings but failed because five valid games
  returned 404 for optional current-player data. The adapter fix is now on `main`, and a read-only
  live smoke against affected App ID `2288340` returned `currentPlayers: null`; it still needs a
  post-merge workflow run before the schedule can be called healthy.

## Next work (recommended order)

Decisions that wait on the user are marked **(ask)**.

1. Confirm the first post-merge scheduled `collect.yml` run on `main` is green, including Apple
   charts, `Classify Steam games with rules`, and `... with AI`.
2. **Publish and activate `taxonomy-v2`.** The user approved the gameplay labels and the code is
   complete in the working tree. Commit/push when requested, then run rule classification so v2
   labels exist before judging the Steam UI. Gemini v2 reclassification is still a separate live
   action (about 100k tokens) and has not run.
3. **Re-check Steam stage 6 with real mobile scores** (about 2026-10-02/03): thresholds (strong
   0.6, weak 0.4, thin share ratio 0.5, minimum 3 games, 5 labels) and weights are the agent's
   proposals in versioned config; a change after the team relies on them needs a new version.
4. **Persist Desktop opportunity decisions** (Shortlist, Reject, Prototype). The existing tables
   are keyed to mobile (`market_opportunities`, `opportunity_decisions`), so this needs a new
   migration. **(ask)** before writing it.
5. **Manual Confirm/Reject for Steam labels** (`steam_app_labels` already has the `manual`
   source; needs a write path and the detail-page actions, `LabelsPanel` is currently
   `readOnly`).
6. **World market** from several countries for Mobile. **(ask)** which countries; mind Google
   Play's worldwide metrics when aggregating.
7. Smaller: faster classification input loading (it transfers every description, ~75 s from a
   laptop), a dedicated new-release discovery path; `/games` is the heaviest page (about 530 KB
   of HTML, 1.2 s in production).

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
