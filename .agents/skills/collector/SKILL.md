---
name: collector
description: Create, modify, or diagnose Apple and Google Play discovery, detail, review, throttling, caching, and normalization workers in analytic-dashboard.
---

# Store Collector

Read the product plan and `.claude/rules/architecture.md` before modifying ingestion.

## Invariants

- Implement sources behind the shared collector interface.
- Treat all source responses as untrusted and validate them.
- Keep source-specific fields inside the adapter; emit normalized domain records.
- Retain store, external ID, country, locale, and UTC capture time.
- Use lightweight discovery first and schedule detail requests separately.
- Enforce per-source budgets, bounded concurrency, caching, jitter, and retry classification.
- Bound attempts and open a circuit after repeated parser/access failures.
- Use idempotency keys and database constraints so reruns do not duplicate records.
- Store a change snapshot only when tracked data changes, plus the configured heartbeat.
- Record run counts, durations, retry/rate-limit signals, and safe error samples.

## Verification

- Add deterministic fixtures for success, partial/missing fields, malformed data, empty results, and source errors.
- Test normalization and idempotent persistence separately.
- Keep live-source smoke tests small, scheduled, and separate from deterministic CI.
- Never claim current live compatibility unless a live check was actually run.
