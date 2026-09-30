# Next Development Plan

Updated: 2026-09-29

This document records the approved direction after the current dashboard is complete. It is
intentionally separate from the active MVP work so that unfinished dashboard pages are not
displaced by future platform expansion or automated research.

## Product direction

The product is a **game market intelligence** dashboard, not a mobile-only dashboard. Apple App
Store and Google Play are the first sources; Steam is the next planned platform. Current UI copy,
domain language, and new feature design should avoid assuming that every game is mobile.

The product remains a research signal. Sampled discovery, inferred labels, platform-specific
engagement counts, install ranges, and internal scores must never be presented as complete market,
download, revenue, or profitability facts.

## Development order

1. Finish every existing dashboard menu and its required loading, empty, stale, partial, error,
   responsive, and evidence states.
2. Stabilize and operationally verify classification, including empty-result caching, true
   read-only dry runs, configuration documentation, and bounded scheduled AI runs.
3. Neutralize mobile-only product language and centralize platform capabilities.
4. Build the deterministic Automated Game Research MVP.
5. Add Steam collection and Steam-specific observations.
6. Extend research to cross-platform and platform-migration opportunities.

Deployment to Vercel remains deferred until the existing dashboard pages are complete.

## Current dashboard completion scope

Already implemented:

- Overview.
- Trending Games.
- New Releases.
- Genres.
- Mechanics.
- Game Detail, score evidence, labels, and manual overrides.
- Supabase Auth protection.

Remaining dashboard work, in order:

1. **Games / Explorer** — filters for platform, market, category, genre, mechanic, release date,
   rating, classification status, and momentum; server-side pagination; links to Game Detail.
2. **Watchlist** — save games for the authenticated internal team, add notes/status, show latest
   movement, and preserve who changed an item and when.
3. **Compare** — compare selected games with metric semantics kept platform-specific; show shared
   labels, trend components, historical observations, and explicit missing values.
4. **Search / command palette** — search games, developers, and taxonomy labels and navigate to
   existing pages without triggering collection.
5. Final navigation, responsive, accessibility, and browser-flow pass across all pages.

## Requested dashboard additions

### Genre and mechanic detail (requested 2026-09-30, done)

On **Genres** and **Mechanics**, clicking a label row opens the full list of tracked games that
carry that label in the selected storefront.

- Covers every label type on those pages: genre, subgenre, core mechanic, meta mechanic, theme,
  and multiplayer mode.
- Shows the label's roll-up figures (member count, momentum, new in 7 days, average rating) above
  a paginated, sortable game list with the same missing-value, freshness, and
  sampled-catalogue language as Games.
- Each game shows how it got the label: rule, AI, or manual, with its confidence, so an inferred
  membership is never presented as a store fact. Membership uses the same resolution as the
  roll-ups (manual first, AI replacing rules, automated labels below 60% confidence excluded).
- Rows keep the watchlist star and Compare toggle.
- Implemented by extending the Games explorer with a generic `label=type:slug` filter, a label
  summary header computed by the same roll-up as the Genres/Mechanics row, and a Label column
  showing rule/AI/manual and confidence. Each Genres/Mechanics label name links there.

### World market from several countries (requested 2026-09-30, planned)

Replace the **Global (US store)** market with **World**, built from several collected storefronts
instead of using the US store as a proxy.

- Stores never publish worldwide figures, so World is an aggregate of the storefronts this system
  collects. Always show its coverage (e.g. "World · 8 countries") and never call it global or
  complete.
- Keep observations per country in storage (`store_apps` and snapshots stay country-scoped), and
  build World at read or research time.
- Do not sum raw metrics across countries. Google Play rating counts and install ranges are
  worldwide per app, so adding them per country double-counts. App Store rating counts are per
  storefront. Aggregate normalized signals instead (per-storefront percentiles, then a median or
  coverage-weighted mean), and count a game once per platform.
- Trend Score and Opportunity Score stay per storefront; World views combine normalized results
  and report how many countries each game or cohort was observed in.
- Candidate countries are to be decided by the team (for example us, gb, de, fr, br, jp, kr, in);
  add them in `config/countries/enabled.json` and `supportedCountryCodes`. Indonesia stays its
  own market.
- Collection budget: every added country adds Apple search requests (about 22 seeds with 3-second
  spacing) and Google Play chart requests. Check the 45-minute collection job limit, and split
  the schedule by country if needed.
- `.claude/rules/product-context.md` currently limits the MVP to Indonesia and the United States;
  update it when this is implemented, since the team has now requested it.

### Steam as a data source (requested 2026-09-30, next major feature)

Collect Steam games as a third platform. The approved design is in **Cross-platform and Steam
readiness** below; this request makes it the next large feature after the current dashboard items.

- Stage 1 of that plan is done: platform-neutral product language and the platform capability
  registry (`packages/shared/src/platforms.ts`).
- Next: define Steam listing and observation contracts, then build a replaceable adapter in
  `packages/collectors/src/steam/` with fixtures, throttling, caching, and a low-volume live
  contract test. Evaluate sources before choosing one: the official Steam storefront and Web
  API endpoints, and their rate limits and terms of use. Treat any third-party owner or player
  figures as estimates with provenance, never as exact sales or downloads.
- Steam observations are platform-specific (positive/negative reviews, review score, pricing and
  discounts, chart rank where available). Never turn Steam sentiment into a five-star rating or
  compare raw Steam review counts with mobile rating counts.
- Steam is largely a single worldwide storefront, so its market is Global, and it must not be
  mixed silently with country-scoped mobile data (see the platform/market compatibility rule
  below). This ties in with the World market request above.
- Adding `steam` needs a database enum migration and a registry entry, and Steam must not appear
  as an active filter until real observations exist.

## Automated Game Research

### Product question

The feature should answer:

> Based on the market signals we currently observe, which game directions should the team research
> or prototype next, and what evidence supports that recommendation?

It must reduce guessing without replacing product judgment with an opaque AI answer. Recommendations
are evidence-backed research directions, not promises of commercial success.

### Recommendation unit

An opportunity is a versioned combination of available taxonomy dimensions:

```text
genre + subgenre + core mechanic + meta mechanic + theme + monetization clue
```

Every dimension is optional. Initial analysis should use single labels and combinations of at most
two or three dimensions so that small cohorts are not made to look statistically meaningful.

Every recommendation retains:

- target platform(s) and market(s);
- formula and taxonomy versions;
- observation window and calculation time;
- Opportunity Score and separate Research Confidence;
- comparable games and source observations;
- positive signals, counter-signals, and coverage caveats;
- internal decision status and notes.

### Opportunity Score v1

The score is deterministic and versioned. AI never changes it.

```text
30% platform demand momentum
20% new-entrant performance
15% observed competition gap
15% cross-platform or cross-store confirmation
10% quality / sentiment signal
10% studio fit
```

Before Studio Fit exists, redistribute its weight across the measurable components and report the
resulting weight coverage. Missing values are excluded, never converted to zero.

Component semantics:

- **Platform demand momentum:** cohort-normalized Trend Score, rank gain, review velocity,
  rating-count velocity, and share of members with positive movement. Use a median or trimmed mean
  so one viral title cannot define the opportunity.
- **New-entrant performance:** recent releases that acquired momentum, their early velocity, and
  their ability to enter a tracked chart. Discovery time is never substituted for release time.
- **Observed competition gap:** tracked member count, share of the sampled catalogue, recent-entry
  count, and concentration in the top games. Always say *observed competition*, never total market
  saturation.
- **Cross-platform confirmation:** agreement or disagreement among comparable platform-level
  percentiles. Until Steam exists, this is cross-store mobile confirmation.
- **Quality / sentiment:** rating or review sentiment and its movement, normalized inside a
  platform. Platform-specific scales are not compared directly.
- **Studio fit:** manually configured production capabilities and constraints, not a free-form AI
  guess.

### Research Confidence

Confidence is separate from Opportunity Score. A high score with low confidence is an **Early
Signal**, not a strong recommendation.

Confidence uses:

- cohort size;
- history coverage for 7-, 30-, and later 90-day windows;
- score-component coverage;
- collector freshness and source health;
- platform and market coverage;
- taxonomy coverage and label confidence;
- share of labels confirmed or rejected manually.

Suggested display bands are High (75%+), Medium (50–74%), and Low (below 50%). These thresholds must
be configuration owned by the score version.

### Insight types

- **Build Opportunity:** strong demand with lower observed competition.
- **Emerging Pattern:** small cohort with fast acceleration; usually lower confidence.
- **Proven Market:** durable demand with substantial competition; differentiation is required.
- **Watch Carefully:** negative, conflicting, or one-title-dominated evidence.
- **Platform Migration:** a pattern established on one platform but under-observed on another.

### Overview UI

Add **Game Opportunities** immediately after the KPI cards and before Trending Games. Show three to
five cards containing:

- concept direction and target platform/market;
- Opportunity Score and Research Confidence;
- concise “why now” evidence;
- observed competition and comparable games;
- risks and counter-signals;
- freshness and platform coverage;
- actions: View Evidence, Shortlist, Reject, and Start Prototype.

The detail route `/research/[id]` should show the full calculation, historical evidence, comparable
games, platform/market comparison, classification provenance, risks, and the team's decision
history.

### Studio Fit

The team configures its capability profile explicitly:

- team size and target development duration;
- supported platforms and input methods;
- 2D/3D capability;
- online backend and multiplayer capability;
- content-production and live-ops capacity;
- preferred/avoided genres, mechanics, and themes;
- monetization capability.

Display Market Opportunity and Studio Fit separately before calculating Recommendation Priority.
Do not imply that market attractiveness means the game is feasible for this studio.

### Role of AI

AI may summarize deterministic evidence, identify counter-signals, draft a research brief, and
suggest validation questions. It must receive only bounded evidence, return a strict validated
schema, and cite supplied evidence identifiers. It may not invent market size, revenue, exact
downloads, retention, CPI, LTV, production cost, or games absent from its input.

### Persistence and scheduling

Planned tables:

- `research_runs` — formula/taxonomy versions, platform/market/window, freshness, and run status;
- `market_opportunities` — combination, scores, confidence, evidence, risks, and versioned result;
- `opportunity_decisions` — status, actor, owner, notes, and timestamps.

Preserve historical recommendations instead of overwriting them. Run research once daily after
collection and classification, at a non-round minute. Re-running the same input/version must be
idempotent.

### Research delivery stages

1. Deterministic 7-day Opportunity Score, confidence, comparables, and Overview cards.
2. Opportunity Detail plus Shortlist/Reject/Prototype workflow.
3. Studio Fit and Recommendation Priority.
4. AI-authored research brief constrained to stored evidence.
5. 30/90-day durability, acceleration, history, and material-change alerts.

## Cross-platform and Steam readiness

### Product language

Use these neutral labels:

- Product: **Game Market Intelligence**.
- Overview title: **Game Market Overview**.
- Dimension: **Platform** rather than mobile store.
- Geographic dimension: **Market**; retain country internally where the source genuinely provides
  country-scoped observations.

Do not show Steam as an active filter until collection exists. Once available, the filter becomes:

```text
Platform: All Platforms | Google Play | App Store | Steam
Market: Indonesia | United States | Global
```

The platform/market compatibility matrix must be explicit. `All Platforms + Indonesia` may include
Steam only when an Indonesia-scoped Steam observation exists; it must never silently mix Steam
Global with mobile Indonesia.

### Platform contracts

Centralize platform metadata and capabilities instead of continuing to scatter
`"app_store" | "google_play"` unions through UI, queries, classifiers, and collectors. Add `steam`
through a migration only when its adapter and semantics are ready.

Common listing fields remain platform-neutral: external ID, platform, market, locale, title,
developer, release date, category, price/currency, first seen, and last seen.

Keep observations platform-specific:

- App Store / Google Play: rating, rating count, review count, install range where available, and
  mobile chart rank.
- Steam: positive/negative reviews, positive ratio, total reviews, chart rank, pricing/discount,
  and only those player signals available from an approved reliable source.

Never coerce Steam sentiment into a five-star value or compare raw Steam review counts directly to
mobile rating counts. Compute platform-level percentiles first, then combine normalized signals.

### Cross-platform opportunity modes

- Mobile-only.
- Steam-only.
- Confirmed cross-platform.
- Steam-to-mobile adaptation.
- Mobile-to-Steam adaptation.
- Platform-specific/conflicting signal.

Every result reports platform coverage, e.g. `2 of 3`, and treats an unavailable platform as
missing rather than negative evidence.

### Taxonomy evolution

Keep `taxonomy-v1` immutable. A future `taxonomy-v2` may add Steam-relevant concepts such as
management, survival, sandbox, automation, extraction, colony simulation, perspective, session
structure, controller support, Early Access, content intensity, and production scope.

Classifier instructions must say games across PC and mobile platforms, not mobile games. Existing
labels retain their taxonomy and prompt versions so old analysis remains interpretable.

### Steam delivery stages

1. Neutralize product copy and introduce a central platform capability registry. (Done)
2. Define Steam listing and observation contracts without weakening current mobile semantics.
3. Implement a replaceable Steam adapter, fixtures, throttling, caching, and a low-volume live
   contract test.
4. Persist Steam Global history and expose freshness/coverage.
5. Add Steam pages and filter activation.
6. Enable cross-platform normalized scoring and migration opportunities.

## Data limitations

The current and planned public data can support momentum, observed competition, recent-entry,
quality/sentiment, classification, and cross-platform confirmation signals. It cannot by itself
support audited revenue, profitability, exact downloads, CPI, retention, ARPU/LTV, total market
size, wishlist counts, or production-cost claims. Those require an approved additional provider or
manual internal data and must remain visibly separate from observed market evidence.
