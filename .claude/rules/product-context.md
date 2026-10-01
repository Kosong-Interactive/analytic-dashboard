# Product Context

## Purpose

This repository builds an internal mobile-game intelligence dashboard for discovering new and rising games and understanding genre, mechanic, rating, review, and ranking momentum.

Mobile storefronts are grouped into three markets (requested 2026-09-30, enabled 2026-10-01): Indonesia (`id`, its own market), SEA (`sg`, `th`, `vn`, `ph`, `my`), and World (`us`, `jp`, `kr`, `gb`, `de`, `br`, `in`). SEA and World are aggregates of several storefronts, never worldwide figures, and always state how many of their storefronts were collected. Initial sources are the Apple iTunes Search API and public Google Play pages collected through a replaceable open-source scraper adapter.

## Data semantics

- `newly discovered` means first observed by this system, not necessarily first released by a store.
- `newly released` requires a provider release date and must retain the source/storefront context.
- `trending` is a versioned internal score, not an official store label.
- Google Play install values may be ranges; never display them as exact downloads.
- Apple search coverage is sampled by seeds and known IDs; never claim full-catalog coverage.
- AI labels are inferences and must show confidence/evidence when used for analysis.

## User-facing requirements

- Show store, country, last collected time, and freshness near derived results.
- Explain the components contributing to a trend score.
- Distinguish missing data from zero.
- Preserve partial results if one source is unavailable.
- Use clear research language rather than implying audited market estimates.

## MVP boundary

Do not add revenue estimates, complete review archives, countries beyond the three markets above, public billing/accounts, or a native mobile client unless requested. Consult `docs/MVP_IMPLEMENTATION_PLAN.md` for the accepted scope and delivery phases.
