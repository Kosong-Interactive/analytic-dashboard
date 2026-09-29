---
name: api-route
description: Create or modify Next.js Route Handlers for analytic-dashboard when a public, client-polled, webhook, or administrative HTTP boundary is actually required.
---

# API Route

Confirm an HTTP endpoint is appropriate. A Server Component reading internal data should normally call the underlying service directly.

## Required shape

- Use App Router `route.ts` conventions.
- Parse untrusted path, query, header, and body values with shared Zod schemas.
- Authenticate and authorize mutations and internal/admin operations.
- Delegate business rules and database access to application/repository modules.
- Return a stable typed response and safe HTTP status.
- Keep secrets and raw provider failures out of the response.
- Define caching behavior deliberately for read endpoints.
- Never run large collection, classification, or aggregation work synchronously; enqueue an idempotent job instead.

Test valid, invalid, unauthorized, empty, and failure paths as relevant. Verify that server-only imports do not enter a client bundle.
