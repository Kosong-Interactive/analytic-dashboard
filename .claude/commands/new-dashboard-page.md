# New Dashboard Page

Create a Next.js App Router dashboard page from the supplied route and purpose.

Usage: `/project:new-dashboard-page <route> <purpose>`

Before creating files, inspect existing route, layout, UI, query, and chart conventions.

- Create the smallest route-local structure needed under `apps/web/app/`.
- Keep the page a Server Component unless an interaction requires a client boundary.
- Put shareable filters and pagination in URL search parameters.
- Call query services directly from Server Components instead of fetching the app's own Route Handler.
- Add explicit loading, empty, stale/partial-data, and error states where applicable.
- Display source, country, and freshness for analytical results.
- Reuse shared UI/chart primitives before adding new ones.
- Add focused tests and run the relevant workspace checks.
