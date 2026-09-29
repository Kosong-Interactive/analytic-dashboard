---
name: "source-command-new-api-route"
description: "Migrated source command `new-api-route`"
---

# source-command-new-api-route

Use this skill when the user asks to run the migrated source command `new-api-route`.

## Command Template

# New API Route

Create a Next.js Route Handler from the supplied route, method, and use case.

Usage: `/project:new-api-route <route> <method> <purpose>`

- Confirm an HTTP endpoint is actually needed; Server Components should call internal query services directly.
- Add `route.ts` under the appropriate App Router segment.
- Validate path, query, headers, and body with shared Zod schemas.
- Authorize mutations and internal/admin operations.
- Keep business rules in an application or package service.
- Return a stable typed response and safe error body.
- Do not run a large scrape, AI batch, or long aggregation inside the request.
- Add tests for valid, invalid, unauthorized, empty, and failure paths as applicable.
