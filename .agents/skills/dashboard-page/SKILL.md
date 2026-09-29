---
name: dashboard-page
description: Create or modify analytical pages in the analytic-dashboard Next.js App Router application, including filters, tables, charts, freshness, and state handling.
---

# Dashboard Page

Read `AGENTS.md`, `.claude/rules/product-context.md`, and surrounding route conventions before editing.

## Workflow

1. Identify the user question the page must answer and the source/country/time context it needs.
2. Prefer a Server Component for initial data reads.
3. Introduce a small Client Component only for interactions, browser APIs, or client-only chart libraries.
4. Put shareable filter, sorting, pagination, country, and date-range state in the URL.
5. Call query/application services directly from Server Components instead of fetching an internal API route.
6. Preserve missing values; do not turn them into zero.
7. Render loading, empty, stale, partial-data, and error states explicitly.
8. Show source, storefront, coverage caveat, and last collection time for derived results.
9. For trend scores or AI labels, expose the main evidence/components rather than presenting a black box.
10. Add focused tests and run the checks available for `apps/web`.

Reuse existing UI and chart primitives. A chart must preserve requested series and tooltips and have an accessible textual or tabular equivalent.
