# Conventions

## Next.js

- Use App Router conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and `route.ts`.
- Prefer Server Components for data reads.
- Add `'use client'` only to the smallest component needing browser APIs, state, effects, or client-only libraries.
- Do not fetch an internal Route Handler from a Server Component when it can call the underlying query service directly.
- Route Handlers validate inputs, authorize, call an application service, and translate the result to HTTP.
- Use URL search parameters for shareable filters, sorting, pagination, country, and date range.

## TypeScript and validation

- Strict mode is required.
- Prefer `unknown` plus parsing over `any`.
- Use discriminated unions for store-specific or job-specific variants.
- Validate every untrusted boundary with Zod.
- Keep provider response types separate from normalized domain types.

## Components

- Use semantic HTML and accessible labels.
- Handle loading, empty, error, stale, and partial-data states explicitly.
- Charts require a textual summary or accessible data representation.
- Use shared UI primitives before creating another primitive.
- Keep data transformation out of render bodies when it belongs in analytics/query code.

## Data access

- Use UTC for persisted timestamps and convert only for display.
- Avoid N+1 queries.
- Use cursor pagination for growing datasets where offset performance will degrade.
- Never silently coerce missing metrics to zero.
- Preserve source and captured-at fields through API responses.

## Exports and naming

- Follow surrounding package conventions once scaffolded.
- Prefer named exports for reusable functions, schemas, repositories, and hooks.
- Use clear domain names such as `reviewVelocity7d`, not generic names such as `score2`.
- Include formula/taxonomy versions in persisted records and identifiers where relevant.
